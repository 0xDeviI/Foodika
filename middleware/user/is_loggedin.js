function isLoggedIn(req, res, next) {
    console.log(req.session.user);
    if (req.session.user && req.session.user.role === 'user') {
        return next();
    }
    res.redirect('/signin');
}

module.exports = isLoggedIn;