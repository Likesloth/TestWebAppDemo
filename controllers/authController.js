// controllers/authController.js

const User       = require('../models/User');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const RESET_SECRET = process.env.JWT_RESET_SECRET;
const RESET_BASE   = process.env.RESET_LINK_BASE_URL;
const RESET_EXPIRY = '15m'; // token valid for 15 minutes

const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   465,        // SSL
  secure: true,       // use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // your 16-char App Password
  }
});

transporter.verify((err, success) => {
  if (err) console.error('❌ SMTP connection error:', err);
  else console.log('✅ SMTP server is ready to take messages');
});

// 1) Register a new user
async function register(req, res) {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password required' });
    }
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(400).json({ error: 'Username or email already taken' });
    }
    const user = new User({ username, email, password });
    await user.save();
    console.log('🔐 new user created:', user._id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// 2) Log in and issue JWT
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
    return res.json({ success: true, token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// 3) Send the “forgot password” email link
async function resetForgetPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      // avoid revealing whether the email exists
      return res.json({ success: true });
    }
    const token = jwt.sign(
      { userId: user._id },
      RESET_SECRET,
      { expiresIn: RESET_EXPIRY }
    );
    const resetLink = `${RESET_BASE}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: '"BlackBoxTestGen Support" <no-reply@yourapp.com>',
      to: user.email,
      subject: 'BlackBoxTestGen Password Reset Request',
      text: `
Hi ${user.username},

We received a request to reset the password for your BlackBoxTestGen account.

Please visit the following link to reset your password:
${resetLink}

If you didn’t request this, simply ignore this email and no changes will be made.

Thanks,
BlackBoxTestGen Support
      `,
      html: `
<div style="font-family: Arial, sans-serif; color: #333; max-width:600px; margin:auto;">
  <h2 style="color:#1a73e8;">BlackBoxTestGen Password Reset</h2>
  <p>Hi ${user.username},</p>
  <p>We received a request to reset your password. Click the button below to choose a new password:</p>
  <p style="text-align:center;">
    <a href="${resetLink}"
       style="
         background-color: #1a73e8;
         color: #ffffff;
         padding: 12px 20px;
         text-decoration: none;
         border-radius: 4px;
         display: inline-block;
       ">
      Reset Password
    </a>
  </p>
  <p>If the button above doesn’t work, copy and paste this URL into your browser:</p>
  <p><a href="${resetLink}" style="color:#1a73e8;">${resetLink}</a></p>
  <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
  <p>If you didn’t request a password reset, you can safely ignore this email.</p>
  <p>Thanks,<br>BlackBoxTestGen Support</p>
</div>
      `
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// 4) Consume the link’s token and set the new password
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and newPassword are required.' });
    }
    let payload;
    try {
      payload = jwt.verify(token, RESET_SECRET);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    user.password = newPassword;  // UserSchema will validate & hash
    await user.save();
    return res.json({ success: true, message: 'Password has been reset.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  register,
  login,
  resetForgetPassword,
  resetPassword
};
