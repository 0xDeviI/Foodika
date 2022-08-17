function loginRedirect(req, res, next) {
    var _url = req.originalUrl;
    _url = _url.split('/');
    _url = _url[_url.length - 1];
    if (_url === 'signin') {
        if (!req.session.user || req.session.user.role !== 'user') {
            return next();
        }
        res.redirect('/dashboard');
    }
    else if (_url === 'signup') {
        if (!req.session.user || req.session.user.role !== 'user') {
            return next();
        }
        res.redirect('/dashboard');
    }
    else if (_url === 'dashboard') {
        if (req.session.user && req.session.user.role === 'user') {
            return next();
        }
        res.redirect('/signin');
    }
    else if (_url === 'orders') {
        if (req.session.user && req.session.user.role === 'user') {
            return next();
        }
        res.redirect('/signin');
    }
    else if (_url === 'payments') {
        if (req.session.user && req.session.user.role === 'user') {
            return next();
        }
        res.redirect('/signin');
    }
    else {
        res.status(404).send('404 Not Found');
    }
}

module.exports = loginRedirect;