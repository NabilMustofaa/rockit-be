const Joi = require("joi");

const loginScheme = Joi.object({
  username: Joi.string().min(3).max(8).required(),
  pin: Joi.string().min(5).max(7).required(),
});

module.exports = loginScheme;
