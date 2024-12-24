const express = require("express");
const {
  getUserInfo,
  getLeaderboard,
  getUserHistory,
} = require("../controllers/userController"); 
const router = express.Router();

router.get("/me", getUserInfo); 
router.get("/leaderboard", getLeaderboard);
router.get("/history", getUserHistory);

module.exports = router;
