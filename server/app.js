require("dotenv").config();

// ================= IMPORTS =================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const Groq = require("groq-sdk");

// Local Modules
const UTILS = require('../utils/path');
const auth = require('../controller/auth');
const home = require('../Router/router');
const User = require('../Model/UserSchema');
const Message = require('../Model/Message');

// ================= APP SETUP =================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DB_URI = process.env.DB_URL;

// ================= MIDDLEWARE =================
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(UTILS, 'Public')));
app.use('/uploads', express.static(path.join(UTILS, 'Uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'Views'));

// 🔐 Auth Middleware (sets req.userId, req.isLoggedIn)
app.use(auth);

// 🌍 Global Login Status
app.use((req, res, next) => {
  res.locals.isLoggedIn = req.isLoggedIn;
  next();
});

// 👤 Attach User to Request + Views
app.use(async (req, res, next) => {
  try {
    if (req.userId) {
      const user = await User.findById(req.userId);
      req.user = user;
      res.locals.user = user || {};
    } else {
      req.user = null;
      res.locals.user = {};
    }
    next();
  } catch (err) {
    console.log('User Middleware Error:', err);
    next();
  }
});

// 🔒 Protect Chat Routes
app.use(['/chattingroom', '/notification', '/chatting'], (req, res, next) => {
  if (req.isLoggedIn && req.user) return next();
  return res.redirect('/login');
});

// ================= ROUTES =================
app.use(home);

// 💬 Chat Room Route
app.get('/chattingroom/:id', async (req, res) => {
  try {
    const receiver = await User.findById(req.params.id);
    const receiverId = req.params.id;

    // Safety check
    if (!req.user) {
      return res.redirect('/login');
    }

    // 📥 Load previous messages
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id }
      ]
    }).sort({ createdAt: 1 });

    res.render('chattingroom', {
      receiverId,
       receiverName: receiver.username,
      user: req.user,
      messages,
      receiver
    });

  } catch (err) {
    console.log('Chat Route Error:', err);
    res.redirect('/');
  }
});


app.get('/aiChatting', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.redirect('/login');
    }

    res.render('aiChat', {
      user: user
    });

  } catch (err) {
    next(err);
  }
});



// ================= SOCKET.IO =================
let onlineUsers = {};

io.on('connection', (socket) => {

  // -------- User To User -----------
  socket.on('join_room', async ({ senderId, receiverId }) => {
    onlineUsers[senderId] = socket.id;

    const room = [senderId, receiverId].sort().join('_');
    socket.join(room);

    if (onlineUsers[receiverId]) {
      io.to(onlineUsers[receiverId]).emit('user_online');
      socket.emit('user_online');
    }

    await Message.updateMany(
      {
        sender: receiverId,
        receiver: senderId,
        seen: false
      },
      {
        $set: { seen: true }
      }
    );
  });

  socket.on('send_message', async ({ senderId, receiverId, text }) => {
    try {
      const room = [senderId, receiverId].sort().join('_');

      await Message.create({
        sender: senderId,
        receiver: receiverId,
        text,
        seen: false
      });

      io.to(room).emit('receive_message', {
        senderId,
        text,
        createdAt: new Date()
      });

    } catch (err) {
      console.log('Message Error:', err);
    }
  });

  // -------- User To AI -----------

   const groq = new Groq({
  apiKey: process.env.AI_KEY
});


  socket.on("AI_room", ({ senderId }) => {
  const room = `ai_${senderId}`;
  socket.join(room);
});

socket.on("ai_message", async ({ senderId, text }) => {
  try {
    const room = `ai_${senderId}`;

    if (!text || !text.trim()) {
      return socket.emit("ai_response", {
        text: "Message empty hai.",
        createdAt: new Date()
      });
    }

    // user ka message save
    await Message.create({
      sender: senderId,
      receiver: null,
      text: text.trim()
    });

    // Groq AI response
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant inside a social chat app. Reply clearly and naturally."
        },
        {
          role: "user",
          content: text.trim()
        }
      ],
      temperature: 0.7,
      max_tokens: 700
    });

    const aiReply =
      completion.choices?.[0]?.message?.content || "No response from AI.";

    // AI response save
    await Message.create({
      sender: null,
      receiver: senderId,
      text: aiReply
    });

    io.to(room).emit("ai_response", {
      text: aiReply,
      createdAt: new Date()
    });

  } catch (err) {
    console.log("Groq AI Message Error:", err);

    socket.emit("ai_response", {
      text: "AI se response lane me error aa gaya.",
      createdAt: new Date()
    });
  }
});

  socket.on('disconnect', () => {
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        socket.broadcast.emit('user_offline');
        delete onlineUsers[userId];
      }
    }
  });
});

// ------Multer Storage------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'Uploads'));
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `Pro-${req.userId}-${Date.now()}-${ext}`);
  }
})

const FileFilter = ((req, file, cb) => {
  if(['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)){
    cb(null, true);
  } else {
    cb(new Error('invalid file'), false);
  }
})

const uploadd = multer({storage, FileFilter});




app.use((req, res, next) => {
  res.status(404).send(' Sorry !! , Page Not Found' )
})

// ================= DATABASE + SERVER =================
const PORT = process.env.PORT || 3000
mongoose.connect(DB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');

    server.listen(PORT,'0.0.0.0', () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => console.log('❌ DB Connection Error:', err));
