const Joi = require("joi");

const createUserScheme = Joi.object({
    username: Joi.string().min(3).max(100).required(),
    pin: Joi.string().min(5).max(7).required(),
  });

module.exports = createUserScheme