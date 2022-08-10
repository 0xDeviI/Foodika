function startTimer(otpTime, display) {
    var otpTime = new Date(otpTime).getTime();
    var time = new Date(otpTime + 2 * 60 * 1000).getTime();
    var interval = setInterval(function () {
        var now = new Date().getTime();
        if (now > time) {
            clearInterval(interval);
            notify("خطا", "رمز یکبار مصرف منقضی شد.", 2000);
            setTimeout(function() {
                security.removeLocalStorage('otpRequested');
                security.removeLocalStorage('time');
                window.location.href = "/signin";
            }, 3000);
        } else {
            var distance = time - now;
            var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString();
            var seconds = Math.floor((distance % (1000 * 60)) / 1000).toString();
            display.innerHTML = (minutes.length == 1 ? `0${minutes}` : minutes) + ":" + (seconds.length == 1 ? `0${seconds}` : seconds);
        }
    } , 1000);
}

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

function isValidOTP(otp) {
    return !isNaN(otp) && otp.length === 6;
}

function isValidPhone(phone) {
    return !isNaN(phone) && phone.length === 11 || phone.startsWith('0');
}

const page = document.getElementById('page');
if (page !== null) {
    var page_t = page.innerHTML;
    if (page_t === 'signin') {
        var phone = document.getElementById('phone');
        var signin = document.getElementById('signin');
        var _csrf = document.getElementsByName('_csrf')[0].value;
        var pptext = document.getElementById('ptext');
        var otp_time = document.getElementById('otp_time');
        var otp_time_t = document.getElementById('otp_time_t');
        
        if (security.getLocalStorage('otpRequested') === 'true') {
            phone.setAttribute('maxlength', '6');
            phone.placeholder = 'رمز یکبار مصرف خود را وارد کنید';
            ptext.innerHTML = ` رمز یکبار مصرف به شماره تلفن ${security.getLocalStorage('phone')} ارسال شد.`;
            signin.innerText = 'تایید رمز';
            otp_time.setAttribute('style', 'display: block;');
            var currentTime = new Date();
            var otpTime = new Date(new Number(security.getLocalStorage('time')));
            startTimer(otpTime, otp_time_t);
            signin.addEventListener('click', function (e) {
                if (!isValidOTP(phone.value)) {
                    notify("خطا", "رمز یکبار مصرف صحیح نیست.", 2000);
                }
                else {
                    $.ajax({
                        url: '/api/v1/login',
                        type: 'POST',
                        data: JSON.stringify({
                            otp: phone.value,
                            phone: security.getLocalStorage('phone'),
                        }),
                        headers: {
                            'X-CSRF-TOKEN': _csrf,
                            'Content-Type': 'application/json'
                        },
                        success: function (data) {
                            if (!data.error) {
                                security.removeLocalStorage('otpRequested');
                                security.removeLocalStorage('time');
                                security.removeLocalStorage('phone');
                                security.setLocalStorage('loggedIn', 'true');
                                security.setLocalStorage('token', data.token);
                                setTimeout(function () {
                                    // window.location.href = '/dashboard';
                                }, 2000);
                            }
                            else {
                                notify("خطا", data.message, 2000);
                            }
                        }
                    });
                }
            });
        }
        else {
            signin.addEventListener('click', function (e) {
                if (!isValidPhone(phone.value)) {
                    notify("خطا", "شماره موبایل را به درستی وارد کنید.", 2000);
                }
                else {
                    $.ajax({
                        url: '/api/v1/otp',
                        type: 'POST',
                        data: JSON.stringify({
                            phone: phone.value
                        }),
                        headers: {
                            'X-CSRF-TOKEN': _csrf,
                            'Content-Type': 'application/json'
                        },
                        success: function (data) {
                            if (!data.error) {
                                security.setLocalStorage('otpRequested', 'true');
                                security.setLocalStorage('phone', phone.value);
                                security.setLocalStorage('time', new Date().getTime().toString());
                                window.location.reload();
                            }
                            else {
                                notify("خطا", data.message, 2000);
                            }
                        }
                    });
                }
            });
        }
    }
}