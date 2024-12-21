require("dotenv").config();

const secret = process.env.JWT_SECRET;
const expiresIn = "1h";

module.exports = {
  secret,
  expiresIn,
};