const pool = require("../config/db");
const pusher = require("../config/pusher");

const endRound = async (req, res) => {
  const { token } = req.params;

  try {
    await pusher.trigger(`game-${token}`, 'round-end', {
      status: 'finish',
    });

    res.status(200).json({
      success: true,
      message: 'Round end notification sent successfully',
    });
  } catch (err) {
    console.error('Pusher trigger error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to notify round end',
      error: err.message,
    });
  }
};

const insertMove = async (req, res) => {
  const { token, round } = req.params;
  const { move } = req.body;
  const { user } = req;

  try {
    // Fetch game details
    const gameQuery = await pool.query(
      "SELECT id, player_1_id, player_2_id FROM games WHERE token = $1",
      [token]
    );

    if (gameQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    const game = gameQuery.rows[0];

    // Determine the player's role
    let moveColumn;
    if (game.player_1_id === user.id) {
      moveColumn = "player_1_move";
    } else if (game.player_2_id === user.id) {
      moveColumn = "player_2_move";
    } else {
      return res.status(403).json({
        success: false,
        message: "You are not part of this game",
      });
    }

    // Check if match exists for the round
    const matchQuery = await pool.query(
      "SELECT * FROM matches WHERE game_id = $1 AND round = $2",
      [game.id, round]
    );
    console.log(matchQuery.rows, "matchQuery.rows", game.id, round);
    let match;
    if (matchQuery.rowCount === 0) {
      // Create new match
      const insertQuery = `
        INSERT INTO matches (game_id, round, player_1_id, player_2_id, player_1_move, player_2_move, result)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
      const insertValues = [
        game.id,
        round,
        game.player_1_id,
        game.player_2_id,
        moveColumn === "player_1_move" ? move : null,
        moveColumn === "player_2_move" ? move : null,
        null
      ];
      match = await pool.query(insertQuery, insertValues);
      match = match.rows[0];
    } else {
      // Update existing match
      const updateQuery = `
        UPDATE matches SET ${moveColumn} = $1
        WHERE game_id = $2 AND round = $3 RETURNING *`;
      match = await pool.query(updateQuery, [move, game.id, round]);
      match = match.rows[0];

      // Calculate result if both moves are present
      if (match.player_1_move && match.player_2_move) {
        let result;
        if (match.player_1_move === match.player_2_move) {
          result = "Draw";
        } else if (
          (match.player_1_move === "Rock" && match.player_2_move === "Scissors") ||
          (match.player_1_move === "Scissors" && match.player_2_move === "Paper") ||
          (match.player_1_move === "Paper" && match.player_2_move === "Rock")
        ) {
          result = "Player 1";
        } else {
          result = "Player 2";
        }

        // Update result
        const resultUpdate = await pool.query(
          "UPDATE matches SET result = $1 WHERE id = $2 RETURNING *",
          [result, match.id]
        );
        match = resultUpdate.rows[0];

        // Notify via Pusher
        await pusher.trigger(`game-${token}`, "round-result", {
          round: round,
          match: match
        });
      }
    }

    // Notify move
    await pusher.trigger(`game-${token}`, 'round-move', {
      data: match
    });

    res.status(200).json({
      success: true,
      message: 'Move submitted successfully',
      data: match
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to submit move',
      error: err.message
    });
  }
};

const getRound = async (req, res) => {
  const { token, round } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM matches WHERE game_id IN (SELECT id FROM games WHERE token = $1) AND round = $2',
      [token, round]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Round not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Round retrieved successfully',
      data: result.rows,
    });
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve round details',
      error: err.message,
    });
  }
};

module.exports = {
  endRound,
  insertMove,
  getRound
};
