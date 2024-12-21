const validate = (schema) => (req, res, next) => {
  const data = req.body;

  const { error } = schema.validate(data, { abortEarly: false });

  if (error) {
    const errors = error.details.map((detail) => ({
      message: detail.message,
      path: detail.path[0],
    }));

    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors,
    });
  }

  next();
};
module.exports = validate;