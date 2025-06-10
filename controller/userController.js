const User = require('../models/userSchema');
const userAuth = require('../firebase');
const admin = require('../firebase');
const Message = require('../models/messageSchema');

// Helper function to generate consistent roomId
const getRoomId = (email1, email2) => {
  return [email1, email2].sort().join('_');
};

// Add a new item
exports.googleAuth = async (req, res) => {
  const {idToken,fcmToken}= req.body;
  console.log(fcmToken)
  console.log(idToken)
  if(!idToken){
    return res.status(400).json({
      success:false,
      message:"Id Token is required",})
  }
  try{
    const decodedToken= await userAuth.auth().verifyIdToken(idToken);
    console.log(decodedToken)
    const { uid, name, email, picture } = decodedToken;

    // Save or update user in database
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      user = await User.create({ 
        firebaseUid: uid,
        name: name || '',
        email: email || '',
        image: picture || '',
        fcmToken: fcmToken || user.fcmToken,
        lastLogin: new Date() });
    } else {
      // Optionally update the user's info
      user.name = name;
      user.picture = picture;
      user.fcmToken= fcmToken || user.fcmToken;
      user.lastLogin = new Date();
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'User authenticated and saved',
      user,
    });
  } catch (error) {
    console.error('Firebase verification error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token', error: error.message });
  }
};

exports.getAllUsers=async(req,res)=>{
  try{
    const users=await User.find({},'-__v -_id');
    console.log("users", users)
    res.status(200).json({success:true,users});
  }
  catch(err){
    res.status(500).json({success:false,message:"Failed to fetch the users",error:err.message});
  }
}

exports.sendNotification = async (req, res) => {
  const {receiverEmail, senderName, senderEmail, roomId, message, isReceiverInChat} = req.body;
  
  // Validate sender
  const sender = await User.findOne({email: senderEmail});
  if (!sender) {
    return res.status(400).json({success: false, message: "Sender not found"});
  }

  // Validate that senderName matches the authenticated user's name
  if (sender.name !== senderName) {
    return res.status(400).json({success: false, message: "Invalid sender name"});
  }

  const receiver = await User.findOne({email: receiverEmail});
  if (!receiver) {
    return res.status(400).json({success: false, message: "Receiver not found"});
  }

  // Check if receiver has a valid FCM token
  if (!receiver.fcmToken) {
    console.log('Receiver has no FCM token, skipping notification');
    return res.status(200).json({success: true, message: 'Message saved, notification skipped - no FCM token'});
  }

  const currentTime = new Date().toISOString();
  const consistentRoomId = getRoomId(senderEmail, receiverEmail);

  // Check if message already exists with a time window
  const existingMessage = await Message.findOne({
    text: message,
    sender: senderEmail,
    receiver: receiverEmail,
    roomId: consistentRoomId,
    createdAt: {
      $gte: new Date(currentTime).getTime() - 2000, // Within 2 seconds
      $lte: new Date(currentTime).getTime() + 2000
    }
  });

  if (existingMessage) {
    console.log('Message already exists, skipping save');
  } else {
    // Store the message in the database
    try {
      const newMessage = new Message({
        text: message,
        sender: senderEmail,
        receiver: receiverEmail,
        roomId: consistentRoomId,
        createdAt: currentTime
      });
      await newMessage.save();
    } catch (error) {
      console.error('Failed to save message:', error);
      return res.status(500).json({success: false, message: 'Failed to save message', error: error.message});
    }
  }

  // Only send notification if receiver is not in chat
  if (!isReceiverInChat) {
    console.log('Sending notification as receiver is not in chat');
    const payload = {
      token: receiver.fcmToken,
      notification: {
        title: `Message from ${senderName}`,
        body: message || 'New message',
        android: {
          channelId: 'chat_messages',
          priority: 'high',
          sound: 'default',
          icon: 'ic_notification',
          color: '#4f8cff',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          visibility: 'public',
          importance: 'high',
          pressAction: {
            id: 'default',
          },
        },
        apns: {
          sound: 'default',
          badge: 1,
          contentAvailable: true,
          mutableContent: true,
          category: 'chat_message',
        },
      },
      data: {
        roomId: consistentRoomId,
        senderName: senderName,
        senderEmail: senderEmail,
        message: message,
        timestamp: currentTime,
        type: 'chat_message',
        text: message,
        sender: senderEmail,
        receiver: receiverEmail,
        createdAt: currentTime,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      }
    };

    try {
      const response = await admin.messaging().send(payload);
      console.log('Notification sent successfully:', response);
      return res.status(200).json({success: true, messageId: response});
    } catch (error) {
      console.error('Failed to send notification:', error);
      
      // Handle specific Firebase Messaging errors
      if (error.code === 'messaging/registration-token-not-registered') {
        try {
          // Remove invalid token and update user's record
          await User.updateOne(
            { email: receiverEmail },
            { $unset: { fcmToken: 1 } }
          );
          console.log('Removed invalid FCM token for user:', receiverEmail);
          
          return res.status(200).json({
            success: true,
            message: 'Message saved, notification failed - invalid token removed',
            error: error.message
          });
        } catch (updateError) {
          console.error('Failed to remove invalid FCM token:', updateError);
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Message saved, notification failed',
        error: error.message
      });
    }
  } else {
    console.log('Skipping notification as receiver is in chat');
    return res.status(200).json({success: true, message: 'Message saved, notification skipped as receiver is in chat'});
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required"
      });
    }

    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

exports.saveMessage = async (req, res) => {
  try {
    const { text, sender, receiver, roomId, createdAt, status } = req.body;

    if (!text || !sender || !receiver || !roomId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const newMessage = new Message({
      text,
      sender,
      receiver,
      roomId,
      createdAt: createdAt || new Date(),
      status: status || 'sent'
    });

    const savedMessage = await newMessage.save();

    return res.status(200).json({
      success: true,
      message: savedMessage
    });
  } catch (error) {
    console.error('Failed to save message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save message',
      error: error.message
    });
  }
};

exports.updateFcmToken = async (req, res) => {
  try {
    const { email, fcmToken } = req.body;
    
    if (!email || !fcmToken) {
      return res.status(400).json({
        success: false,
        message: "Email and FCM token are required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.fcmToken = fcmToken;
    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "FCM token updated successfully"
    });
  } catch (error) {
    console.error('Failed to update FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update FCM token',
      error: error.message
    });
  }
};

// exports.sendMessage=async(req,res)=>{
  //     const {receiveEmail, senderName, chatId, message }= req.body();
  //     const receiver=await User.findOne({email: receiveEmail});
  //     if(!receiver || !receiver.fcmToken){
  //       return res.status(400).json({success:false,message:"User or token not found"})
  //     }
  //       const payload={
  //         token:receiver.fcmToken,
  //         notification:{
  //           title:`Message from ${senderName}`,
  //           body:message|| 'New message',
  //           data:{
  //             chatId:chatId,
  //         },
  //     }
  //     try{
  //         const res=await admin.messaging().send(payload);
  //         console.log(res)
  //         return res.status(200).json({success:true,messageId:res})
  //     }
  //         catch(error){
  //             return res.status(400).json({success:false, message: 'Failed to send message', error})
  //           }
  //         }
  //     }

//  try {
//     const { name } = req.body;
//     if (!name) {
//       return res.status(400).json({ message: 'Name is required' });
//     }

//     const newUser = new User({ name });
//     await newUser.save();
//     res.status(201).json(newUser);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error while creating item' });
//   }