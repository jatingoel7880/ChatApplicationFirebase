const express = require('express');
const userController  = require('../controller/userController');
const router = express.Router();

// Routes
router.route('/auth/google').post(userController.googleAuth);

module.exports = router;
