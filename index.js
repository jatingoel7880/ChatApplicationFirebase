require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const http = require("http").Server(app);
const userRouter = require('./router/userRouter');
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
  app.use(cors({
    origin: "*",
    credentials: true,  
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization']
  }));

const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

const messages={};
const onlineUsers = {}; // { email: socket.id }
io.on('connection', (socket)=>{
  console.log('A user connected',socket.id);
  
  socket.on('usersOnline',(email)=>{
    onlineUsers[email]=socket.id;
    io.emit('updateUserStatus',{email,status:'online'});
  });

  socket.on('disconnect',()=>{
    const email=Object.keys(onlineUsers).find(key=> onlineUsers[key]=== socket.id);
    if(email){
      delete onlineUsers[email];
      io.emit('updateUserStatus', {email,status:'offline'});
    }
  });

  socket.on('joinRoom',(roomId)=>{
    socket.join(roomId);
    //send previous message
    if(messages[roomId]){
      socket.emit('previousMessages', messages[roomId]);
    }
  });

  socket.on("sendMessages", (msg)=>{
    const {sender,receiver,text, createdAt, roomId}=msg;
    if(!messages[roomId]) messages[roomId]=[];
    messages[roomId].push({sender, receiver,text,createdAt});
    io.to(roomId).emit('receiveMessage',{sender, receiver, text, createdAt});
  });

  socket.on("disconnect",()=>{
    console.log('User Disconnected', socket.id)
  })
})

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
  res.json({online:Object.keys(onlineUsers)});
});

http.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});

