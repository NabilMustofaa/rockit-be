const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const { message } = require("../validators/registerUser.validator");

const getUserInfo = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT username, wincount FROM users WHERE id = $1",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching user info:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const getLeaderboard = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, username, win_count
      FROM users
      ORDER BY win_count DESC
    `);

    const leaderboard = rows.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      username: user.username,
      win_count: user.win_count,
    }));

    top5 = leaderboard.slice(0, 5);
    userRank = leaderboard.find((user) => user.id === req.user.id);

    res.status(200).json({ 
      message : "Leaderboard fetches successfully",
      data : { leaderboard: top5, user_rank: userRank }
     });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUserHistory = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          console.error("No Authorization header provided");
          return res.status(401).json({ message: "No token provided" });
        }
    
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
        const playerId = decoded.id;     
        console.log("Decoded object", decoded); 
    
        console.log("Decoded Player ID:", playerId); //undefined krn historytabel mshkosong
    
        const { rows } = await pool.query(`
          SELECT id, game_id, player_id, result, played_at, finish_at
          FROM history
          WHERE player_id = $1
          ORDER BY played_at DESC;
        `, [playerId]);
    
        return res.status(200).json({ history: rows });
      } catch (error) {
        console.error("Error during /history:", error);
        if (error.name === "JsonWebTokenError") {
          return res.status(401).json({ message: "Invalid token" });
        }
        if (error.name === "TokenExpiredError") {
          return res.status(401).json({ message: "Token expired" });
        }
        return res.status(500).json({ message: "Internal Server Error" });
      }
};

module.exports = {
    getUserInfo,
    getLeaderboard,
    getUserHistory,
  };