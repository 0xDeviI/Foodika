const mongoose = require('mongoose');
const Order = require('../../models/Order');

function userData(req, res, next) {
    var _userData = {};
    // check user login status
    if (!req.session.user || req.session.user.role !== 'user') {
        _userData.isLoggedIn = false;
    }
    else {
        _userData.isLoggedIn = true;
    }
    // check user orders status
    if (_userData.isLoggedIn) {
        var _userId = req.session.user._id;
        Order.find({ user: _userId, paymentStatus: 'pending' }, function (err, orders) {
            if (!err) {
                let foods = 0;
                for (let i = 0; i < orders.length; i++) {
                    for (let j = 0; j < orders[i].foods.length; j++) {
                        foods += orders[i].foods[j].quantity;
                    }
                }
                _userData.orders = orders;
                _userData.foods = foods;
            }
        });
    }

    // final user data
    req.userData = _userData;
    next();
}

module.exports = userData;