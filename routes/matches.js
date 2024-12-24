const express = require('express');
const { db } = require('../config');
const pusher = require('../config/pusher');
const verifyToken = require('../middlewares/auth'); 
const router = express.Router();

router.get('/:token', verifyToken, async function (req, res) {
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
});

router.post("/:token/:round", verifyToken, async function (req, res) {
  const { token, round } = req.params;
  const { move } = req.body; // Move sent by the user (e.g., "rock", "paper", "scissors")
  const { user } = req; // User populated by verifyToken middleware

  try {
    // Fetch game details
    const gameQuery = await db.query(
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

    // Check if the match for the round already exists
    const matchQuery = await db.query(
      "SELECT * FROM matches WHERE game_id = $1 AND round = $2",
      [game.id, round]
    );

    if (matchQuery.rowCount === 0) {
      // Insert a new match if none exists
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
        null, // Result is null until both moves are made
      ];
      const newMatch = await db.query(insertQuery, insertValues);

      return res.status(200).json({
        success: true,
        message: "Move submitted successfully",
        data: newMatch.rows[0],
      });
    } else {
      // Update the existing match
      const updateQuery = `
        UPDATE matches SET ${moveColumn} = $1
        WHERE game_id = $2 AND round = $3 RETURNING *`;
      const updatedMatch = await db.query(updateQuery, [move, game.id, round]);

      // Check if both moves are present to calculate the result
      const match = updatedMatch.rows[0];
      if (match.player_1_move && match.player_2_move) {
        let result;

        // Determine the result based on game rules
        if (match.player_1_move === match.player_2_move) {
          result = "Draw";
        } else if (
          (match.player_1_move === "rock" && match.player_2_move === "scissors") ||
          (match.player_1_move === "scissors" && match.player_2_move === "paper") ||
          (match.player_1_move === "paper" && match.player_2_move === "rock")
        ) {
          result = "Player 1 Wins";
        } else {
          result = "Player 2 Wins";
        }

        // Update the match with the result
        const resultUpdate = await db.query(
          "UPDATE matches SET result = $1 WHERE id = $2 RETURNING *",
          [result, match.id]
        );

        // Notify clients via Pusher
        await pusher.trigger(`game-${token}`, "round-result", {
          round: round,
          match: resultUpdate.rows[0],
        });

        return res.status(200).json({
          success: true,
          message: "Move submitted successfully",
          data: resultUpdate.rows[0],
        });
      }

      // If the result is not calculated yet
      return res.status(200).json({
        success: true,
        message: "Move submitted successfully",
        data: match,
      });
    }
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit move",
      error: err.message,
    });
  }
});

module.exports = router;


router.post('/:token/:round', verifyToken, async function (req, res) {
  const { token, round } = req.params;
  const { move } = req.body;
  const { user } = req; // Ensure verifyToken populates req.user

  try {
    // Fetch game details
    const game = await db.query('SELECT id, player_1_id, player_2_id FROM games WHERE token = $1', [token]);

    if (game.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    const gameId = game.rows[0].id;

    // Determine the player's role and update the appropriate column
    let query, values;
    if (game.rows[0].player_1_id === user.id) {
      query = 'UPDATE matches SET player_1_move = $1 WHERE game_id = $2 AND round = $3 RETURNING *';
      values = [move, gameId, round];
    } else if (game.rows[0].player_2_id === user.id) {
      query = 'UPDATE matches SET player_2_move = $1 WHERE game_id = $2 AND round = $3 RETURNING *';
      values = [move, gameId, round];
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not part of this game',
      });
    }

    // Update the move
    const matchUpdate = await db.query(query, values);

    if (matchUpdate.rowCount === 0) {
      // Create a new match entry if not found
      await db.query(
        'INSERT INTO matches (game_id, round, player_1_id, player_2_id, player_1_move, player_2_move, result) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [gameId, round, game.rows[0].player_1_id, game.rows[0].player_2_id, null, null, 'Pending']
      );
    }

    // Retrieve updated match data
    const matches = await db.query(
      'SELECT * FROM matches WHERE game_id = $1 AND round = $2',
      [gameId, round]
    );

    // Notify clients about the move
    await pusher.trigger(`game-${token}`, 'round-move', {
      data: matches.rows,
    });

    res.status(200).json({
      success: true,
      message: 'Move submitted successfully',
      data: matches.rows,
    });
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to submit move',
      error: err.message,
    });
  }
});


router.get('/:token/:round', async function (req, res) {
  const { token, round } = req.params;

  try {
    const result = await db.query(
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
});

module.exports = router;
