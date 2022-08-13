function loginRedirect(req, res, next) {
    var _url = req.originalUrl;
    _url = _url.split('/');
    _url = _url[_url.length - 1];
    if (_url === 'signin') {
        if (!req.session.user) {
            return next();
        }
        res.redirect('/dashboard');
    }
    else {
        if (req.session.user && req.session.user.role === 'user') {
            return next();
        }
        res.redirect('/signin');
    }
}

module.exports = loginRedirect;