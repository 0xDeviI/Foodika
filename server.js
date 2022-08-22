const express = require('express');
const app = express();
const hbs = require('hbs');
const dotenv = require('dotenv');
const csrf = require('csurf');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const uuid4 = require('./modules/uuid');
const session = require('express-session');
const validator = require('./modules/validator');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
const request = require('request');
const {getPaymentID} = require('./modules/identifier');
dotenv.config();
const PORT = process.env.PORT || process.env.OTHER_PORT;
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
    },
    mul: (v1, v2) => v1 * v2
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
if (!fs.existsSync(__dirname + `/public/${process.env.FOODS_IMAGE_LOCATION}`)) {
    fs.mkdirSync(__dirname + `/public/${process.env.FOODS_IMAGE_LOCATION}`);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __dirname + `/public/${process.env.FOODS_IMAGE_LOCATION}`);
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
const Order = require('./models/Order');
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
const globalMiddleware = require('./middleware/global_middleware');

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
app.post('/api/v1/admin/category/add', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
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
app.delete('/api/v1/admin/category/:id', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
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
app.put('/api/v1/admin/category/:id', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
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
app.post('/api/v1/admin/food/add', globalMiddleware.jwtAuth, upload.single("image"), csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
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
                                let imageSplit = image.split('/uploads/');
                                image = `uploads/${imageSplit[1]}`;
                            }
                            else {
                                image = process.env.FOODS_DEFAULT_IMAGE;
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
app.delete('/api/v1/admin/food/:id', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    if (!validator.isValidObjectId(id)) {
        res.status(400).json({
            error: true,
            message: 'شناسه غذا را به درستی وارد کنید'
        });
    }
    else {
        Food.findById(id, function(err, food) {
            if (err) {
                res.status(500).json({
                    error: true,
                    message: 'خطا در برقراری ارتباط با سرور'
                });
            }
            else if (!food) {
                res.status(400).json({
                    error: true,
                    message: 'غذا مورد نظر یافت نشد'
                });
            }
            else {
                // remove image
                if (food.image && food.image !== process.env.FOODS_DEFAULT_IMAGE) {
                    fs.unlink(`public/${food.image}`, function(err) {});
                }
                food.remove(function(err) {
                    if (err) {
                        res.status(500).json({
                            error: true,
                            message: 'خطا در برقراری ارتباط با سرور'
                        });
                    }
                    else {
                        res.status(200).json({
                            error: false,
                            message: 'غذا با موفقیت حذف شد'
                        });
                    }
                });
            }
        });
    }
});
app.put('/api/v1/admin/food/:id', globalMiddleware.jwtAuth, upload.single('image'), csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    var name = req.body.name;
    var description = req.body.description;
    var category = req.body.category;
    var image = req.file ? req.file.path : null;
    var price = req.body.price;
    var available = req.body.available;
    var deletePhoto = req.body.deletePhoto;
    if (!name || !category || !price || !available) {
        res.status(400).json({
            error: true,
            message: 'نام غذا، دسته بندی، قیمت و موجودی را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'شناسه غذا را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidObjectId(category)) {
            res.status(400).json({
                error: true,
                message: 'نام دسته بندی را به درستی وارد کنید'
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
            FoodCategory.findOne({ _id: category }, function(err, category) {
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
                    Food.findById(id, function(err, food) {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور'
                            });
                        }
                        else if (!food) {
                            res.status(400).json({
                                error: true,
                                message: 'غذا مورد نظر یافت نشد'
                            });
                        }
                        else {
                            // remove image path before /uploads
                            if (image) {
                                let imageSplit = image.split('/uploads/');
                                image = `uploads/${imageSplit[1]}`;
                            }
                            else {
                                if (deletePhoto === 'true') {
                                    image = process.env.FOODS_DEFAULT_IMAGE;
                                }
                                else {
                                    image = food.image;
                                }
                            }
                            // remove old image
                            if (food.image && food.image !== process.env.FOODS_DEFAULT_IMAGE && deletePhoto === 'true') {
                                fs.unlink(`public/${food.image}`, function(err) {});
                            }
                            food.name = name;
                            food.description = description;
                            food.category = category;
                            food.image = image;
                            food.price = price;
                            food.isAvailable = available;
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
                                        message: 'غذا با موفقیت ویرایش شد'
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
app.post('/api/v1/admin/user/add', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var name = req.body.name;
    var username = req.body.username;
    var password = req.body.password;
    var role = req.body.role;

    if (!name || !username || !password || !role) {
        res.status(400).json({
            error: true,
            message: 'نام، نام کاربری و رمز عبور را وارد کنید'
        });
    }
    else {
        if (!validator.isValidName(name)) {
            res.status(400).json({
                error: true,
                message: 'نام را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidUsername(username)) {
            res.status(400).json({
                error: true,
                message: 'نام کاربری را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidPassword(password)) {
            res.status(400).json({
                error: true,
                message: 'رمز عبور را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidRole(role)) {
            res.status(400).json({
                error: true,
                message: 'نقش را به درستی وارد کنید'
            });
        }
        else {
            User.findOne({ username: username }, function(err, user) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (user) {
                    res.status(400).json({
                        error: true,
                        message: 'نام کاربری تکراری است'
                    });
                }
                else {
                    var newUser = new User();
                    newUser.name = name;
                    newUser.username = username;
                    newUser.password = bcrypt.hashSync(password, 10);
                    newUser.role = role;
                    newUser.save(function(err) {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور'
                            });
                        }
                        else {
                            res.status(200).json({
                                error: false,
                                message: 'کاربر با موفقیت اضافه شد'
                            });
                        }
                    });
                }
            });
        }
    }
});
app.delete('/api/v1/admin/user/:id', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    if (!id) {
        res.status(400).json({
            error: true,
            message: 'آیدی کاربر را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'آیدی کاربر را به درستی وارد کنید'
            });
        }
        else {
            User.findById(id, function(err, user) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!user) {
                    res.status(400).json({
                        error: true,
                        message: 'کاربر مورد نظر یافت نشد'
                    });
                }
                else {
                    user.remove(function(err) {
                        if (err) {
                            res.status(500).json({
                                error: true,
                                message: 'خطا در برقراری ارتباط با سرور'
                            });
                        }
                        else {
                            res.status(200).json({
                                error: false,
                                message: 'کاربر با موفقیت حذف شد'
                            });
                        }
                    });
                }
            });
        }
    }
});
app.put('/api/v1/admin/user/:id', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    var name = req.body.name;
    var username = req.body.username;
    var password = req.body.password;
    var role = req.body.role;

    if (!id || !name || !username || !password || !role) {
        res.status(400).json({
            error: true,
            message: 'آیدی کاربر و نام، نام کاربری و رمز عبور و نقش را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'آیدی کاربر را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidName(name)) {
            res.status(400).json({
                error: true,
                message: 'نام را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidUsername(username)) {
            res.status(400).json({
                error: true,
                message: 'نام کاربری را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidPassword(password)) {
            res.status(400).json({
                error: true,
                message: 'رمز عبور را به درستی وارد کنید'
            });
        }
        else if (!validator.isValidRole(role)) {
            res.status(400).json({
                error: true,
                message: 'نقش را به درستی وارد کنید'
            });
        }
        else {
            User.findById(id, function(err, user) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!user) {
                    res.status(400).json({
                        error: true,
                        message: 'کاربر مورد نظر یافت نشد'
                    });
                }
                else {
                    if (req.session.user.role !== 'admin') {
                        res.status(400).json({
                            error: true,
                            message: 'شما دسترسی لازم برای انجام این عملیات را ندارید'
                        });
                    }
                    else {
                        // check requested username is available or not
                        User.findOne({
                            username: username
                        }, function(err, user) {
                            if (err) {
                                res.status(500).json({
                                    error: true,
                                    message: 'خطا در برقراری ارتباط با سرور'
                                });
                            }
                            else if (user && user.username !== username) {
                                res.status(400).json({
                                    error: true,
                                    message: 'نام کاربری قبلا استفاده شده است'
                                });
                            }
                            else {
                                user.name = name;
                                user.username = username;
                                user.password = bcrypt.hashSync(password, 10);
                                user.role = role;
                                user.save(function(err) {
                                    if (err) {
                                        res.status(500).json({
                                            error: true,
                                            message: 'خطا در برقراری ارتباط با سرور'
                                        });
                                    }
                                    else {
                                        res.status(200).json({
                                            error: false,
                                            message: 'کاربر با موفقیت ویرایش شد'
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
    }
});
app.put('/api/v1/admin/order/:id/onway', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    if (!id) {
        res.status(400).json({
            error: true,
            message: 'آیدی سفارش را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'آیدی سفارش را به درستی وارد کنید'
            });
        }
        else {
            Order.findById(id, function(err, order) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!order) {
                    res.status(400).json({
                        error: true,
                        message: 'سفارش مورد نظر یافت نشد'
                    });
                }
                else {
                    if (req.session.user.role !== 'admin') {
                        res.status(400).json({
                            error: true,
                            message: 'شما دسترسی لازم برای انجام این عملیات را ندارید'
                        });
                    }
                    else {
                        order.status = 'on the way';
                        order.save(function(err) {
                            if (err) {
                                res.status(500).json({
                                    error: true,
                                    message: 'خطا در برقراری ارتباط با سرور'
                                });
                            }
                            else {
                                res.status(200).json({
                                    error: false,
                                    message: 'سفارش با موفقیت به حالت در حال تحویل ارسال شد'
                                });
                            }
                        });
                    }
                }
            });
        }
    }
});
app.put('/api/v1/admin/order/:id/delivered', globalMiddleware.jwtAuth, csrfProtection, adminMiddleware.adminAllowed, function(req, res) {
    var id = req.params.id;
    if (!id) {
        res.status(400).json({
            error: true,
            message: 'آیدی سفارش را وارد کنید'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'آیدی سفارش را به درستی وارد کنید'
            });
        }
        else {
            Order.findById(id, function(err, order) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور'
                    });
                }
                else if (!order) {
                    res.status(400).json({
                        error: true,
                        message: 'سفارش مورد نظر یافت نشد'
                    });
                }
                else {
                    if (req.session.user.role !== 'admin') {
                        res.status(400).json({
                            error: true,
                            message: 'شما دسترسی لازم برای انجام این عملیات را ندارید'
                        });
                    }
                    else {
                        order.status = 'done';
                        order.save(function(err) {
                            if (err) {
                                res.status(500).json({
                                    error: true,
                                    message: 'خطا در برقراری ارتباط با سرور'
                                });
                            }
                            else {
                                res.status(200).json({
                                    error: false,
                                    message: 'سفارش با موفقیت به حالت در حال تحویل ارسال شد'
                                });
                            }
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
app.post('/api/v1/user/cart', globalMiddleware.jwtAuth, csrfProtection, (req, res) => {
    var id = req.body.id;
    var quantity = req.body.quantity;
    var user = req.user.user;

    if (!id || !quantity) {
        res.status(400).json({
            error: true,
            message: 'وارد کردن همه فیلدها الزامی است.'
        });
    }
    else {
        if (!validator.isValidObjectId(id) || !validator.isValidNumber(quantity)) {
            res.status(400).json({
                error: true,
                message: 'مقادیر ورودی نامعتبر است.'
            });
        }
        else {
            quantity = Number(quantity);
            Food.findById(id, function(err, food) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                else {
                    if (!food) {
                        res.status(400).json({
                            error: true,
                            message: 'غذا وجود ندارد.'
                        });
                    }
                    else {
                        Order.findOne({ user: user._id, paymentStatus: 'pending' }, function(err, order) {
                            if (err) {
                                res.status(500).json({
                                    error: true,
                                    message: 'خطا در برقراری ارتباط با سرور.'
                                });
                            }
                            else {
                                if (!order) {
                                    var newOrder = new Order({
                                        user: user._id,
                                        foods: [{
                                            food: food._id,
                                            quantity: quantity
                                        }],
                                        paymentId: getPaymentID()
                                    });
                                    newOrder.save((err, order) => {
                                        if (err) {
                                            res.status(500).json({
                                                error: true,
                                                message: 'خطا در برقراری ارتباط با سرور.'
                                            });
                                        }
                                        else {
                                            res.status(200).json({
                                                error: false,
                                                message: 'ثبت سفارش با موفقیت انجام شد.'
                                            });
                                        }
                                    });
                                }
                                else {
                                    var foodExists = false;
                                    for (var i = 0; i < order.foods.length; i++) {
                                        if (order.foods[i].food.toString() === food._id.toString()) {
                                            foodExists = true;
                                            break;
                                        }
                                    }
                                    if (foodExists) {
                                        // update
                                        console.log(order.foods[i]);
                                        order.foods[i].quantity = quantity;
                                        order.markModified('foods');
                                        order.save( { new: true }, (err, order) => {
                                            if (err) {
                                                res.status(500).json({
                                                    error: true,
                                                    message: 'خطا در برقراری ارتباط با سرور.'
                                                });
                                            }
                                            else {
                                                console.log(order);
                                                res.status(200).json({
                                                    error: false,
                                                    message: 'ویرایش سفارش با موفقیت انجام شد.'
                                                });
                                            }
                                        });
                                    }
                                    else {
                                        order.foods.push({
                                            food: food._id,
                                            quantity: quantity
                                        });
                                        order.save((err, order) => {
                                            if (err) {
                                                res.status(500).json({
                                                    error: true,
                                                    message: 'خطا در برقراری ارتباط با سرور.'
                                                });
                                            }
                                            else {
                                                res.status(200).json({
                                                    error: false,
                                                    message: 'ثبت سفارش با موفقیت انجام شد.'
                                                });
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    }
                }
            });
        }
    }
});
app.delete('/api/v1/user/cart/:id', globalMiddleware.jwtAuth, csrfProtection, (req, res) => {
    var id = req.params.id;
    var user = req.user.user;
    if (!id) {
        res.status(400).json({
            error: true,
            message: 'وارد کردن همه فیلدها الزامی است.'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'مقادیر ورودی نامعتبر است.'
            });
        }
        else {
            Order.findOne({ user: user._id, paymentStatus: 'pending' }, function(err, order) {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                else {
                    if (!order) {
                        res.status(400).json({
                            error: true,
                            message: 'سفارشی وجود ندارد.'
                        });
                    }
                    else {
                        var foodExists = false;
                        for (var i = 0; i < order.foods.length; i++) {
                            if (order.foods[i]._id.toString() === id.toString()) {
                                foodExists = true;
                                break;
                            }
                        }
                        if (foodExists) {
                            order.foods.splice(i, 1);
                            order.save( { new: true }, (err, order) => {
                                if (err) {
                                    res.status(500).json({
                                        error: true,
                                        message: 'خطا در برقراری ارتباط با سرور.'
                                    });
                                }
                                else {
                                    if (order.foods.length === 0) {
                                        // remove it
                                        Order.deleteOne({ _id: order._id }, (err) => {
                                            if (err) {
                                                res.status(500).json({
                                                    error: true,
                                                    message: 'خطا در برقراری ارتباط با سرور.'
                                                });
                                            }
                                            else {
                                                res.status(200).json({
                                                    error: false,
                                                    message: 'حذف سفارش با موفقیت انجام شد.'
                                                });
                                            }
                                        });
                                    }
                                    else {
                                        res.status(200).json({
                                            error: false,
                                            message: 'حذف سفارش با موفقیت انجام شد.'
                                        });
                                    }
                                }
                            });
                        }
                        else {
                            res.status(400).json({
                                error: true,
                                message: 'سفارشی وجود ندارد.'
                            });
                        }
                    }
                }
            });
        }
    }
});
app.put('/api/v1/user/cart/:id', globalMiddleware.jwtAuth, csrfProtection, (req, res) => {
    var id = req.params.id;
    var method = req.body.method;
    var user = req.user.user;
    var address = req.body.address;
    var phone = req.body.phone;
    if (!id) {
        res.status(400).json({
            error: true,
            message: 'وارد کردن همه فیلدها الزامی است.'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'مقادیر ورودی نامعتبر است.'
            });
        }
        else {
            if (method != 'pay on delivery' && method != 'pay in store' && method != 'online') {
                res.status(400).json({
                    error: true,
                    message: 'ورودی نامعتبر است.'
                });
            }
            else {
                Order.findOne({ user: user._id, _id: id }).populate({
                    path: 'foods.food',
                    populate: {
                        path: 'category'
                    }
                }).exec((err, order) => {
                    if (err) {
                        res.status(500).json({
                            error: true,
                            message: 'خطا در برقراری ارتباط با سرور.'
                        });
                    }
                    else {
                        // calculate total amount
                        var amount = 0;
                        for (var i = 0; i < order.foods.length; i++) {
                            amount += order.foods[i].food.price * order.foods[i].quantity;
                        }
                        order.paymentMethod = method;
                        order.paymentStatus = 'done';
                        order.amount = amount;
                        order.address = address;
                        order.phone = phone;
                        order.save( (err, order) => {
                            if (err) {
                                res.status(500).json({
                                    error: true,
                                    message: 'خطا در برقراری ارتباط با سرور.'
                                });
                            }
                            else {
                                res.status(200).json({
                                    error: false,
                                    message: 'ویرایش سفارش با موفقیت انجام شد.'
                                });
                            }
                        });
                    }
                });
            }
        }
    }
});
app.post('/api/v1/user/payment', globalMiddleware.jwtAuth, csrfProtection, (req, res) => {
    // send http request to payment gateway
    var user = req.user.user;
    var id = req.body.id;
    var address = req.body.address;
    var phone = req.body.phone;

    if (!id) {
        res.status(400).json({
            error: true,
            message: 'وارد کردن همه فیلدها الزامی است.'
        });
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.status(400).json({
                error: true,
                message: 'شناسه نامعتبر است.'
            });
        }
        else {
            Order.findOne({ user: user._id, _id: id, paymentStatus: 'pending' }).populate({
                path: 'foods.food',
                populate: {
                    path: 'category'
                }
            }).exec((err, order) => {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                else {
                    if (!order) {
                        res.status(400).json({
                            error: true,
                            message: 'سفارشی وجود ندارد.'
                        });
                    }
                    else {
                        // calculate amount
                        var amount = 0;
                        for (var i = 0; i < order.foods.length; i++) {
                            amount += order.foods[i].food.price * order.foods[i].quantity;
                        }
                        order.address = address;
                        order.phone = phone;
                        order.save( (err, order) => {
                            if (err) {
                                res.status(500).json({
                                    error: true,
                                    message: 'خطا در برقراری ارتباط با سرور.'
                                });
                            }
                            else {
                                // create request using request module
                                // send to nextpay
                                var options = {
                                    method: 'POST',
                                    url: 'https://nextpay.org/nx/gateway/token',
                                    headers: {
                                        'content-type': 'application/json'
                                    },
                                    body: {
                                        api_key: process.env.NEXTPAY_API_KEY,
                                        order_id: order.paymentId,
                                        amount: amount,
                                        currency: 'IRT',
                                        callback_uri: process.env.DOMAIN + '/payment/callback'
                                    },
                                    json: true
                                };
                                request(options, (err, response, body) => {
                                    if (err) {
                                        res.status(500).json({
                                            error: true,
                                            message: 'خطا در برقراری ارتباط با سرور.'
                                        });
                                    }
                                    else {
                                        // parse response which is in json format
                                        var gatewayResponse = body;
                                        if (gatewayResponse.code === -1) {
                                            let token = gatewayResponse.trans_id;
                                            res.status(201).json({
                                                error: false,
                                                message: 'توکن پرداخت صادر شد.',
                                                payment: `https://nextpay.org/nx/gateway/payment/${token}`
                                            });
                                        }
                                        else {
                                            res.status(500).json({
                                                error: true,
                                                message: 'خطا در برقراری ارتباط با سرور.'
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
    }
});

// ********** Web Application Routes **********
app.get('/', userMiddleware.userData, (req, res) => {
    Food.find({}).populate('category').exec((err, foods) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            res.render('layouts/index', {
                title: process.env.SITE_TITLE,
                name: process.env.SITE_NAME,
                foods: foods,
                userData: req.userData
            });
        }
    });
});

app.get('/signin', userMiddleware.userData, csrfProtection, userMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/signin', {
        title: process.env.SITE_TITLE + ' - ورود',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'signin',
        userData: req.userData
    });
});

app.get('/signup', userMiddleware.userData, csrfProtection, userMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/signup', {
        title: process.env.SITE_TITLE + ' - ثبت نام',
        name: process.env.SITE_NAME,
        csrfToken: req.csrfToken(),
        page: 'signup',
        userData: req.userData
    });
});

app.get('/dashboard', userMiddleware.userData, userMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/dashboard', {
        title: process.env.SITE_TITLE + ' - داشبورد',
        name: process.env.SITE_NAME,
        page: 'dashboard',
        userData: req.userData
    });
});

app.get('/category/:name', userMiddleware.userData, (req, res) => {
    let name = req.params.name;
    if (!validator.isValidName(name)) {
        res.status(404).json({
            error: true,
            message: 'دسته بندی مورد نظر یافت نشد.'
        });
    }
    else {
        FoodCategory.findOne({name: name}, (err, category) => {
            if (err) {
                res.status(500).json({
                    error: true,
                    message: 'خطا در برقراری ارتباط با سرور.'
                });
            }
            else if (!category) {
                res.status(404).json({
                    error: true,
                    message: 'دسته بندی مورد نظر یافت نشد.'
                });
            }
            else {
                Food.find({category: category._id}, (err, foods) => {
                    if (err) {
                        res.status(500).json({
                            error: true,
                            message: 'خطا در برقراری ارتباط با سرور.'
                        });
                    }
                    else {
                        for (let i = 0; i < foods.length; i++) {
                            let foodCategoryID = foods[i].category.toString();
                            let categoryID = category._id.toString();
                            if (foodCategoryID == categoryID) {
                                    foods[i].category.name = category.name;
                            }
                        }
                        res.render('layouts/category', {
                            title: process.env.SITE_TITLE + ' - ' + category.name,
                            name: process.env.SITE_NAME,
                            page: 'category',
                            foods: foods,
                            userData: req.userData
                        });
                    }
                });
            }
        });
    }
});

app.get('/food/:id', userMiddleware.userData, csrfProtection, (req, res) => {
    let id = req.params.id;
    if (!validator.isValidObjectId(id)) {
        res.status(404).json({
            error: true,
            message: 'غذا مورد نظر یافت نشد.'
        });
    }
    else {
        Food.findById(id).populate('category').exec((err, food) => {
            if (err) {
                res.status(500).json({
                    error: true,
                    message: 'خطا در برقراری ارتباط با سرور.'
                });
            }
            else {
                res.render('layouts/food', {
                    title: process.env.SITE_TITLE + ' - ' + food.name,
                    name: process.env.SITE_NAME,
                    page: 'food',
                    food: food,
                    userData: req.userData,
                    csrfToken: req.csrfToken()
                });
            }
        });
    }
});

app.get('/dashboard/orders', userMiddleware.userData, userMiddleware.loginRedirect, csrfProtection, (req, res) => {
    var _id = req.session.user._id;
    Order.find({user: _id, paymentStatus: 'pending'}).populate({
        path: 'foods.food',
        populate: {
            path: 'category'
        }
    }).exec((err, orders) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            var total = 0;
            for (let i = 0; i < orders.length; i++) {
                for (let j = 0; j < orders[i].foods.length; j++) {
                    total += orders[i].foods[j].food.price * orders[i].foods[j].quantity;
                }
            }
            res.render('layouts/orders', {
                title: process.env.SITE_TITLE + ' - سفارشات',
                name: process.env.SITE_NAME,
                page: 'orders',
                orders: orders,
                userData: req.userData,
                total: total,
                csrfToken: req.csrfToken()
            });
        }
    });
});

app.get('/payment/callback', userMiddleware.userData, (req, res) => {
    var trans_id = req.query.trans_id;
    var order_id = req.query.order_id;
    var amount = req.query.amount;

    if (!trans_id || !order_id || !amount) {
        res.render('layouts/payment', {
            title: process.env.SITE_TITLE + ' - بررسی پرداخت',
            name: process.env.SITE_NAME,
            page: 'payment',
            result: {
                error: true,
                message: 'درخواست نامعتبر.'
            },
            userData: req.userData
        });
    }
    else {
        // verify payment
        var options = {
            method: 'POST',
            url: 'https://nextpay.org/nx/gateway/verify',
            headers: {
                'content-type': 'application/json'
            },
            body: {
                api_key: process.env.NEXTPAY_API_KEY,
                amount: amount,
                trans_id: trans_id,
                currency: 'IRT'
            },
            json: true
        }
        request(options, (err, response, body) => {
            if (err) {
                res.render('layouts/payment', {
                    title: process.env.SITE_TITLE + ' - بررسی پرداخت',
                    name: process.env.SITE_NAME,
                    page: 'payment',
                    result: {
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    },
                    userData: req.userData
                });
            }
            else {
                var gatewayResponse = body;
                if (gatewayResponse.code === 0) {
                    var order_id = gatewayResponse.order_id;
                    var amount = gatewayResponse.amount;
                    var Shaparak_Ref_Id = gatewayResponse.Shaparak_Ref_Id;
                    var custom = gatewayResponse.custom;
                    Order.findOne({ paymentId: order_id, paymentStatus: 'pending' }).exec((err, order) => {
                        if (err) {
                            res.render('layouts/payment', {
                                title: process.env.SITE_TITLE + ' - بررسی پرداخت',
                                name: process.env.SITE_NAME,
                                page: 'payment',
                                result: {
                                    error: true,
                                    message: 'خطا در برقراری ارتباط با سرور.'
                                }
                            });
                        }
                        else {
                            if (!order) {
                                res.render('layouts/payment', {
                                    title: process.env.SITE_TITLE + ' - بررسی پرداخت',
                                    name: process.env.SITE_NAME,
                                    page: 'payment',
                                    result: {
                                        error: true,
                                        message: 'سفارشی وجود ندارد.'
                                    },
                                    userData: req.userData
                                });
                            }
                            else {
                                order.paymentStatus = 'done';
                                order.amount = amount;
                                order.bankRefId = Shaparak_Ref_Id;
                                order.save( (err, order) => {
                                    if (err) {
                                        res.render('layouts/payment', {
                                            title: process.env.SITE_TITLE + ' - بررسی پرداخت',
                                            name: process.env.SITE_NAME,
                                            page: 'payment',
                                            result: {
                                                error: true,
                                                message: 'خطا در برقراری ارتباط با سرور.'
                                            },
                                            userData: req.userData
                                        });
                                    }
                                    else {
                                        res.render('layouts/payment', {
                                            title: process.env.SITE_TITLE + ' - بررسی پرداخت',
                                            name: process.env.SITE_NAME,
                                            page: 'payment',
                                            result: {
                                                error: false,
                                                message: 'پرداخت با موفقیت انجام شد.'
                                            },
                                            userData: req.userData
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
                else {
                    res.render('layouts/payment', {
                        title: process.env.SITE_TITLE + ' - بررسی پرداخت',
                        name: process.env.SITE_NAME,
                        page: 'payment',
                        result: {
                            error: true,
                            message: 'تراکنش موفقیت آمیز نبود.'
                        },
                        userData: req.userData
                    });
                }
            }
        });
    }
});

app.get('/dashboard/payments', userMiddleware.userData, userMiddleware.loginRedirect,(req, res) => {
    var user = req.session.user;
    Order.find({ user: user._id, paymentStatus: 'done' }).populate({
        path: 'foods.food',
        model: 'Food',
        populate: {
            path: 'category'
        }
    }).exec((err, orders) => {
        if (err) {
            res.render('layouts/payhistory', {
                title: process.env.SITE_TITLE + ' - سفارشات',
                name: process.env.SITE_NAME,
                page: 'payments',
                orders: [],
                userData: req.userData
            });
        }
        else {
            for (let i = 0; i < orders.length; i++) {
                let orderStatus = orders[i].status;
                orders[i].pstatus = orderStatus == 'pending' ? 'در حال آماده سازی' : (orderStatus == 'on the way' ? 'در مسیر شما' : 'تحویل شده');
            }
            res.render('layouts/payhistory', {
                title: process.env.SITE_TITLE + ' - سفارشات',
                name: process.env.SITE_NAME,
                page: 'payments',
                orders: orders,
                userData: req.userData
            });
        }
    });
});

app.get('/photos', (req, res) => {
    res.render('layouts/photos', {
        title: process.env.SITE_TITLE + ' - تصاوير',
        name: process.env.SITE_NAME,
        page: 'photos',
        userData: req.userData
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

app.get('/admin/foods', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    // Foods and FoodCategories union
    Food.find({}).populate('category').exec((err, foods) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            res.render('layouts/admin/foods', {
                title: process.env.SITE_TITLE + ' - غذاها',
                name: process.env.SITE_NAME,
                page: 'admin_foods',
                user: req.session.user,
                foods: foods,
                csrfToken: req.csrfToken()
            });
        }
    });
});

app.get('/admin/food/:id', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    let id = req.params.id;
    Food.findById(id).populate('category').exec((err, food) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            FoodCategory.find({}, (err, categories) => {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                else {
                    res.render('layouts/admin/editfood', {
                        title: process.env.SITE_TITLE + ' - ویرایش غذا',
                        name: process.env.SITE_NAME,
                        page: 'admin_editfood',
                        user: req.session.user,
                        food: food,
                        csrfToken: req.csrfToken(),
                        categories: categories
                    });
                }
            });
        }
    })
});

app.get('/admin/adduser', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    res.render('layouts/admin/adduser', {
        title: process.env.SITE_TITLE + ' - ثبت کاربر',
        name: process.env.SITE_NAME,
        page: 'admin_adduser',
        user: req.session.user,
        csrfToken: req.csrfToken()
    });
});

app.get('/admin/users', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    User.find({}, (err, users) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            res.render('layouts/admin/users', {
                title: process.env.SITE_TITLE + ' - کاربران',
                name: process.env.SITE_NAME,
                page: 'admin_users',
                user: req.session.user,
                users: users,
                csrfToken: req.csrfToken()
            });
        }
    }).sort({
        createdAt: -1
    });
});

app.get('/admin/user/:id', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    let id = req.params.id;
    if (!id) {
        res.redirect('/admin/users');
    }
    else {
        if (!validator.isValidObjectId(id)) {
            res.redirect('/admin/users');
        }
        else {
            User.findById(id, (err, user) => {
                if (err) {
                    res.status(500).json({
                        error: true,
                        message: 'خطا در برقراری ارتباط با سرور.'
                    });
                }
                else {
                    res.render('layouts/admin/edituser', {
                        title: process.env.SITE_TITLE + ' - ویرایش کاربر',
                        name: process.env.SITE_NAME,
                        page: 'admin_edituser',
                        user: req.session.user,
                        userInfo: user,
                        csrfToken: req.csrfToken()
                    });
                }
            });
        }
    }
});

app.get('/admin/payments', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    Order.find({ paymentStatus: 'done' }).populate('user').sort({
        createdAt: -1
    }).exec((err, orders) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            res.render('layouts/admin/payments', {
                title: process.env.SITE_TITLE + ' - پرداخت ها',
                name: process.env.SITE_NAME,
                page: 'admin_payments',
                user: req.session.user,
                orders: orders,
                csrfToken: req.csrfToken()
            });
        }
    });
});

app.get('/admin/kitchen', csrfProtection, adminMiddleware.loginRedirect, (req, res) => {
    Order.find({ paymentStatus: 'done', status: {$ne: 'done'} }).populate('user').populate({
        path: 'foods.food',
        model: 'Food',
        populate: {
            path: 'category',
            model: 'FoodCategory'
        }
    }).sort({
        createdAt: -1
    }).exec((err, orders) => {
        if (err) {
            res.status(500).json({
                error: true,
                message: 'خطا در برقراری ارتباط با سرور.'
            });
        }
        else {
            res.render('layouts/admin/kitchen', {
                title: process.env.SITE_TITLE + ' - کارگاه',
                name: process.env.SITE_NAME,
                page: 'admin_kitchen',
                user: req.session.user,
                orders: orders,
                csrfToken: req.csrfToken()
            });
        }
    });
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});