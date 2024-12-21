var express = require('express');
const { db } = require('../config');
var router = express.Router();

router.post('/:token', async function(req, res, next) {
  const { token } = req.params;
  const { move,round } = req.body;
  const {user} = req

  try {
    const gameId = await db.query('SELECT id FROM games WHERE token = $1', [token]);
    const result = await db.query('INSERT INTO matches (game_id, player_id, round, move) VALUES ($1, $2, $3, $4) RETURNING *', [gameId.rows[0].id, user.id, round, move]);
    res.status(200).json({
      success: true,
      message: 'User move inserted successfully',
      data: {
        result: result.rows
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to insert user move',
      error: err.message
    });
  }
});

router.get('/:token/:round', async function(req, res, next) {
  const { token,round } = req.params;

  try {
    const result = await db.query('SELECT * FROM matches WHERE game_id IN (SELECT id FROM games WHERE token = $2) AND round = $1', [round, token]);
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Round retrieved successfully',
      data: {
        round: result.rows
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to get Round',
      error: err.message
    });
  }
});

module.exports = router;

