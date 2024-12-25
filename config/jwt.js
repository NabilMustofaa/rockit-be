require("dotenv").config();

const secret = process.env.JWT_SECRET;
const expiresIn = "3h";

module.exports = {
  secret,
  expiresIn,
};