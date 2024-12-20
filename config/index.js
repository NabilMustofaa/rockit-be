require("dotenv").config();
const db = require("./db");

const port = parseInt(process.env.APP_PORT);

module.exports = {
  port,
  db,
};