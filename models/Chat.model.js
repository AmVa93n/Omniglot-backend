const mongoose = require('mongoose');
const { Schema } = mongoose;

const chatSchema = new mongoose.Schema({
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
});
  
const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;