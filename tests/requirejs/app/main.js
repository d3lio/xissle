define(require => {
    'use strict';

    const lib = require('src/xissle');
    const {Xissle, Component} = lib.core;
    const {HtmlComponent} = lib.browser.components;
    const {View} = lib.browser.views;

    const xissle = new Xissle();

    class ConsoleComponent extends HtmlComponent {
        constructor(name, element, events) {
            super(name, element, events);

            this.actions = {
                log(ctx, text) {
                    const date = new Date();
                    const format = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
                    this.innerHTML += `${format}: ${text}<br>`;
                    this.scrollTop = this.scrollHeight;
                }
            };
        }
    }
    xissle.registerHtmlComponentClass(ConsoleComponent);

    xissle.component(new Component('logic', {}, {
        click({ message }) {
            message('box1', 'text', 'Hello world1!');
            message('box2', 'text', 'Hello world2!');
        },

        keypress({ message }, event) {
            message('con', 'log', event.key);
        },

        input({ message }, event) {
            message('con', 'log', event.target.value);
        }
    }));

    const view = new View('v1', {
        c1: {
            type: 'ButtonComponent',
            emits: ['click'],
            channel: { name: 'btn', to: 'logic' }
        },
        c2: {
            type: 'TextFieldComponent',
            emits: ['input', 'keypress'],
            channel: { name: 'box1', to: 'logic' }
        },
        c3: {
            type: 'TextFieldComponent',
            emits: ['keypress'],
            channel: { name: 'box2', to: 'logic' }
        },
        c4: {
            type: 'TextFieldComponent',
            emits: ['keypress'],
            channel: { name: '_', to: 'logic' }
        },
        c5: {
            type: 'ConsoleComponent',
            emits: [],
            channel: { name: 'con', to: 'logic' }
        }
    }, `
        <button type="button" data-component="c1">Press me</button>
        <input type="text" data-component="c2"/>
        <input type="text" data-component="c3"/>
        <input type="text" data-component="c4"/>
        <div class="console" data-component="c5"></div>
    `);

    xissle.view(document.querySelector('body > div'), view);

    xissle.run();
});
