const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  sender: {
    type: String,
    required: true,
    ref: 'User'
  },
  receiver: {
    type: String,
    required: true,
    ref: 'User'
  },
  roomId: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
messageSchema.index({ roomId: 1, createdAt: 1 });
messageSchema.index({ sender: 1, receiver: 1 });

module.exports = mongoose.model('Message', messageSchema); 