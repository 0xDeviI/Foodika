var loginRedirect = require('./login_redirect');
var adminAllowed = require('./admin_allowed');

const adminMiddleware = {
    loginRedirect: loginRedirect,
    adminAllowed: adminAllowed
};

module.exports = adminMiddleware;