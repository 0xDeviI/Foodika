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
const fs = require('fs');
const multer = require('multer');
const PORT = process.env.PORT || 3000;
dotenv.config();
var cookieParser = require('cookie-parser');
var csrfProtection = csrf({ cookie: true, sessionKey: process.env.CSRF_SESSION_KEY });
var parseForm = express.urlencoded({ extended: false }); // unused yet

// App config
hbs.registerPartials(__dirname + '/views/partials');
hbs.registerHelper({
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and() {
        return Array.prototype.every.call(arguments, Boolean);
    },
    or() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    }
});
hbs.registerHelper('inc', function (index) {
    index++;
    return index;
});
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
// check if /uploads folder exists, if not create it
if (!fs.existsSync(__dirname + '/public/uploads')) {
    fs.mkdirSync(__dirname + '/public/uploads');
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __dirname + '/public/uploads');
    },
    filename: (req, file, cb) => {
        // uuid is used to generate unique filenames
        var filesplit = file.originalname.split('.');
        var ext = filesplit[filesplit.length - 1];
        cb(null, uuid4() + '.' + ext);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: process.env.MAXIMUM_IMAGE_SIZE },
    fileFilter: (req, file, cb) => {
        var fileName = file.originalname.toLowerCase();
        var fileNameSplit = fileName.split('.');
        var fileExt = fileNameSplit[fileNameSplit.length - 1];
        var allowedFileExtensions = process.env.ALLOWED_FILE_EXTENSIONS;
        var allowedFileMimeTypes = process.env.ALLOWED_MIME_TYPES;
        allowedFileExtensions = allowedFileExtensions.split(' ');
        allowedFileMimeTypes = allowedFileMimeTypes.split(' ');
        if (allowedFileExtensions.includes(fileExt) && allowedFileMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(null, false);
        }
    }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true }, function(err) {
    if (err) {
        throw "Error connecting to MongoDB: " + err;
    }
});

