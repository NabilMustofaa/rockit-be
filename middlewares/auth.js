const jwt = require('jsonwebtoken');
const { db } = require('../config');
const { secret } = require('../config/jwt');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Denied Access',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.id]
    );
    if (result.rowCount === 0) throw new Error('User not found');

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error(err);
    res.status(403).json({
      success: false,
      message: 'Invalid Token',
    });
  }
};

module.exports = verifyToken
