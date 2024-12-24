const pool = require("../config/db");
const validator = require("../validators/index");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { secret } = require("../config/jwt");

const register = async (req, res) => {
  const { body } = req;
  const result = validator.registerUser.validate(body);
  const { error } = result;

  if (error) {
    return res.status(400).json({
      message: "Invalid Request",
      data: error.details,
    });
  }

  try {
    const hashedPin = await bcrypt.hash(body.pin, 10);

    const queryResult = await pool.query(
      "INSERT INTO users (username, pin) VALUES ($1, $2) RETURNING *",
      [body.username, hashedPin]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: queryResult.rows[0],
    });
  } catch (error) {
    console.error("Error creating user:", error.message);

    if (error.code === "23505") {
      res.status(409).json({ message: "Username already exists." });
    } else {
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
};

const login = async (req, res) => {
  const { body } = req;
  const result = validator.loginUser.validate(body);
  const { error } = result;

  if (error) {
    return res.status(400).json({
      message: "Invalid Request",
      data: error.details,
    });
  }

  try {
    const queryResult = await pool.query("SELECT * FROM users WHERE username = $1", [
      body.username,
    ]);

    if (queryResult.rowCount === 0) {
      return res.status(400).json({
        message: "Invalid username or PIN",
      });
    }

    const user = queryResult.rows[0];
    const isMatch = await bcrypt.compare(body.pin, user.pin);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid username or PIN",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      secret,
      { expiresIn: "3h" }
    );

    res.status(200).json({
      message: "Login successful",
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Error logging in user:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


module.exports = {
  register,
  login
};