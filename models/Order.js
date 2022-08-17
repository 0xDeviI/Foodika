const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    foods: [{
        food: {
            type: Schema.Types.ObjectId,
            ref: 'Food',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            default: 1
        }
    }],
    status: {
        type: String,
        default: 'pending',
        required: true,
        enum: ['pending', 'on the way', 'done']
    },
    paymentStatus: {
        type: String,
        default: 'pending',
        required: true
    },
    paymentMethod: {
        type: String,
        default: 'online',
        required: true,
        enum: ['online', 'pay on delivery', 'pay in store']
    },
    paymentId: {
        type: String,
        required: false
    },
    bankRefId: {
        type: String,
        required: false
    },
    amount: {
        type: Number,
        required: false
    }
});

module.exports = mongoose.model('Order', OrderSchema);