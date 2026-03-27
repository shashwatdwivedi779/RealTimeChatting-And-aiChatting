const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    ProductImage: {
        type: String,
    },
    FriendRequest: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSchema'
    }],
    Friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserSchema'
    }],
    Bugs: [{
        type: String,
    }]
})

module.exports = mongoose.model('UserSchema', UserSchema);