const http = require('http');
const socketIo = require('socket.io');
const app = require('../app');

const server = http.createServer(app);
const io = socketIo(server);

const User = require('../models/User.model');
const Chat = require('../models/Chat.model');
const Message = require('../models/Message.model');
const Notification = require('../models/Notification.model');

io.on('connection', (socket) => {

  socket.on('online', async (user) => {
    socket.username = user.username;
    socket.join(user._id);
    console.log(`${user.username} is online`);
    const chats = await Chat.find({ participants: user._id })
    for (let chat of chats) {
      socket.join(chat._id);
      console.log(`${user.username} joined chat ${chat._id}`);
    }
  });

  socket.on('message', async (msg) => {
    const message = await Message.create(msg);
    io.to(msg.chatId).emit('newMessage', message);

    const rooms = io.sockets.adapter.rooms
    const room = rooms.get(msg.chatId)
    if (room.size === 1) {
      const existingNotif = await Notification.findOne({ source: msg.sender, target: msg.recipient, type: 'message', read: false }) // anti spam
      if (!existingNotif) {
        const notification = await Notification.create({ source: msg.sender, target: msg.recipient, type: 'message' }).lean()
        await notification.populate('source').lean()
        notification.timeDiff = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
        io.to(msg.recipient).emit('newNotification', notification)
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`${socket.username} disconnected`);
  });

});

module.exports = { server };