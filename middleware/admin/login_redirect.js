function loginRedirect(req, res, next) {
    var _url = req.originalUrl;
    _url = _url.split('/');
    _url = _url[_url.length - 1];
    if (!req.session.user || req.session.user.role !== 'admin') {
        _url === 'login' ? next() : res.redirect('/admin/login');
    }
    else
        next();
}

module.exports = loginRedirect;