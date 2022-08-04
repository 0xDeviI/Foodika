const express = require('express');
const app = express();
const hbs = require('hbs');
const dotenv = require('dotenv');
const PORT = process.env.PORT || 3000;
dotenv.config();

hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.render('layouts/index', {
        title: process.env.SITE_TITLE,
        name: process.env.SITE_NAME
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});