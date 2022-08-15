const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FoodSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: false,
        maxlength: 512
    },
    image: {
        type: String,
        required: false
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'FoodCategory'
    },
    isAvailable: {
        type: Boolean,
        required: true,
        default: true
    }
});

const Food = mongoose.model('Food', FoodSchema);
module.exports = Food;