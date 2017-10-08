/* eslint no-console: "off" */

const path = require('path');
const express = require('express');
const app = express();

function staticDir(dir) {
    return express.static(path.join(__dirname, dir));
}

app.use('/', staticDir('public'));
app.use('/mods', staticDir('src'));
app.use('/mods', staticDir('node_modules/requirejs/'));

app.listen(3000, () => console.log('Listening on 3000'));
