const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const config = require('./config');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const gamesRouter = require('./routes/games');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/games', gamesRouter);



app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
module.exports = app;
