const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FoodCategorySchema = new Schema({
    name: {
        type: String,
        required: true
    }
});

const FoodCategory = mongoose.model('FoodCategory', FoodCategorySchema);
module.exports = FoodCategory;