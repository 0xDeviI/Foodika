const validator = {
    isValidUsername: (username) => {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    },
    isValidPassword: (password) => {
        return /^[a-zA-Z0-9_!@#${}:>]{3,}$/.test(password);
    },
    isValidName: (name) => {
        return /^[\u0600-\u06FF\s\d]+$/.test(name);
    },
    isValidObjectId: (objectId) => {
        return /^[0-9a-fA-F]{24}$/.test(objectId);
    },
    isValidPrice: (price) => {
        return /^[0-9]{1,10}$/.test(price);
    },
    isValidNumber: (price) => {
        return /^[0-9]{1,10}$/.test(price);
    },
    isValidFoodDescription: (description) => {
        return /^[\u0600-\u06FF\s\d\.,،:'"*()-_+=]+$/.test(description);
    }
};

module.exports = validator;