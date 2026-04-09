const express = require('express');
const home = express.Router();
const controller = require('../controller/login')
const uploadd = require('../MULTER/multer');
 

home.get('/', controller.GetHome);

home.get('/login', controller.GetLogin);
home.post('/login', controller.PostLogin);
home.get('/signup', controller.GetSignup);
home.post('/signup', controller.PostSignup);
home.get('/chatting', controller.GetChatting);
home.get('/notification', controller.GetNotification);
home.post('/friends', controller.PostFriends);
home.post('/accept', controller.PostAccept);
home.get('/profile', controller.GetProfile);
home.get('/changepass', controller.GetChangepass);
home.post('/changepass', controller.PostChangepass);
home.get('/changeuser', controller.GetChangeuser);
home.post('/changeuser', controller.PostChangeuser);
home.post('/logout', controller.PostLogout);
home.get('/reportbug', controller.GetBugs);
home.post('/reportbug', controller.PostBugs);
home.get('/changeprofilepic', controller.GetProfilepic);
home.post('/profilepic', uploadd.single('ProductImage'), controller.PostProfilepic);
home.post('/search', controller.PostSearch);



module.exports = home;


