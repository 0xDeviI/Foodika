const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OTPSchema = new Schema({
    user_id: {
        type: String,
        required: false
    },
    phone: {
        type: String,
        required: true,
        length: 11
    },
    otp: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

const OTP = mongoose.model('OTP', OTPSchema);
module.exports = OTP;