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

const socketIO = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

chatHistory=[];

mongoose.connect(process.env.MONGODB_URI, {
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

