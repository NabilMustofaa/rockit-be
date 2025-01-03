const Joi = require("joi");

const registerUser = Joi.object({
    username: Joi.string().min(3).max(8).required(),
    pin: Joi.string().min(5).max(7).required(),
  });

module.exports = registerUser