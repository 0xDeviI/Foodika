const express = require('express');
const app = express();
const hbs = require('hbs');
const dotenv = require('dotenv');
const csrf = require('csurf');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const uuid4 = require('./modules/uuid');
const session = require('express-session');
const validator = require('validatorjs');
const PORT = process.env.PORT || 3000;
dotenv.config();
var cookieParser = require('cookie-parser');
var csrfProtection = csrf({ cookie: true, sessionKey: process.env.CSRF_SESSION_KEY });
var parseForm = express.urlencoded({ extended: false });

// middlewares
const isLoggedIn = require('./middleware/user/is_loggedin');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true }, function(err) {
    if (err) {
        throw "Error connecting to MongoDB: " + err;
    }
});
// load models
const User = require('./models/User');
const OTP = require('./models/OTP');

hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true }
}));
app.use(express.json());

// ********** Web API Routes **********
app.post('/api/v1/otp', csrfProtection, (req, res) => {
    var phone = req.body.phone;
    if (!phone) {
        return res.status(400).send({
            error: true,
            message: 'شماره موبایل را وارد کنید.'
        });
    }
    else if (phone.length !== 11 || !phone.startsWith('0')) {
        return res.status(400).send({
            error: true,
            message: 'شماره موبایل صحیح نیست.'
        });
    }
    else {
        const _otp = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
        OTP.findOne({ phone: phone }, (err, otp) => {
            if (err) {
                return res.status(500).send({
                    error: true,
                    message: 'خطایی در ارسال رمز یکبار مصرف به وجود آمد.'
                });
            }
            if (otp) {
                // check if otp is expired. each otp is valid for 2 minutes
                if (otp.created_at.getTime() + 120000 < Date.now()) {
                    // otp is expired, generate new otp
                    otp.otp = _otp;
                    otp.created_at = Date.now();
                    otp.save((err) => {
                        if (err) {
                            return res.status(500).send({
                                error: true,
                                message: 'خطایی در ارسال رمز یکبار مصرف به وجود آمد.'
                            });
                        }
                        res.status(200).json({
                            success: true,
                            message: 'رمز یکبار مصرف برای شما ارسال شد.'
                        });
                    });
                }
                else {
                    res.status(200).json({
                        success: true,
                        message: 'رمز یکبار مصرف برای شما ارسال شد.'
                    });
                }
            } else {
                const newOTP = new OTP({
                    phone: phone,
                    otp: _otp,
                    created_at: Date.now()
                });
                newOTP.save(err => {
                    if (err) {
                        return res.status(500).send({
                            error: true,
                            message: 'خطایی در ارسال رمز یکبار مصرف به وجود آمد.'
                        });
                    }
                    else {
                        res.status(200).json({
                            success: true,
                            message: 'رمز یکبار مصرف برای شما ارسال شد.'
                        });
                    }
                });
            }
        });
    }
});

app.post('/api/v1/login', csrfProtection, (req, res) => {
    var otp = req.body.otp;
    var phone = req.body.phone;
    if (!otp || !phone) {
        return res.status(400).send({
            error: true,
            message: 'شماره موبایل و رمز یکبار مصرف را وارد کنید.'
        });
    }
    else if (phone.length !== 11 || !phone.startsWith('0')) {
        return res.status(400).send({
            error: true,
            message: 'شماره موبایل صحیح نیست.'
        });
    }
    else if (otp.length !== 6 && !isNaN(otp)) {
        return res.status(400).send({
            error: true,
            message: 'رمز یکبار مصرف صحیح نیست.'
        });
    }
    else {
        OTP.findOne({ phone: phone, otp: otp}, (err, otp) => {
            if (err) {
                return res.status(500).send({
                    error: true,
                    message: 'خطایی در ورود به سیستم به وجود آمد.'
                });
            }
            if (!otp) {
                return res.status(400).send({
                    error: true,
                    message: 'رمز یکبار مصرف اشتباه است.'
                });
            }
            else {
                // check if otp is expired. each otp is valid for 2 minutes
                if (otp.created_at.getTime() + 120000 < Date.now()) {
                    // otp is expired, return error
                    return res.status(400).send({
                        error: true,
                        message: 'رمز یکبار مصرف منقضی شده است.'
                    });
                }
                else {
                    // otp is valid, login user
                    User.findOne({ phone: phone }, (err, user) => {
                        if (err) {
                            return res.status(500).send({
                                error: true,
                                message: 'خطایی در ورود به سیستم به وجود آمد.'
                            });
                        }
                        if (!user) {
                            // register new user
                            const newUser = new User({
                                name: 'کاربر',
                                phone: phone,
                                role: 'user'
                            });
                            newUser.save(err => {
                                if (err) {
                                    return res.status(500).send({
                                        error: true,
                                        message: 'خطایی در ورود به سیستم به وجود آمد.'
                                    });
                                }
                                else {
                                    // login user
                                    User.findOne({ phone: phone }, (err, _user) => {
                                        if (err) {
                                            return res.status(500).send({
                                                error: true,
                                                message: 'خطایی در ورود به سیستم به وجود آمد.'
                                            });
                                        }
                                        else {
                                            // generate token
                                            const token = jwt.sign({ 
                                                user: _user
                                            }, process.env.JWT_SECRET, { expiresIn: '3h' });
                                            // return token to user
                                            req.session.user = user;
                                            return res.status(200).send({
                                                error: false,
                                                token: token,
                                                message: 'ورود به سیستم با موفقیت انجام شد.'
                                            });
                                        }
                                    });
                                }
                            });
                        }
                        else {
                            // login user
                            jwtoken = jwt.sign({
                                user: user
                            }, process.env.JWT_SECRET, { expiresIn: '3h' });
                            req.session.user = user;
                            return res.status(200).send({
                                error: false,
                                message: 'ورود به سیستم با موفقیت انجام شد.',
                                registered: true,
                                token: jwtoken
                            });
                        }
                    });
                }
            }
        });
    }
});

// ********** Web Application Routes **********
app.get('/', (req, res) => {
    res.render('layouts/index', {
        title: process.env.SITE_TITLE,
        name: process.env.SITE_NAME
    });
});

app.get('/signin', csrfProtection, (req, res) => {
    res.render('layouts/signin', {
        title: process.env.SITE_TITLE + ' - ورود',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'signin'
    });
});

app.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('layouts/dashboard', {
        title: process.env.SITE_TITLE + ' - داشبورد',
        name: process.env.SITE_NAME,
        page: 'dashboard'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});