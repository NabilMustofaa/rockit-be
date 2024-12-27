const pool = require('../config/db');
const pusher = require('../config/pusher');

const createRoom = async (req, res) => {
  try {
    const token = Math.random().toString(36).substring(2, 8);
    const { user } = req;
    const result = await pool.query(
      'INSERT INTO games (token, status, player_1_id) VALUES ($1, $2, $3) RETURNING *',
      [token, 'wait', user.id]
    );

    const game = result.rows[0];

    await pusher.trigger(`game-${token}`, 'room-created', {
      data: {
        token,
        player_1_id: user.id,
        player_2_id: null
      }
    });

    res.status(200).json({
      success: true,
      message: 'Room created successfully',
      data: {
        id: game.id,
        token: game.token,
        status: game.status,
        creator: game.player_1_id
      }
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room'
    });
  }
};

const joinRoom = async (req, res) => {
  const { token } = req.params;
  const { user } = req;

  try {
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User information is missing'
      });
    }

    const gameCheck = await pool.query('SELECT * FROM games WHERE token = $1', [token]);

    if (gameCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (gameCheck.rows[0].player_2_id) {
      return res.status(400).json({
        success: false,
        message: 'Room already has a second player'
      });
    }

    const result = await pool.query(
      'UPDATE games SET player_2_id = $1 WHERE token = $2 AND player_2_id IS NULL RETURNING *',
      [user.id, token]
    );

    const game = result.rows[0];

    await pusher.trigger(`game-${token}`, 'room-join', {
      data: {
        token,
        player_1_id: game.player_1_id,
        player_2_id: user.id
      }
    });

    res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      data: {
        token,
        player_1_id: game.player_1_id,
        player_2_id: user.id
      }
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join room',
      error: error.message
    });
  }
};

const startGame = async (req, res) => {
  const { token } = req.params;
  const { user } = req;

  try {
    const gameQuery = await pool.query('SELECT * FROM games WHERE token = $1', [token]);

    if (gameQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const game = gameQuery.rows[0];

    if (game.player_1_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can start the game'
      });
    }

    if (!game.player_2_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start game: Waiting for a second player'
      });
    }

    const result = await pool.query(
      'UPDATE games SET status = $1 WHERE token = $2 RETURNING *',
      ['active', token]
    );

    const updatedGame = result.rows[0];

    await pool.query(
      'INSERT INTO history (game_id, player_1_id, player_2_id, winner, played_at, finish_at) VALUES ($1, $2, $3, $4, NOW(), NULL)',
      [updatedGame.id, updatedGame.player_1_id, updatedGame.player_2_id, 'Draw']
    );

    await pusher.trigger(`game-${token}`, 'room-start', {
      roomId: updatedGame.id,
      status: updatedGame.status
    });

    res.status(200).json({
      success: true,
      message: 'Room started successfully',
      data: {
        roomId: updatedGame.id,
        status: updatedGame.status
      }
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start room',
      error: error.message
    });
  }
};

const stopGame = async (req, res) => {
  const { token } = req.params;

  try {
    const gameQuery = await pool.query('SELECT * FROM games WHERE token = $1', [token]);

    if (gameQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const game = gameQuery.rows[0];

    const result = await pool.query(
      'UPDATE games SET status = $1 WHERE token = $2 RETURNING *',
      ['finish', token]
    );

    const rounds = await pool.query(
      'SELECT * FROM matches WHERE game_id = $1 ORDER BY round ASC',
      [game.id]
    );

    const getRoundWinner = (move1, move2) => {
      if (move1 === "None") return "Player 2";
      if (move2 === "None") return "Player 1";
      if (move1 === move2) return "Draw";
      const winningMoves = {
        Rock: "Scissors",
        Scissors: "Paper", 
        Paper: "Rock"
      };
      return winningMoves[move1] === move2 ? "Player 1" : "Player 2";
    };

    const combinedRounds = rounds.rows.reduce((acc, curr) => {
      const existingRound = acc.find(r => r.round === curr.round);
      
      if (!existingRound) {
        acc.push(curr);
        return acc;
      }

      existingRound.player_1_move ||= curr.player_1_move;
      existingRound.player_2_move ||= curr.player_2_move;
      
      if (existingRound.player_1_move && existingRound.player_2_move) {
        existingRound.result = getRoundWinner(existingRound.player_1_move, existingRound.player_2_move);
      }

      return acc;
    }, []);

    const gameResults = combinedRounds.reduce((count, round) => {
      if (round.result === "Player 1") count.player1Wins++;
      if (round.result === "Player 2") count.player2Wins++;
      return count;
    }, { player1Wins: 0, player2Wins: 0 });

    const winner = gameResults.player1Wins > gameResults.player2Wins ? "Player 1" :
                  gameResults.player2Wins > gameResults.player1Wins ? "Player 2" : 
                  'Draw';

    await pool.query(
      'UPDATE history SET winner = $1, finish_at = NOW() WHERE game_id = $2',
      [winner, game.id]
    );

    await pool.query(
      'UPDATE users SET win_count = win_count + 1 WHERE id = $1',
      [winner]
    );

    await pusher.trigger(`game-${token}`, 'room-end', {
      status: 'finish'
    });

    res.status(200).json({
      success: true,
      message: 'Room finished successfully',
      data: {
        roomId: token,
        rounds: combinedRounds
      }
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finish room',
      error: error.message
    });
  }
};

module.exports = {
  createRoom,
  joinRoom,
  startGame,
  stopGame
};
