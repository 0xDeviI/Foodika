const express = require('express');
const app = express();
const hbs = require('hbs');
const dotenv = require('dotenv');
const csrf = require('csurf');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const uuid4 = require('./modules/uuid'); // unused
const session = require('express-session');
const validator = require('./modules/validator');
const bcrypt = require('bcryptjs');
const PORT = process.env.PORT || 3000;
dotenv.config();
var cookieParser = require('cookie-parser');
var csrfProtection = csrf({ cookie: true, sessionKey: process.env.CSRF_SESSION_KEY });
var parseForm = express.urlencoded({ extended: false }); // unused yet

// App config
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // secure: true for production when SSL available
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true }, function(err) {
    if (err) {
        throw "Error connecting to MongoDB: " + err;
    }
});

// load models
const User = require('./models/User');
// initialize admin account if not exists
User.findOne({ role: 'admin' }, function(err, user) {
    if (err) {
        throw "Error finding admin account: " + err;
    }
    if (!user) {
        var admin = new User({
            name: 'مدیر',
            username: process.env.DEFAULT_ADMIN_USERNAME,
            password: bcrypt.hashSync(process.env.DEFAULT_ADMIN_PASSWORD, 10),
            role: 'admin'
        });
        admin.save(function(err) {
            if (err) {
                throw "Error initializing admin account: " + err;
            }
        });
    }
});

// middlewares
const userMiddleware = require('./middleware/user/user_middleware');
const adminMiddleware = require('./middleware/admin/admin_middleware');

// ********** Web API Admin Routes **********
app.post('/api/v1/admin/login', csrfProtection, function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    if (!username || !password) {
        res.status(400).json({
            error: true,
            message: 'نام کاربری و رمز عبور را وارد کنید'
        });
    }
    else {
        if (!validator.isValidUsername(username) || !validator.isValidPassword(password)) {
            res.status(400).json({
                error: true,
                message: 'نام کاربری و رمز عبور را به درستی وارد کنید'
            });
        }
        else {
            User.findOne({ username: username, role: 'admin' }, function(err, user) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!user) {
                    res.status(400).json({
                        error: true,
                        message: 'نام کاربری یا رمز عبور اشتباه است'
                    });
                }
                else {
                    if (bcrypt.compareSync(password, user.password)) {
                        var jwtoken = jwt.sign({
                            user: user
                        }, process.env.JWT_SECRET, { expiresIn: '1d' });
                        req.session.user = user;
                        res.status(200).json({
                            error: false,
                            message: 'ورود موفقیت آمیز بود',
                            token: jwtoken
                        });
                    }
                    else {
                        res.status(400).json({
                            error: true,
                            message: 'نام کاربری یا رمز عبور اشتباه است'
                        });
                    }
                }
            });
        }
    }
});

// ********** Web API Routes **********
app.post('/api/v1/user/register', csrfProtection, (req, res) => {
    var name = req.body.name;
    var username = req.body.username;
    var password = req.body.password;

    if (!name || !username || !password) {
        res.status(400).json({
            error: true,
            message: 'وارد کردن همه فیلدها الزامی است.'
        });
    }
    else {
        if (!validator.isValidName(name) || !validator.isValidUsername(username) || !validator.isValidPassword(password)) {
            res.status(400).json({
                error: true,
                message: 'مقادیر ورودی نامعتبر است.'
            });
        }
        else {
            // check for user existence un-case sensitive
            User.findOne({ username: username.toLowerCase() }, function(err, user) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                
                if (user) {
                    res.status(400).json({
                        error: true,
                        message: 'نام کاربری وارد شده تکراری است.'
                    });
                }
                else {
                    // create user
                    var newUser = new User({
                        name: name,
                        username: username,
                        password: bcrypt.hashSync(password, 10)
                    });
                    newUser.save((err, user) => {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور.'
                            });
                        }
                        else {
                            res.status(200).json({
                                error: false,
                                message: 'ثبت نام با موفقیت انجام شد.'
                            });
                        }
                    });
                }
            });
        }
    }
});
app.post('/api/v1/user/login', csrfProtection, (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    if (!username || !password) {
        res.status(400).json({
            error: true,
            message: 'وارد کردن همه فیلدها الزامی است.'
        });
    }
    else {
        if (!validator.isValidUsername(username) || !validator.isValidPassword(password)) {
            res.status(400).json({
                error: true,
                message: 'مقادیر ورودی نامعتبر است.'
            });
        }
        else {
            // check for user existence un-case sensitive
            User.findOne({ username: username.toLowerCase(), role: 'user' }, function(err, user) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                
                if (!user) {
                    res.status(400).json({
                        error: true,
                        message: 'نام کاربری یا کلمه عبور نادرست است.'
                    });
                }
                else {
                    if (bcrypt.compareSync(password, user.password)) {
                        // create session
                        var jwtoken = jwt.sign({
                            user: user
                        }, process.env.JWT_SECRET, {
                            expiresIn: '3h'
                        });
                        req.session.user = user;
                        res.status(200).json({
                            error: false,
                            message: 'ورود با موفقیت انجام شد.',
                            token: jwtoken
                        });
                    }
                    else {
                        res.status(400).json({
                            error: true,
                            message: 'نام کاربری یا کلمه عبور نادرست است.'
                        });
                    }
                }
            });
        }
    }
});

// ********** Web Application Routes **********
app.get('/', (req, res) => {
    res.render('layouts/index', {
        title: process.env.SITE_TITLE,
        name: process.env.SITE_NAME
    });
});

app.get('/signin', csrfProtection, userMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/signin', {
        title: process.env.SITE_TITLE + ' - ورود',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'signin'
    });
});

app.get('/signup', csrfProtection, userMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/signup', {
        title: process.env.SITE_TITLE + ' - ثبت نام',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'signup'
    });
});

app.get('/dashboard', userMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/dashboard', {
        title: process.env.SITE_TITLE + ' - داشبورد',
        name: process.env.SITE_NAME,
        page: 'dashboard'
    });
});

// ********** Web Application Admin Routes **********
app.get('/admin', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/admin/dashboard', {
        title: process.env.SITE_TITLE + ' - پنل مدیریت',
        name: process.env.SITE_NAME,
        page: 'admin_dashboard',
        user: req.session.user
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});