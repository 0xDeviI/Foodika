function loginRedirect(req, res, next) {
    var _url = req.originalUrl;
    _url = _url.split('/');
    _url = _url[_url.length - 1];
    if (_url === 'admin') {
        if (!req.session.user || req.session.user.role !== 'admin') {
            res.render('layouts/admin/login', {
                title: process.env.SITE_TITLE + ' - ورود ادمین',
                name: process.env.SITE_NAME,
                page: 'admin_login',
                csrfToken: req.csrfToken()
            });
        }
        else
            next();
    }
    else {
        res.status(404).send('404 Not Found');
    }
}

module.exports = loginRedirect;