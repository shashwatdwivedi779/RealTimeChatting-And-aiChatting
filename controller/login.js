const UserSchema = require('../Model/UserSchema');
const jwt = require('jsonwebtoken');
const Message = require('../Model/Message');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const Fuse = require('fuse.js');


exports.GetHome = async (req, res) => {
     const Users = await UserSchema.find();
    const currentUser = await UserSchema.findById(req.userId);
    res.render('homepage', { 
        Users,
        currentUser,
        OldInput: ''
    });
}


exports.GetLogin = async (req, res) => {
    res.render('login', { isLoggedIn: false,  errors: [], OldInput: {email: ''}});
}

exports.PostLogin = async (req, res) => {
    const { email, password } = req.body;
    const usermail = await UserSchema.findOne({email: email.trim()});
    if(!usermail){
        return res.status(422).render('login', {
            isLoggedIn: false,
            errors: ['User Does Not Exist !'],
            OldInput: { email },
            user: {}
        });}
    const isMatch = await bcrypt.compare(password, usermail.password)
    if(!isMatch){
       return res.status(422).render('login', {
            isLoggedIn: false,
            errors: ['Invalid Password !'],
            OldInput: { email },
            user: {} }
       )}
    
    //token create
    const token = jwt.sign({
        userId: usermail._id,
        username: usermail.username,
        email: usermail.email
    }, process.env.KEY, { expiresIn: '100h' });
    res.cookie('token', token, {httpOnly: true});
    res.redirect('/');
}

exports.GetSignup = async (req, res) => {
     res.render('signup', { isLoggedIn: false, errors: [],
        OldInput: {name: "",email: ""}
     });
}
exports.PostSignup = [
    check('username')
    .notEmpty()
    .withMessage('Name is required'),

    check('email')
    .notEmpty()
    .withMessage('email required')
    .isEmail()
    .withMessage('inter valid e-mail')
    .normalizeEmail(),

    check('password')
    .matches(/[!@&]/)
    .withMessage('password contains atleast one special corrector')
    .trim(),

    check('confirmPassword')
    .trim()
    .custom((value, { req }) => {
        if(value !== req.body.password){
            throw new Error('Password do not matched');
        } 
        return true;
    }),

    async (req, res, next) => {
        const { username, email, password } = req.body;
        const errors = validationResult(req);
        const existingUser = await UserSchema.findOne({ email });

            if (existingUser) {
          return res.status(422).render('signup', { activePage: 'signup',
            errors: ["Email already exists"],
            OldInput: { username, email }
          });}


        if(!errors.isEmpty()){
            return res.status(402).render('signup', {
                isLoggedIn: false,
                errors: errors.array().map( err => err.msg ),
                OldInput: {username: '', email:''},
                user: {}
            })}
        bcrypt.hash(password, 12).then(hashedpass => {
            const User = new UserSchema ({ username, email, password: hashedpass.trim() });
            return User.save();
        }).then(() => {
            res.redirect('/login');
        }).catch(err => {
            console.log('error on Post Sign', err);
            res.redirect('/signup')
        })
    
    }
]

exports.GetChatting = async (req, res) => {
  try {
    const current = await UserSchema.findById(req.userId)
      .populate('Friends');
    

    const friendsWithUnseen = await Promise.all(
      current.Friends.map(async (friend) => {

        const unseenCount = await Message.countDocuments({
          sender: friend._id,
          receiver: req.userId,
          seen: false
        });

        return {
          ...friend.toObject(),
          unseenCount
        };
      })
    );

    res.render('chatting', { current: friendsWithUnseen });

  } catch (err) {
    console.log(err);
  }
};



exports.GetNotification = async (req, res) => {
    try {
        const currentUser = await UserSchema.findById(req.userId)
            .populate('FriendRequest');

        res.render('notification', { currentUser });

    } catch (err) {
        console.log(err);
    }
};

exports.PostFriends = async (req, res) => {
    try{
    const userid = req.body.userid;
     const userdata = await UserSchema.findById(userid);
     // duplicate check
        if (!userdata.FriendRequest.includes(req.userId)) {
            userdata.FriendRequest.push(req.userId);
            await userdata.save();
        }
        res.render('Success', { Message: 'Friend Request Send', Back: '/'});
    } catch(err){
        console.log(err);
        res.redirect('/');
    }
}

