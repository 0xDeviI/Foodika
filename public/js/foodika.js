const security = {
    // this key should be changed before deployment
    'application_key': 'dX1++Xl/8+ndjh+ah1a/jpAsbEEv86vZfXsGfD9MzVKZC0D3XjvmYdN/RPufeXz1WWCjT7Y7dxX7VAdMBO0zLwLFveDJnDBL0gE1rpt75/WYgLdpFojvuy8OHH+eT6rxRZ92/2UpjF6/CjAQGfYx7+rIx7Qsm9AAsMW2keT8PWfFv2aWonKvp/CB5f5hgh5Xq9Eld10lEMC6dVct8FibPR7Pp8N1wPoMbdcvGIqlr7SqHqlJmvSE+4QtWmRRuhNqwuoLCnuSMdR/Fhx3Tq65Z+Ch3BKDFpc396axtN9mmqhYNkD457JJIYqDsKRg6acT64iCBz31mSOxaR1/XOPhWQug8m/KJQaWl+fy/EB/EwGyZgNVUs1gh1Tpw5efGCRyrOshw6Cy3XhtCpjdyzQn4Fl6LN8gvLzX5+AjNx2X/SBUkKNsj1dRakkQ0qbAZRO9ZVENgh6J0ooEPjB7cgRgTzQLpS6G05t3op9v0RydKrtH2xY5uSTVC5+MLKYoctOpQwQeZ8knbeFv1qjcEdTGn/BNBACMqWzxu+VsjvTyb6yQcv7Q5w0M/YqD6wEjKckXdE1ejq6VpYyHtnZSsPiYtq+cJ7C117EFGwfuC4Pkl10NzLThsm93dcabhcrVZGy5HRGV083EEXP8nXoPh6C9VjN0g4LCe6a/YYo4zXGXcgc=',
    'randomAesKey': (len) => {
        let key = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':,./<>?";
        for (let i = 0; i < len; i++) {
            key += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return key;
    },
    'generateAesKey': (str) => {
        let hash = CryptoJS.SHA512(str).toString();
        return hash.substring(0, 32);
    },
    'sha256': (str) => {
        return CryptoJS.SHA256(str).toString();
    },
    'aesEncrypt': (str, key) => {
        return CryptoJS.AES.encrypt(str, key).toString();
    },
    'aesDecrypt': (str, key) => {
        return CryptoJS.AES.decrypt(str, key).toString(CryptoJS.enc.Utf8);
    },
    'setLocalStorage': (key, value) => {
        key = security.sha256(key);
        value = security.aesEncrypt(value, security.application_key);
        localStorage.setItem(key, value);
    },
    'getLocalStorage': (key) => {
        key = security.sha256(key);
        if (localStorage.getItem(key) !== null)
            return security.aesDecrypt(localStorage.getItem(key), security.application_key);
        else
            return "";
    },
    'removeLocalStorage': (key) => {
        key = security.sha256(key);
        localStorage.removeItem(key);
    }
}

const validator = {
    isValidUsername: (username) => {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    },
    isValidPassword: (password) => {
        return /^[a-zA-Z0-9_!@#${}:>]{3,}$/.test(password);
    },
    isValidName: (name) => {
        return /^[\u0600-\u06FF\s\d]+$/.test(name);
    }
};

const userModule = {
    requestRegister: (username, password, name, _csrf) => {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/user/register',
                type: 'POST',
                data: JSON.stringify({
                    name: name.value,
                    username: username.value,
                    password: password.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json'
                },
                success: function (data) {
                    if (!data.error) {
                        resolve(data);
                    }
                    else {
                        reject(data.message);
                    }
                },
                error: function (data) {
                    reject(data.responseJSON.message);
                }
            });
        });
    },
    requestLogin: (username, password, _csrf) => {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/user/login',
                type: 'POST',
                data: JSON.stringify({
                    username: username.value,
                    password: password.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json'
                },
                success: function (data) {
                    if (!data.error) {
                        security.setLocalStorage('token', data.token);
                        resolve(data);
                    }
                    else {
                        reject(data.message);
                    }
                },
                error: function (data) {
                    reject(data.responseJSON.message);
                }
            });
        });
    }
};

