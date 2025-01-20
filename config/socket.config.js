const http = require('http');
const socketIo = require('socket.io');
const app = require('../app');

const server = http.createServer(app);
const io = socketIo(server);

const Chat = require('../models/Chat.model');
const Message = require('../models/Message.model');
const Notification = require('../models/Notification.model');
const { formatDistanceToNow } = require('date-fns');

io.on('connection', (socket) => {

  socket.on('online', async (user) => {
    socket.username = user.username;
    socket.join(user._id);
    console.log(`${user.username} is online`);
    const chats = await Chat.find({ participants: user._id }).lean();
    for (let chat of chats) {
      socket.join(chat._id.toString());
    }
  });

  socket.on('message', async (msg) => {
    const message = await Message.create({...msg, timestamp: new Date()})
    io.to(msg.chat).emit('newMessage', message.toObject());
    
    const rooms = io.sockets.adapter.rooms
    const room = rooms.get(msg.chat)
    if (room?.size === 1) {
      const existingNotif = await Notification.findOne({ source: msg.sender, target: msg.recipient, type: 'message', read: false }) // anti spam
      if (!existingNotif) {
        const notification = await Notification.create({ source: msg.sender, target: msg.recipient, type: 'message' })
        await notification.populate('source')
        const notifObj = notification.toObject()
        notifObj.timeDiff = formatDistanceToNow(new Date(notifObj.createdAt), { addSuffix: true })
        io.to(msg.recipient).emit('newNotification', notifObj)
      }
    }
    
  });

  socket.on('notification', async (notif) => {
    const notification = await Notification.create({...notif, read: false})
    await notification.populate('source', 'username profilePic')
    const notifObj = notification.toObject()
    notifObj.timeDiff = formatDistanceToNow(new Date(notifObj.createdAt), { addSuffix: true })
    io.to(notif.target).emit('newNotification', notifObj)
  });

  socket.on('disconnect', () => {
    console.log(`${socket.username} disconnected`);
  });

});

module.exports = { server };