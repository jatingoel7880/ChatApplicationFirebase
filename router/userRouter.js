const express = require('express');
const userController  = require('../controller/userController');
const router = express.Router();

// Routes
router.route('/auth/google').post(userController.googleAuth);

router.route('/send-notification').post(userController.sendNotification);

router.route('/messages/:roomId').get(userController.getMessages);

router.route('/messages').post(userController.saveMessage);

router.route('/users').get(userController.getAllUsers);


module.exports = router;


// 