const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Slow down brute-force attempts on the single login endpoint.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const expectedUsername = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const inputUsername = (username || '').trim().toLowerCase();
  const validUsername = inputUsername === expectedUsername;

  if (!validUsername) {
    console.warn(`[Auth] Login failed: username "${username}" does not match configured ADMIN_USERNAME "${process.env.ADMIN_USERNAME}".`);
    return res.status(401).json({ error: 'Wrong username or password.' });
  }

  const validPassword = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || '');
  if (!validPassword) {
    console.warn(`[Auth] Login failed: incorrect password for user "${username}".`);
    return res.status(401).json({ error: 'Wrong username or password.' });
  }

  const token = jwt.sign({ sub: username }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });

  res.json({ token });
});

module.exports = router;
