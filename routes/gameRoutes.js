var express = require('express');
const { createRoom, joinRoom, startGame, stopGame } = require('../controllers/gameController');

var router = express.Router();

router.post('/', createRoom);
router.put('/:token/join', joinRoom);
router.post('/:token/start', startGame);
router.put('/:token/stop', stopGame);

module.exports = router;
