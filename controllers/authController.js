const User = require('../models/User');
const jwt  = require('jsonwebtoken');

async function register(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username & password required' });
    }
    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ error: 'Username taken' });
    }
    const user = new User({ username, password });
    await user.save();
    res.json({ success: true });
    console.log("new user hass been created")
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
} 
async function login(req, res) {  
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login };
