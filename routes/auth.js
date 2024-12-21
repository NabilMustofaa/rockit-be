var express = require("express");
var router = express.Router();
const pool = require("../config/db");
const validator = require("../validators/index");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const { secret } = require("../config/jwt");


// REGISTER USER
router.post("/register", async (req, res) => {
  const { body } = req;
  const result = validator.registerUser.validate(body);
  const { error } = result;
  if (error) {
    res.status(400).json({
      message: "Invalid Request",
      data: error,
    });
    return;
  }

  try {
    const hashedPin = await bcrypt.hash(body.pin, 10);
    const result = await pool.query(
      "INSERT INTO users (username, pin) VALUES ($1, $2) RETURNING *",
      [body.username, hashedPin]
    );
    console.log("token", hashedPin);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating user:", error.message);

    if (error.code === "23505") {
      res.status(409).json({ message: "Username already exist." });
    } else {
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});
//LOGIN
router.post("/login", async (req, res) => {
  const { body } = req;
  const result = validator.loginUser.validate(body);
  const { error } = result;

  if (error) {
    res.status(400).json({
      message: "Invalid Request",
      data: error,
    });
    return;
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      body.username,
    ]);
    if (result.rowCount === 0) {
      return res.status(400).json({
        message: "invalid username or PIN",
      });
    }
    const match = await bcrypt.compare(body.pin, result.rows[0].pin);
    if (!match) {
      return res.status(400).json({
        message: "invalid username or PIN",
      });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      secret,
      {
        expiresIn: "3h",
      }
    );

    return res.status(200).json({
      message: "berhasil masuk",
      access_token: token,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating user:", error.message);
  }
});

module.exports = router;