exports.PostAccept = async (req, res) => {
    try {
        const userid = req.body.userId;

        const userdata = await UserSchema.findById(userid);     // jisne request bheji
        const selfdata = await UserSchema.findById(req.userId); // tu

        if (!userdata || !selfdata) {
            console.log("User not found");
            return res.redirect('/notification');
        }

        // ✅ add friend both side
        if (!userdata.Friends.some(id => id.toString() === req.userId.toString())) {
            userdata.Friends.push(req.userId);
        }

        if (!selfdata.Friends.some(id => id.toString() === userid.toString())) {
            selfdata.Friends.push(userid);
        }

        // ✅ remove request BOTH SIDE (important)
        userdata.FriendRequest.pull(req.userId);
        selfdata.FriendRequest.pull(userid);

        await userdata.save();
        await selfdata.save();

        res.redirect('/notification');

    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
};

exports.GetProfile = async (req, res) => {
  try {
    const selfdata = await UserSchema.findById(req.userId); 
    res.render('profile', {user: selfdata});
  } catch(err){
    console.log(err);
    res.redirect('/');
  }
}

exports.GetChangepass = async (req, res) => {
    try {
        res.render('changepass', { changepass: true, errors: []});
    } catch(err) {
        console.log(err);
        res.redirect('/')
    }
}

exports.PostChangepass = [
     check('password')
    .matches(/[!@&]/)
    .withMessage('password contains atleast one special corrector')
    .trim(),

    check('confirmPassword')
    .trim()
    .custom((value, { req }) => {
        if(value !== req.body.password){
            throw new Error('Password do not matched');
        } 
        return true;
    }),
    
    
    
    async (req, res) => {
    try { const newpass = req.body.password;
        const errors = validationResult(req);
    const finalpass = await bcrypt.hash(newpass, 12);

    

        if(!errors.isEmpty()){
            return res.status(402).render('signup', {
                isLoggedIn: false,
                errors: errors.array().map( err => err.msg ),
                OldInput: {username: '', email:''},
                user: {}
            })}

   await UserSchema.findByIdAndUpdate(req.userId,{
        password: finalpass
   });
   res.render('Success', { Message: 'Password Changed', Back: '/profile'});
} catch(err){
    console.log(err);
    res.status(500).send("Something went wrong");
}
}]

exports.GetChangeuser = async (req, res) => {
    try {
        res.render('changepass', { changepass: false, errors: []});
    } catch(err) {
        console.log(err);
        res.redirect('/')
    }
}

exports.PostChangeuser = async (req, res) => {
    try { const newuser = req.body.username;
   await UserSchema.findByIdAndUpdate(req.userId,{
        username: newuser
   });
   res.render('Success', { Message: ' UserName Changed ', Back: '/profile'});
} catch(err){
    console.log(err);
    res.status(500).send("Something went wrong");
}
}

exports.PostLogout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
}

exports.GetBugs = (req, res) => {
    res.render('bugs');
}

exports.PostBugs = async (req, res) => {
    const bugs = req.body.Bugs;
    const user = await UserSchema.findById(req.userId);
    user.Bugs.push(bugs);
    await user.save();
    res.render('Success', { Message: 'Submitted Bugs', Back: '/profile'});
}


exports.GetProfilepic = async (req, res) => {
    res.render('profilepicture');
}


exports.PostProfilepic = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }

        const user = await UserSchema.findById(req.userId);

        if (!user) {
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(404).send('User not found');
        }

        // old image name save kar lo
        const oldImage = user.ProductImage;

        // new image filename save karo
        user.ProductImage = req.file.filename;
        await user.save();

    
        // old image delete karo
        if (oldImage) {
            const cleanOldImage = path.basename(oldImage); 
            const oldImagePath = path.join(__dirname, '..', 'Uploads', cleanOldImage);

            try {
                await fs.unlink(oldImagePath);
            } catch (err) {
                
            }
        }

        return res.render('success', {
            Message: 'Profile Picture Uploaded',
            Back: '/profile'
        });

    } catch (error) {
        // agar beech me error aaye to nayi uploaded file hata do
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }

        console.error('Profile upload error:', error);
        return res.status(500).send('Server error');
    }
};


exports.PostSearch = async (req, res) => {
    try{
    const SearchName = req.body.search ;
    const currentUser = req.userId;

    const AllUsers = await UserSchema.find( {}, {
        username: 1,
        email: 1,
        ProductImage: 1
    }).lean();

    const fuse = new Fuse( AllUsers, {
        keys: [
            {name: 'username', weight: 1}
        ],
        includeScore: true,
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 3
    })

    const Names = fuse.search(SearchName);
    const result = Names.map(name => name.item);

    res.render('search', {
        result, OldInput: SearchName, currentUser
    })

    } catch(err){
        console.log(err);
    }

}
