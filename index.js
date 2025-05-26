const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const http = require("http").Server(app);
const userRouter = require('./router/userRouter');
const admin= require("./firebase");

app.use(express.urlencoded({ extended: true }));
// app.use(cors());
  app.use(cors({
    origin: "*",
    credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
  }));
app.use(express.json());

const socketIO = require("socket.io")(http, {
  cors: {
    origin: "*", // Allow all origins (safe for mobile apps)
    methods: ["GET", "POST"]
  },
});
const PORT = 4000;
chatHistory=[];

mongoose.connect('mongodb://localhost:27017/ChatApplication', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

app.use('/api/v1', userRouter);

app.get("/api", (req, res) => {
  res.json(chatHistory);
});

http.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});

