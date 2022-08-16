var loginRedirect = require('./login_redirect');
var userData = require('./user_data');

const userMiddleware = {
    loginRedirect: loginRedirect,
    userData: userData
};

module.exports = userMiddleware;