var express = require('express');
const { db } = require('../config');
const Pusher = require('pusher');
const { use } = require('.');
var router = express.Router();

const pusher = new Pusher({
  appId: "1488927",
  key: "5ffd502396a114a03464",
  secret: "8a39f9a1fc77e2abf8a6",
  cluster: "ap1",
  useTLS: true
});

router.post('/', async function(req, res, next) {
  try {
    const token = Math.random().toString(36).substring(2, 8);
    const {user} = req

    const result = await db.query('INSERT INTO games (token, status, player_1_id) VALUES ($1, $2,$3) RETURNING *', [token, 'wait', user.id]);

    pusher.trigger(`game-${token}`, 'room-created', { token, player_1_id: user.id, player_2_id: null });
    res.status(200).json({
      success: true,
      message: 'Room created successfully',
      data: {
        result: result.rows
      }
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room',
      error: error.message
    });
  }
});

router.put('/:token/join', async function(req, res, next) {
  const { token } = req.params;
  const {user} = req
  console.log(token, user)
  try {

    const result = await db.query('UPDATE games SET player_2_id = $1 WHERE token = $2 RETURNING *', [user.id, token]);
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    pusher.trigger(`game-${token}`, 'room-joined', { token, player_1_id: result.rows[0].player_1_id, player_2_id: user.id });
    res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      data: {
        roomId: token,
        opponent: user.username
      }
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to join room',
      error: error.message
    });
  }
});
router.post('/:token/start', async function(req, res, next) {
  try {
    const { token } = req.params;
    const result = await db.query('UPDATE games SET status = \'active\' WHERE token = $1 RETURNING *', [token]);
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    await db.query('INSERT INTO history (game_id,player_id) VALUES ($1,$2)', [result.rows[0].id, result.rows[0].player_1_id]);
    await db.query('INSERT INTO history (game_id,player_id) VALUES ($1,$2)', [result.rows[0].id, result.rows[0].player_2_id]);

    pusher.trigger(`game-${token}`, 'room-started', { roomId: result.rows[0].id, status: result.rows[0].status });

    res.status(200).json({
      success: true,
      message: 'Room started successfully',
      data: {
        roomId: result.rows[0].id,
        status: result.rows[0].status
      }
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to start room',
      error: error.message
    });
  }
});


router.put('/:token/stop', async function(req, res, next) {
  try {
    const { token } = req.params;
    const {user} = req
    const gameResult = req.body.result
    const result = await db.query('UPDATE games SET status = \'finish\' WHERE token = $1', [token]);
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    await db.query('UPDATE history SET result = $1 WHERE game_id IN (SELECT id FROM games WHERE token = $2) AND player_id = $3', [gameResult, token, user.id]);

    let details = await db.query('SELECT * FROM matches WHERE game_id IN (SELECT id FROM games WHERE token = $1)', [token]);


    // Logika menentukan pemenang
    const determineWinner = (move1, move2) => {
      if (move1 === move2) return 'draw';
      if (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'scissors' && move2 === 'paper') ||
        (move1 === 'paper' && move2 === 'rock')
      ) {
        return 'player_1';
      }
      return 'player_2';
    };
    
    const rounds = details.rows.reduce((acc, curr) => {
      let round = acc.find(r => r.round === curr.round);
      if (!round) {
        round = { 
          round: curr.round, 
          player_1_id: null, 
          player_1_move: null, 
          player_2_id: null, 
          player_2_move: null, 
          result: null 
        };
        acc.push(round);
      }
      if (curr.player_id === 1) {
        round.player_1_id = curr.player_id;
        round.player_1_move = curr.move;
      }
      if (curr.player_id === 5) {
        round.player_2_id = curr.player_id;
        round.player_2_move = curr.move;
      }
      if (round.player_1_move && round.player_2_move) {
        round.result = determineWinner(round.player_1_move, round.player_2_move);
      }
      return acc;
    }, []);
    
    console.log(rounds);
    

    console.log(rounds)

    console.log(details.rows)
    if (details.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Matches not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Room finished successfully',
      data: {
        roomId: token,
        rounds : rounds
      }
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to finish room',
      error: error.message
    });
  }
});


module.exports = router;
