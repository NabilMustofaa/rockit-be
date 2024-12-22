require("dotenv").config();

const secret = process.env.JWT_SECRET;
const expiresIn = "12h";

module.exports = {
  secret,
  expiresIn,
};