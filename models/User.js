const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        length: 11
    }
});

const User = mongoose.model('User', UserSchema);
module.exports = User;