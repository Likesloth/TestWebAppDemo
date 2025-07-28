// routes/auth.js
const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');

// Signup
router.post('/register',               authController.register);

// Login
router.post('/login',                  authController.login);

// Request a reset‐link email
router.post('/sent-request-forget-password', authController.resetForgetPassword);

// Submit new password via that link
router.post('/reset-password',         authController.resetPassword);

module.exports = router;
