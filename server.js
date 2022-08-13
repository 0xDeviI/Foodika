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

// middlewares
const loginRedirect = require('./middleware/user/login_redirect');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true }, function(err) {
    if (err) {
        throw "Error connecting to MongoDB: " + err;
    }
});
// load models
const User = require('./models/User');

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
            User.findOne({ username: username.toLowerCase() }, function(err, user) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                
                if (!user) {
                    res.status(400).json({
                        error: true,
                        message: 'رمز عبور وارد شده اشتباه است.'
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
                            message: 'رمز عبور وارد شده اشتباه است.'
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

app.get('/signin', csrfProtection, loginRedirect, (req, res) => {
    res.render('layouts/signin', {
        title: process.env.SITE_TITLE + ' - ورود',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'signin'
    });
});

app.get('/signup', csrfProtection, (req, res) => {
    res.render('layouts/signup', {
        title: process.env.SITE_TITLE + ' - ثبت نام',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'signup'
    });
});

app.get('/dashboard', loginRedirect, (req, res) => {
    res.render('layouts/dashboard', {
        title: process.env.SITE_TITLE + ' - داشبورد',
        name: process.env.SITE_NAME,
        page: 'dashboard'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});