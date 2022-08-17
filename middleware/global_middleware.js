var jwtAuth = require('./auth/jwt_auth');

const globalMiddleware = {
    jwtAuth: jwtAuth
};

module.exports = globalMiddleware;