const express = require('express');
const userController  = require('../controller/userController');
const router = express.Router();

// Routes
router.route('/auth/google').post(userController.googleAuth);

router.route('/send-message').post(userController.sendMessageNotification);

router.route('/users').get(userController.getAllUsers);

module.exports = router;
