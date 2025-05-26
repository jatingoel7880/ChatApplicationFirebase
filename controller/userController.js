const User = require('../models/userSchema');
const userAuth= require('../firebase')
// Add a new item
exports.googleAuth = async (req, res) => {
  const {idToken}= req.body;
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
        lastLogin: new Date() });
    } else {
      // Optionally update the user's info
      user.name = name;
      user.picture = picture;
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