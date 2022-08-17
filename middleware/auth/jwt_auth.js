const jwt = require('jsonwebtoken');

function jwtAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).json({
            error: true,
            message: 'No token provided.'
        });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                error: true,
                message: 'Token is not valid.'
            });
        }
        req.user = user;
        next();
    });
}

module.exports = jwtAuth;