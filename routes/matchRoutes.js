var express = require('express');
const { endRound, insertMove, getRound } = require('../controllers/matchController');
var router = express.Router();

router.get('/:token', endRound);
router.post('/:token/:round', insertMove);
router.get('/:token/:round', getRound);

module.exports = router;
