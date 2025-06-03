require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const userRoutes = require('./route/userRouter');
const Message = require('./models/messageSchema');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', userRoutes);

// Socket.IO connection handling
const onlineUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user online status
  socket.on('userOnline', (email) => {
    onlineUsers[email] = socket.id;
    io.emit('userStatus', { email, status: 'online' });
  });

  socket.on('disconnect', () => {
    const email = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);
    if(email) {
      delete onlineUsers[email];
      io.emit('updateUserStatus', {email, status: 'offline'});
    }
  });

  socket.on('joinRoom', async (roomId) => {
    console.log('User joining room:', roomId);
    socket.join(roomId);
    
    try {
      // Fetch messages from database
      const messages = await Message.find({ roomId })
        .sort({ createdAt: 1 })
        .lean();
      
      console.log('Sending previous messages for room:', roomId);
      socket.emit('previousMessages', messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      socket.emit('previousMessages', []);
    }
  });

  socket.on("sendMessages", async (msg) => {
    console.log('Received message:', msg);
    const {sender, receiver, text, createdAt, roomId} = msg;
    
    try {
      // Check if message already exists
      const existingMessage = await Message.findOne({
        text,
        sender,
        receiver,
        roomId,
        createdAt: new Date(createdAt)
      });

      if (!existingMessage) {
        // Save message to database
        const newMessage = new Message({
          text,
          sender,
          receiver,
          roomId,
          createdAt: new Date(createdAt),
          status: 'sent'
        });
        
        const savedMessage = await newMessage.save();
        console.log('Message saved to database:', savedMessage);
        
        // Broadcast to all users in the room
        io.to(roomId).emit('receiveMessage', savedMessage);
        
        // Update message status to delivered for receiver if online
        if (onlineUsers[receiver]) {
          savedMessage.status = 'delivered';
          await savedMessage.save();
          io.to(roomId).emit('messageStatus', {
            messageId: savedMessage._id,
            status: 'delivered'
          });
        }
      } else {
        console.log('Message already exists in database, skipping save');
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('markAsRead', async ({ roomId, messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (message) {
        message.status = 'read';
        await message.save();
        io.to(roomId).emit('messageStatus', {
          messageId,
          status: 'read'
        });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

app.use('/api/v1', userRouter);

app.get("/api/v1", (req, res) => {
  res.send('Socket Io chat server running');
});

app.get("/api/v1/online-users", (req, res) => {
  res.json({online: Object.keys(onlineUsers)});
});

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});