const adminModule = {
    requestLogin: (username, password, _csrf) => {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/admin/login',
                type: 'POST',
                data: JSON.stringify({
                    username: username.value,
                    password: password.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json'
                },
                success: function (data) {
                    if (!data.error) {
                        security.setLocalStorage('xtoken', data.token);
                        resolve(data);
                    }
                    else {
                        reject(data.message);
                    }
                },
                error: function (data) {
                    reject(data.responseJSON.message);
                }
            });
        });
    },
    requestAddCategory: (name, _csrf) => {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/admin/category/add',
                type: 'POST',
                data: JSON.stringify({
                    name: name.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json'
                },
                success: function (data) {
                    if (!data.error) {
                        resolve(data);
                    }
                    else {
                        reject(data.message);
                    }
                },
                error: function (data) {
                    reject(data.responseJSON.message);
                }
            });
        });
    }
};

const page = document.getElementById('page');
if (page !== null) {
    var page_t = page.innerHTML;
    if (page_t === 'signin') {
        var username = document.getElementById('username');
        var password = document.getElementById('password');
        var signin = document.getElementById('signin');
        var _csrf = document.getElementsByName('_csrf')[0].value;

        signin.addEventListener('click', function (e) {
            if (!validator.isValidUsername(username.value)) {
                notify('خطا', 'نام کاربری نادرست است.', 2000);
            }
            else if (!validator.isValidPassword(password.value)) {
                notify('خطا', 'رمز عبور نادرست است.', 2000);
            }
            else {
                userModule.requestLogin(username, password, _csrf).then(
                    (data) => {
                        notify('موفق', 'خوش آمدید.', 2000);
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 2000);
                    },
                    (error) => {
                        notify('خطا', error, 2000);
                    }
                );
            }
        });
    }
    else if (page_t === 'signup') {
        var _name = document.getElementById('name');
        var username = document.getElementById('username');
        var password = document.getElementById('password');
        var signup = document.getElementById('signup');
        var _csrf = document.getElementsByName('_csrf')[0].value;

        signup.addEventListener('click', function (e) {
            if (!validator.isValidName(_name.value)) {
                notify("خطا", "نام وارد شده صحیح نیست.", 2000);
            }
            else if (!validator.isValidUsername(username.value)) {
                notify("خطا", "نام کاربری صحیح نیست.", 2000);
            }
            else if (!validator.isValidPassword(password.value)) {
                notify("خطا", "رمز عبور صحیح نیست.", 2000);
            }
            else {
                userModule.requestRegister(username, password, _name, _csrf).then(
                    function (data) {
                        notify("موفق", "حساب کاربری ایجاد شد.", 2000);
                        setTimeout(function () {
                            window.location.reload();
                        }, 2000);
                    },
                    function (message) {
                        notify("خطا", message, 2000);
                    }
                );
            }
        });
    }
    else if (page_t === 'admin_login') {
        var username = document.getElementById('username');
        var password = document.getElementById('password');
        var signin = document.getElementById('signin');
        var _csrf = document.getElementsByName('_csrf')[0].value;

        signin.addEventListener('click', function (e) {
            if (!validator.isValidUsername(username.value)) {
                notify('خطا', 'نام کاربری نادرست است.', 2000);
            }
            else if (!validator.isValidPassword(password.value)) {
                notify('خطا', 'رمز عبور نادرست است.', 2000);
            }
            else {
                adminModule.requestLogin(username, password, _csrf).then(
                    (data) => {
                        notify('موفق', 'خوش آمدید.', 2000);
                        setTimeout(() => {
                            window.location = '/admin';
                        }, 2000);
                    },
                    (error) => {
                        notify('خطا', error, 2000);
                    }
                );
            }
        });
    }
    else if (page_t === 'admin_addcategory') {
        var category_name = document.getElementById('category_name');
        var submit = document.getElementById('submit');
        var _csrf = document.getElementsByName('_csrf')[0].value;

        submit.addEventListener('click', function (e) {
            if (!validator.isValidName(category_name.value)) {
                notify('خطا', 'نام دسته بندی نادرست است.', 2000);
            }
            else {
                adminModule.requestAddCategory(category_name, _csrf).then(
                    (data) => {
                        notify('موفق', 'دسته بندی ایجاد شد.', 2000);
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        });
    }
    else if (page_t === 'admin_categories') {
        // should be implemented
    }
}