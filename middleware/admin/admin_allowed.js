function loginRedirect(req, res, next) {
    var _url = req.originalUrl;
    _url = _url.split('/');
    _url = _url[_url.length - 1];
    if (!req.session.user || req.session.user.role !== 'admin') {
        res.status(401).json({
            error: true,
            message: 'Unauthorized'
        });
    }
    else
        next();
}

module.exports = loginRedirect;