var express = require('express');
const { db } = require('../config');
var router = express.Router();
const pusher = require('../config/pusher');
const { useFetchers } = require('react-router-dom');
const verifyToken = require('../middlewares/auth');


router.post('/', verifyToken, async (req, res) => {
  try {
    const token = Math.random().toString(36).substring(2, 8); 
    const { user } = req; 
    console.log('User:', user);

    const result = await db.query(
      'INSERT INTO games (token, status, player_1_id) VALUES ($1, $2, $3) RETURNING *',
      [token, 'wait', user.id]
    );

    const game = result.rows[0];

    res.status(200).json({
      success: true,
      message: 'Room created successfully',
      data: {
        id: game,
        token: game.token,
        status: game.status,
        creator: game.player_1_id,
      },
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room',
    });
  }
});

router.put('/:token/join', verifyToken, async function (req, res, next) {
  const { token } = req.params;
  const { user } = req;

  try {
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User information is missing',
      });
    }

    // ada ga roomnya
    const gameCheck = await db.query('SELECT * FROM games WHERE token = $1', [token]);
    console.log('Game before update:', gameCheck.rows);

    if (gameCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    if (gameCheck.rows[0].player_2_id) {
      return res.status(400).json({
        success: false,
        message: 'Room already has a second player',
      });
    }

    // uodate player 2
    const result = await db.query(
      'UPDATE games SET player_2_id = $1 WHERE token = $2 AND player_2_id IS NULL RETURNING *',
      [user.id, token]
    );

    console.log('Update result:', result.rows);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found or already full',
      });
    }

    const game = result.rows[0];

    // Trigger Pusher
    try {
      await pusher.trigger(`game-${token}`, 'room-join', {
        data: {
          token,
          player_1_id: game.player_1_id,
          player_2_id: user.id,
        },
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      data: {
        token,
        player_1_id: game.player_1_id,
        player_2_id: user.id,
      },
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join room',
      error: error.message,
    });
  }
});

router.post("/:token/start", verifyToken, async function (req, res, next) {
  const { token } = req.params;
  const { user } = req; 

  try {
    const gameQuery = await db.query("SELECT * FROM games WHERE token = $1", [
      token,
    ]);

    if (gameQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const game = gameQuery.rows[0];

    if (game.player_1_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the creator can start the game",
      });
    }

    if (!game.player_2_id) {
      return res.status(400).json({
        success: false,
        message: "Cannot start game: Waiting for a second player",
      });
    }

    // Update tstatus --> active
    const result = await db.query(
      "UPDATE games SET status = $1 WHERE token = $2 RETURNING *",
      ["active", token]
    );

    if (result.rowCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to update game status",
      });
    }

    const updatedGame = result.rows[0];

    // add history
    await db.query(
      "INSERT INTO history (game_id, player_1_id, player_2_id, winner, played_at, finish_at) VALUES ($1, $2, $3, $4, NOW(), NULL)",
      [
        updatedGame.id,
        updatedGame.player_1_id,
        updatedGame.player_2_id,
        "Draw", 
      ]
    );

    // notif game mulai
    try {
      await pusher.trigger(`game-${token}`, "room-start", {
        roomId: updatedGame.id,
        status: updatedGame.status,
      });
    } catch (pusherError) {
      console.error("Pusher trigger error:", pusherError.message);
    }

    res.status(200).json({
      success: true,
      message: "Room started successfully",
      data: {
        roomId: updatedGame.id,
        status: updatedGame.status,
      },
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start room",
      error: error.message,
    });
  }
});

router.put('/:token/stop', async function (req, res, next) {
  const { token } = req.params;

  try {
    // Check if the game exists
    const gameQuery = await db.query('SELECT * FROM games WHERE token = $1', [token]);
    if (gameQuery.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    const game = gameQuery.rows[0];

    // Update the game's status to 'finish'
    const result = await db.query(
      'UPDATE games SET status = $1 WHERE token = $2 RETURNING *',
      ['finish', token]
    );

    if (result.rowCount === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update game status',
      });
    }

    // finish di match
    // await db.query(
    //   'UPDATE matches SET result = $1 WHERE game_id = $2 AND result IS NULL',
    //   ['Incomplete', game.id] // Example: Mark incomplete matches as 'Incomplete'
    // );

    // Update history to mark game as finished
    await db.query(
      'UPDATE history SET finish_at = NOW() WHERE game_id = $1',
      [game.id]
    );

    // Notify clients via Pusher
    try {
      await pusher.trigger(`game-${token}`, 'room-end', {
        status: 'finish',
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError.message);
    }

    // Respond with success and game data
    res.status(200).json({
      success: true,
      message: 'Room finished successfully',
      data: {
        roomId: game.id,
        status: 'finish',
      },
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finish room',
      error: error.message,
    });
  }
});


router.put('/:token/stop/try', async function (req, res, next) {
  const { token } = req.params;

  try {
    const result = await db.query(
      'UPDATE games SET status = $1 WHERE token = $2 RETURNING *',
      ['finish', token]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found',
      });
    }

    const game = result.rows[0];

    await db.query(
      'UPDATE history SET finish_at = NOW() WHERE game_id = $1',
      [game.id]
    );

    pusher.trigger(`game-${token}`, 'room-end', {
      status: 'finish',
    });

    res.status(200).json({
      success: true,
      message: 'Room finished successfully',
      data: { roomId: game.id },
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finish room',
      error: error.message,
    });
  }
});

module.exports = router;
