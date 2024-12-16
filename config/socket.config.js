const http = require('http');
const socketIo = require('socket.io');
const app = require('../app');

const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {

  socket.on('join', async (userId) => {
    const userfromDB = await User.findById(userId)
    socket.userId = userId;
    socket.join(userId);
    console.log(`${userfromDB.username} joined their room`);

    try {
      const Chats = await Chat.find({ participants: { $in: [userId] } })
      .populate({
        path: 'messages',
        options: { sort: { timestamp: 1 } }
      })
      .populate({
        path: 'participants',
        select: 'username profilePic professional'
      })
      .sort({ lastMessageTimestamp: -1 })
      .lean()
      .exec();
      socket.emit('init', Chats);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('join chat', async (chatId) => {
    socket.join(chatId);
    console.log(`${socket.userId} joined chat ${chatId}`);
  });

  socket.on('private message', async (msg) => {
    const chat = await Chat.findById(msg.chatId)
    const newMessage = new Message({
      sender: msg.sender,
      recipient: msg.recipient,
      message: msg.message,
    });

    try {
      await newMessage.save();
      chat.messages.push(newMessage._id);
      chat.lastMessageTimestamp = newMessage.timestamp;
      await chat.save();
      io.to(msg.chatId).emit('private message', newMessage); // Emit to chat's room
      
      try {
        const rooms = io.sockets.adapter.rooms
        const room = rooms.get(msg.chatId)
        if (room.size === 1) {
          const existingNotif = await Notification.findOne({ source: msg.sender, target: msg.recipient, type: 'message', read: false }) // anti spam
          if (!existingNotif) {
            const notif = await Notification.create({ source: msg.sender, target: msg.recipient, type: 'message' })
            await notif.populate('source')
            const notifObject = notif.toObject();
            notifObject.timeDiff = formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })
            io.to(msg.recipient).emit('notification', notifObject)
          }
        }
      } catch (error) {
        console.error('Error accessing rooms:', error);
      }

    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });

});

module.exports = { server };