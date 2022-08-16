function userData(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'user') {
        req.isLoggedIn = false;
    }
    else {
        req.isLoggedIn = true;
    }
    next();
}

module.exports = userData;