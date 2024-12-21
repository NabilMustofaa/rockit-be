const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const config = require('./config');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const gamesRouter = require('./routes/games');
const authRouter = require('./routes/auth');
const matchesRouter = require('./routes/matches');
const authMiddleware = require('./middlewares/auth');

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/auth", authRouter);
app.use('/games',authMiddleware, gamesRouter, );
app.use('/matches', authMiddleware, matchesRouter,);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
