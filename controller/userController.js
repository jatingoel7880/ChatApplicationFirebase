const User = require('../models/userSchema');
const userAuth = require('../firebase');
const admin = require('../firebase');

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

exports.sendMessage = async (req, res) => {
  const {receiveEmail, senderName, senderEmail, roomId, message} = req.body;
  
  // Validate sender
  const sender = await User.findOne({email: senderEmail});
  if (!sender) {
    return res.status(400).json({success: false, message: "Sender not found"});
  }

  // Validate that senderName matches the authenticated user's name
  if (sender.name !== senderName) {
    return res.status(400).json({success: false, message: "Invalid sender name"});
  }

  const receiver = await User.findOne({email: receiveEmail});
  if (!receiver || !receiver.fcmToken) {
    return res.status(400).json({success: false, message: "User or token not found"});
  }

  const currentTime = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

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
        color: '#4f8cff'
      }
    },
    data: {
      roomId: roomId,
      senderName: senderName,
      senderEmail: senderEmail,
      message: message,
      timestamp: currentTime
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'chat_messages',
        priority: 'high',
        sound: 'default',
        icon: 'ic_notification',
        color: '#4f8cff',
        body: message || 'New message'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          alert: {
            title: `Message from ${senderName}`,
            body: message || 'New message'
          }
        }
      }
    }
  };

  try {
    const response = await admin.messaging().send(payload);
    console.log('Notification sent successfully:', response);
    return res.status(200).json({success: true, messageId: response});
  } catch (error) {
    console.error('Failed to send notification:', error);
    return res.status(400).json({success: false, message: 'Failed to send message', error: error.message});
  }
};


// exports.sendMessage=async(req,res)=>{
  //     const {receiveEmail, senderName, roomId, message }= req.body();
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
  //             roomId:roomId,
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