// load models
const User = require('./models/User');
const FoodCategory = require('./models/FoodCategory');
const Food = require('./models/Food');
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
app.post('/api/v1/admin/category/add', csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var name = req.body.name;
    if (!name) {
        res.status(400).json({
            error: true,
            message: 'نام دسته بندی را وارد کنید'
        });
    }
    else {
        if (!validator.isValidName(name)) {
            res.status(400).json({
                error: true,
                message: 'نام دسته بندی را به درستی وارد کنید'
            });
        }
        else {
            FoodCategory.findOne({ name: name }, function(err, category) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (category) {
                    res.status(400).json({
                        error: true,
                        message: 'دسته بندی با این نام قبلا ثبت شده است'
                    });
                }
                else {
                    var category = new FoodCategory({
                        name: name
                    });
                    category.save(function(err) {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور'
                            });
                        }
                        else {
                            res.status(200).json({
                                error: false,
                                message: 'دسته بندی با موفقیت ثبت شد'
                            });
                        }
                    });
                }
            });
        }
    }
});
app.delete('/api/v1/admin/category/:id', csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    if (!id) {
        res.status(400).json({
            error: true,
            message: 'شناسه دسته بندی را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'شناسه دسته بندی را به درستی وارد کنید'
            });
        }
        else {
            FoodCategory.findById(id, function(err, category) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!category) {
                    res.status(400).json({
                        error: true,
                        message: 'دسته بندی مورد نظر یافت نشد'
                    });
                }
                else {
                    FoodCategory.deleteOne({ _id: id }, function(err) {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور'
                            });
                        }
                        else {
                            res.status(200).json({
                                error: false,
                                message: 'دسته بندی با موفقیت حذف شد'
                            });
                        }
                    });
                }
            });
        }
    }
});
app.put('/api/v1/admin/category/:id', csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    var name = req.body.name;
    if (!id || !name) {
        res.status(400).json({
            error: true,
            message: 'شناسه دسته بندی و نام دسته بندی را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'شناسه دسته بندی را به درستی وارد کنید'
            });
        }
        else {
            FoodCategory.findById(id, function(err, category) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!category) {
                    res.status(400).json({
                        error: true,
                        message: 'دسته بندی مورد نظر یافت نشد'
                    });
                }
                else {
                    FoodCategory.findOne({ name: name }, function(err, category2) {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور'
                            });
                        }
                        else if (category2) {
                            res.status(400).json({
                                error: true,
                                message: 'دسته بندی با این نام قبلا ثبت شده است'
                            });
                        }
                        else {
                            category.name = name;
                            category.save(function(err) {
                                if (err) {
                                    res.status(500).json({
                                        error: true,
                                        message: 'خطا در برقراری ارتباط با سرور'
                                    });
                                }
                                else {
                                    res.status(200).json({
                                        error: false,
                                        message: 'دسته بندی با موفقیت ویرایش شد'
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    }

});
app.post('/api/v1/admin/food/add', upload.single("image"), csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var name = req.body.name;
    var description = req.body.description;
    var category = req.body.category;
    var image = req.file ? req.file.path : null;
    var price = req.body.price;
    var available = req.body.available;
    if (!name || !category || !price || !available) {
        res.status(400).json({
            error: true,
            message: 'نام غذا، دسته بندی، قیمت و موجودی را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(category)) {
            res.status(400).json({
                error: true,
                message: 'شناسه دسته بندی را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidPrice(price)) {
            res.status(400).json({
                error: true,
                message: 'قیمت غذا را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidFoodDescription(description)) {
            res.status(400).json({
                error: true,
                message: 'توضیحات غذا را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidName(name)) {
            res.status(400).json({
                error: true,
                message: 'نام غذا را به درستی وارد کنید'
            });
        }
        else {
            FoodCategory.findById(category, function(err, category) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!category) {
                    res.status(400).json({
                        error: true,
                        message: 'دسته بندی مورد نظر یافت نشد'
                    });
                }
                else {
                    Food.findOne({ name: name }, function(err, food) {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور'
                            });
                        }
                        else if (food) {
                            res.status(400).json({
                                error: true,
                                message: 'غذا با این نام قبلا ثبت شده است'
                            });
                        }
                        else {
                            // remove image path before /uploads
                            if (image) {
                                let imageSplit = image.split('\\');
                                image = imageSplit[imageSplit.length - 2] + '/' + imageSplit[imageSplit.length - 1];
                            }
                            var food = new Food({
                                name: name,
                                description: description,
                                category: category,
                                image: image,
                                price: price,
                                isAvailable: available
                            });
                            food.save(function(err) {
                                if (err) {
                                    res.status(500).json({
                                        error: true,
                                        message: 'خطا در برقراری ارتباط با سرور'
                                    });
                                }
                                else {
                                    res.status(200).json({
                                        error: false,
                                        message: 'غذا با موفقیت ثبت شد'
                                    });
                                }
                            });
                        }
                    });
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
app.get('/admin/login', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/admin/login', {
        title: process.env.SITE_TITLE + ' - ورود',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'admin_login'
    });
});

app.get('/admin', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/admin/dashboard', {
        title: process.env.SITE_TITLE + ' - پنل مدیریت',
        name: process.env.SITE_NAME,
        page: 'admin_dashboard',
        user: req.session.user
    });
});

app.get('/admin/addfood', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    FoodCategory.find({}, (err, categories) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            if (categories.length == 0)
                categories.push({
                    _id: '0',
                    name: 'دسته بندی نشده'
                });
            res.render('layouts/admin/addfood', {
                title: process.env.SITE_TITLE + ' - ثبت غذا',
                name: process.env.SITE_NAME,
                csrfToken: req.csrfToken(),
                page: 'admin_addfood',
                categories: categories
            });
        }
    });
});

app.get('/admin/addcategory', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/admin/addcategory', {
        title: process.env.SITE_TITLE + ' - ثبت دسته بندی',
        name: process.env.SITE_NAME,
        page: 'admin_addcategory',
        user: req.session.user,
        csrfToken: req.csrfToken()
    });
});

app.get('/admin/categories', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    FoodCategory.find({}, function(err, categories) {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            res.render('layouts/admin/categories', {
                title: process.env.SITE_TITLE + ' - دسته بندی ها',
                name: process.env.SITE_NAME,
                page: 'admin_categories',
                user: req.session.user,
                categories: categories,
                csrfToken: req.csrfToken()
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});