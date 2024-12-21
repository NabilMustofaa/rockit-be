require("dotenv").config();
const db = require("./db");
const jwtConfig = require("./jwt");

const port = parseInt(process.env.APP_PORT);

module.exports = {
  port,
  db,
  jwt: jwtConfig,
};