const express = require('express');
const app = express();
const hbs = require('hbs');
const dotenv = require('dotenv');
const csrf = require('csurf');
const whoops = require('whoops');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const uuid4 = require('./modules/uuid');
const PORT = process.env.PORT || 3000;
dotenv.config();
var cookieParser = require('cookie-parser');
var csrfProtection = csrf({ cookie: true, sessionKey: process.env.CSRF_SESSION_KEY });
var parseForm = express.urlencoded({ extended: false });
var whoopsError = whoops();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true }, function(err) {
    if (err) {
        throw whoopsError;
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
// app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ********** Web API Routes **********
app.post('/api/v1/login', csrfProtection, (req, res) => {
    var phone = req.body.phone;
    if (!phone) {
        return res.status(400).send({
            error: true,
            message: 'Phone number is required'
        });
    }
    else {
        const _otp = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
        OTP.findOne({ phone: phone }, (err, otp) => {
            if (err) {
                return res.status(500).send({
                    error: true,
                    message: 'Error occurred while sending OTP.'
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
                                message: 'Error occurred while sending OTP.'
                            });
                        }
                        res.status(200).json({
                            success: true,
                            message: 'OTP sent successfully.'
                        });
                    });
                }
                else {
                    res.status(200).json({
                        success: true,
                        message: 'OTP already sent.'
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
                            message: 'Error occurred while sending OTP.'
                        });
                    }
                    else {
                        res.status(200).json({
                            success: true,
                            message: 'OTP sent successfully.'
                        });
                    }
                });
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
        csrfToken: req.csrfToken()
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});