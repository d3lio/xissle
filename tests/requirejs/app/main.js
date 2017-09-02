define(require => {
    'use strict';

    const lib = require('src/xissle');
    const {Xissle, Component} = lib.core;
    const {ButtonComponent, TextFieldComponent} = lib.browser;

    const xissle = new Xissle(window);

    xissle.component(new Component('logic', {}, {
        click({ message }) {
            message('box1', 'text', `Hello world1!`);
            message('box2', 'text', `Hello world2!`);
        },

        keypress({ message }, event) {
            message('con', 'log', event.key);
        },

        input({ message }, event) {
            message('con', 'log', event.target.value);
        }
    }));

    xissle.parseDom();

    xissle.run();
});
