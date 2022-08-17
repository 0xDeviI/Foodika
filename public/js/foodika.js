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
    },
    isValidFoodDescription: (description) => {
        return /^[\u0600-\u06FF\s\d\.,،:'"*()-_+=]+$/.test(description);
    },
    isValidObjectId: (objectId) => {
        return /^[0-9a-fA-F]{24}$/.test(objectId);
    },
    isValidImage: (image) => {
        if (image === undefined || image === null)
        {
            return true;
        }
        else {
            let maxFileSize = 1024 * 1024 * 5; // 5MB
            let allowedFileTypes = ['image/png', 'image/jpeg', 'image/gif'];
            let fileSize = image.size;
            let fileType = image.type;
            return fileSize <= maxFileSize && allowedFileTypes.includes(fileType);
        }
    },
    isValidPrice: (price) => {
        return /^[0-9]{1,10}$/.test(price);
    },
    isValidRole: (role) => {
        return role === 'user' || role === 'admin' || role === 'kitchen' || role === 'reception';
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
    },
    requestAddToCart: (id, quantity, _csrf) => {
        var token = security.getLocalStorage('token');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/user/cart',
                type: 'POST',
                data: JSON.stringify({
                    id: id,
                    quantity: quantity
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestDeleteOrder: (id, _csrf) => {
        var token = security.getLocalStorage('token');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/user/cart/' + id,
                type: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Authorization': 'Bearer ' + token
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
    requestCompleteOrder: (id, method, address, phone, _csrf) => {
        var token = security.getLocalStorage('token');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/user/cart/' + id,
                type: 'PUT',
                data: JSON.stringify({
                    method: method,
                    address: address.value,
                    phone: phone.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                success: function (data) {
                    if (!data.error) {
                        resolve(data);
                    }
                    else {
                        reject(data.message);
                    }
                }
            });
        });
    },
    requestOnlinePaymentToken: (id, address, phone, _csrf) => {
        var token = security.getLocalStorage('token');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/user/payment',
                type: 'POST',
                data: JSON.stringify({
                    id: id,
                    address: address.value,
                    phone: phone.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/admin/category/add',
                type: 'POST',
                data: JSON.stringify({
                    name: name.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestDeleteCategory: (id, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/category/${id}`,
                type: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestEditCategory: (id, name, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/category/${id}`,
                type: 'PUT',
                data: JSON.stringify({
                    name: name
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestAddFood: (name, description, category, image, price, available, _csrf) => {
        var formData = new FormData();
        formData.append('name', name.value);
        formData.append('description', description.value);
        formData.append('category', category.value);
        formData.append('image', image.files[0]);
        formData.append('price', price.value);
        formData.append('available', available.checked.toString());
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/admin/food/add',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Authorization': 'Bearer ' + token
                },
                success: function (data) {
                    if (!data.error) {
                        resolve(data);
                    }
                    else {
                        reject(data.message);
                    }
                }
            });
        });
    },
    requestDeleteFood: (id, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/food/${id}`,
                type: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestEditFood: (id, name, description, category, image, price, available, deletePhoto, _csrf) => {
        var formData = new FormData();
        formData.append('name', name.value);
        formData.append('description', description.value);
        formData.append('category', category.value);
        formData.append('image', image.files[0]);
        formData.append('price', price.value);
        formData.append('available', available.checked.toString());
        formData.append('deletePhoto', deletePhoto.checked.toString());
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/food/${id}`,
                type: 'PUT',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Authorization': 'Bearer ' + token
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
    requestAddUser: (name, username, password, role, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/api/v1/admin/user/add',
                type: 'POST',
                data: JSON.stringify({
                    name: name.value,
                    username: username.value,
                    password: password.value,
                    role: role.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestDeleteUser: (id, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/user/${id}`,
                type: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestEditUser: (id, name, username, password, role, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/user/${id}`,
                type: 'PUT',
                data: JSON.stringify({
                    name: name.value,
                    username: username.value,
                    password: password.value,
                    role: role.value
                }),
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestOrderOnWay: (id, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/order/${id}/onway`,
                type: 'PUT',
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
    requestOrderDelivered: (id, _csrf) => {
        var token = security.getLocalStorage('xtoken');
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/api/v1/admin/order/${id}/delivered`,
                type: 'PUT',
                headers: {
                    'X-CSRF-TOKEN': _csrf,
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
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
                        notify('موفق', 'دسته بندی ایجاد شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        });
    }
    else if (page_t === 'admin_categories') {
        var _csrf = document.getElementsByName('_csrf')[0].value;
        function deleteCategory(obj) {
            var confirm = window.confirm('آیا از حذف این دسته بندی اطمینان دارید؟');
            if (confirm) {
                var id = obj.getAttribute('data-id');
                adminModule.requestDeleteCategory(id, _csrf).then(
                    (data) => {
                        notify('موفق', 'دسته بندی حذف شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        }
        function editCategory(obj) {
            var id = obj.getAttribute('data-id');
            var newCategory = prompt('نام جدید دسته بندی را وارد کنید.');
            if (!validator.isValidName(newCategory)) {
                notify('خطا', 'نام جدید دسته بندی نادرست است.', 2000);
            }
            else {
                adminModule.requestEditCategory(id, newCategory, _csrf).then(
                    (data) => {
                        notify('موفق', 'دسته بندی ویرایش شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        }
    }
    else if (page_t === 'admin_addfood') {
        var food_name = document.getElementById('food_name');
        var food_description = document.getElementById('food_desc');
        var food_category = document.getElementById('food_category');
        var food_image = document.getElementById('food_image');
        var food_price = document.getElementById('food_price');
        var isAvailable = document.getElementById('food_availability');
        var submit = document.getElementById('submit');
        var _csrf = document.getElementsByName('_csrf')[0].value;

        submit.addEventListener('click', function (e) {
            if (!validator.isValidName(food_name.value)) {
                notify('خطا', 'نام غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidFoodDescription(food_description.value)) {
                notify('خطا', 'توضیحات غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidObjectId(food_category.value)) {
                notify('خطا', 'دسته بندی غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidImage(food_image.files[0])) {
                notify('خطا', 'تصویر غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidPrice(food_price.value)) {
                notify('خطا', 'قیمت غذا غیرمجاز است.', 2000);
            }
            else {
                adminModule.requestAddFood(food_name, food_description, food_category, food_image, food_price, isAvailable, _csrf).then(
                    (data) => {
                        notify('موفق', 'غذا جدید ثبت شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
            
        });
    }
    else if (page_t === 'admin_foods') {
        var _csrf = document.getElementsByName('_csrf')[0].value;
        function deleteFood(obj) {
            var confirm = window.confirm('آیا از حذف این غذا اطمینان دارید؟');
            if (confirm) {
                var id = obj.getAttribute('data-id');
                adminModule.requestDeleteFood(id, _csrf).then(
                    (data) => {
                        notify('موفق', 'غذا حذف شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        }
    }
    else if (page_t === 'admin_editfood') {
        var food_name = document.getElementById('food_name');
        var food_id = food_name.getAttribute('data-id');
        var food_description = document.getElementById('food_desc');
        var food_category = document.getElementById('food_category');
        var food_image = document.getElementById('food_image');
        var food_price = document.getElementById('food_price');
        var isAvailable = document.getElementById('food_availability');
        var deletePhoto = document.getElementById('deletePhoto');
        var submit = document.getElementById('submit');
        var _csrf = document.getElementsByName('_csrf')[0].value;

        submit.addEventListener('click', function (e) {
            if (!validator.isValidName(food_name.value)) {
                notify('خطا', 'نام غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidFoodDescription(food_description.value)) {
                notify('خطا', 'توضیحات غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidObjectId(food_category.value)) {
                notify('خطا', 'دسته بندی غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidImage(food_image.files[0])) {
                notify('خطا', 'تصویر غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidPrice(food_price.value)) {
                notify('خطا', 'قیمت غذا غیرمجاز است.', 2000);
            }
            else if (!validator.isValidObjectId(food_id)) {
                notify('خطا', 'شناسه غذا غیرمجاز است.', 2000);
            }
            else {
                adminModule.requestEditFood(food_id, food_name, food_description, food_category, food_image, food_price, isAvailable, deletePhoto, _csrf).then(
                    (data) => {
                        notify('موفق', 'غذا ویرایش شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
            
        });
    }
    else if (page_t === 'food') {
        function addToCart(obj) {
            var id = obj.getAttribute('data-id');
            var available = obj.getAttribute('data-available');
            var quantity = document.getElementById('quantity');
            var _csrf = document.getElementsByName('_csrf')[0].value;
            if (available.toLowerCase() !== 'true') {
                notify('خطا', 'این غذا در دسترس نمی باشد.', 2000);
            }
            else {
                let isLoggedIn = security.getLocalStorage('isLoggedIn');
                if (isLoggedIn.toLowerCase() !== 'true') {
                    notify('خطا', 'برای خرید ابتدا وارد شوید.', 2000);
                }
                else {
                    userModule.requestAddToCart(id, quantity.value, _csrf).then(
                        (data) => {
                            notify('موفق', 'به سبد خرید اضافه شد.', 500);
                            setTimeout(() => {
                                window.location.reload();
                            }, 500);
                        },
                        (message) => {
                            notify('خطا', message, 2000);
                        }
                    );
                }
            }
        }
        var addToCardBtn = document.getElementById('addToCard');

        addToCardBtn.addEventListener('click', function (e) {
            addToCart(addToCardBtn);
        });
    }
    else if (page_t === 'orders') {
        function deleteOrder(obj) {
            var confirm = window.confirm('آیا از حذف این سفارش اطمینان دارید؟');
            if (confirm) {
                var id = obj.getAttribute('data-id');
                var _csrf = document.getElementsByName('_csrf')[0].value;
                userModule.requestDeleteOrder(id, _csrf).then(
                    (data) => {
                        notify('موفق', 'سفارش حذف شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        }

        function completeOrder(obj) {
            var onlinePay = document.getElementById('onlinePay');
            var payOnDelivery = document.getElementById('payOnDeliver');
            var payOnStore = document.getElementById('payOnStore');
            var address = document.getElementById('address');
            var phone = document.getElementById('phone');
            if (!onlinePay.checked && !payOnDelivery.checked && !payOnStore.checked) {
                notify('خطا', 'حداقل یکی از گزینه های پرداخت را انتخاب کنید.', 2000);
            }
            else {
                var confirm = window.confirm('آیا از تکمیل این سفارش اطمینان دارید؟');
                var id = obj.getAttribute('data-id');
                var method = onlinePay.checked ? 'online' : (payOnDelivery.checked ? 'pay on delivery' : 'pay in store');
                if (confirm) {
                    if (method == 'online') { 
                        var _csrf = document.getElementsByName('_csrf')[0].value;
                        userModule.requestOnlinePaymentToken(id, address, phone, _csrf).then(
                            (data) => {
                                notify('موفق', 'به صفحه پرداخت بانک منتقل می شوید.', 1500);
                                setTimeout(() => {
                                    window.location.href = data.payment;
                                }, 1500);
                            },
                            (message) => {
                                notify('خطا', message, 2000);
                            }
                        );
                    }
                    else {
                        var _csrf = document.getElementsByName('_csrf')[0].value;
                        userModule.requestCompleteOrder(id, method, address, phone, _csrf).then(
                            (data) => {
                                notify('موفق', 'سفارش تکمیل شد.', 500);
                                setTimeout(() => {
                                    window.location.reload();
                                }, 500);
                            }
                        );
                    }
                }
            }
        }
    }
    else if (page_t === 'admin_adduser') {
        var _name = document.getElementById('name');
        var username = document.getElementById('username');
        var password = document.getElementById('password');
        var _csrf = document.getElementsByName('_csrf')[0].value;
        var role = document.getElementById('role');
        var submit = document.getElementById('submit');

        submit.addEventListener('click', function (e) {
            if (!validator.isValidName(_name.value)) {
                notify('خطا', 'نام وارد شده معتبر نیست.', 2000);
            }
            else if (!validator.isValidUsername(username.value)) {
                notify('خطا', 'نام کاربری وارد شده معتبر نیست.', 2000);
            }
            else if (!validator.isValidPassword(password.value)) {
                notify('خطا', 'رمز عبور وارد شده معتبر نیست.', 2000);
            }
            else if (!validator.isValidRole(role.value)) {
                notify('خطا', 'نقش کاربری وارد شده معتبر نیست.', 2000);
            }
            else {
                adminModule.requestAddUser(_name, username, password, role, _csrf).then(
                    (data) => {
                        notify('موفق', 'کاربر با موفقیت اضافه شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        });
    }
    else if (page_t === 'admin_users') {
        function deleteUser(obj) {
            var confirm = window.confirm('آیا از حذف این کاربر اطمینان دارید؟');
            if (confirm) {
                var id = obj.getAttribute('data-id');
                var _csrf = document.getElementsByName('_csrf')[0].value;
                adminModule.requestDeleteUser(id, _csrf).then(
                    (data) => {
                        notify('موفق', 'کاربر حذف شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        }
    }
    else if (page_t === 'admin_edituser') {
        var _name = document.getElementById('name');
        var username = document.getElementById('username');
        var password = document.getElementById('password');
        var _csrf = document.getElementsByName('_csrf')[0].value;
        var role = document.getElementById('role');
        var submit = document.getElementById('submit');
        var id = submit.getAttribute('data-id');

        submit.addEventListener('click', function (e) {
            if (!validator.isValidName(_name.value)) {
                notify('خطا', 'نام وارد شده معتبر نیست.', 2000);
            }
            else if (!validator.isValidUsername(username.value)) {
                notify('خطا', 'نام کاربری وارد شده معتبر نیست.', 2000);
            }
            else if (!validator.isValidPassword(password.value)) {
                notify('خطا', 'رمز عبور وارد شده معتبر نیست.', 2000);
            }
            else if (!validator.isValidRole(role.value)) {
                notify('خطا', 'نقش کاربری وارد شده معتبر نیست.', 2000);
            }
            else {
                adminModule.requestEditUser(id, _name, username, password, role, _csrf).then(
                    (data) => {
                        notify('موفق', 'ویرایش اطلاعات کاربر با موفقیت انجام شد.', 500);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    },
                    (message) => {
                        notify('خطا', message, 2000);
                    }
                );
            }
        });
    }
    else if (page_t === 'admin_kitchen') {
        function orderOnWay(obj) {
            var id = obj.getAttribute('data-id');
            var _csrf = document.getElementsByName('_csrf')[0].value;
            adminModule.requestOrderOnWay(id, _csrf).then(
                (data) => {
                    notify('موفق', 'سفارش درحال ارسال به مشتری است.', 500);
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                },
                (message) => {
                    notify('خطا', message, 2000);
                }
            );
        }

        function orderDelivered(obj) {
            var id = obj.getAttribute('data-id');
            var _csrf = document.getElementsByName('_csrf')[0].value;
            adminModule.requestOrderDelivered(id, _csrf).then(
                (data) => {
                    notify('موفق', 'سفارش به دست مشتری رسید.', 500);
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                },
                (message) => {
                    notify('خطا', message, 2000);
                }
            );
        }

        // refresh after each 1 minute
        setInterval(() => {
            window.location.reload();
        }, 60000);
    }
}