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

            function formatFixedDigits(n) {
                return (n < 10 ? '0' : '') + n;
            }

            this.actions = {
                log(ctx, text) {
                    const date = new Date();
                    const format = `${formatFixedDigits(date.getHours())}:` +
                                   `${formatFixedDigits(date.getMinutes())}:` +
                                   `${formatFixedDigits(date.getSeconds())}`;
                    this.innerHTML += `<div class="line"><time>${format}</time> ` +
                                      `<div class="line-content">${text}</div></div>`;
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

        keypress({ message, from }, event) {
            message('con', 'log', `${from}: ${event.key}`);
        },

        input({ message, from }, event) {
            message('con', 'log', `${from}: ${event.target.value}`);
        }
    }));

    xissle.view(new View('v1', 'url:main/main.html', {
        btn: {
            type: 'ButtonComponent',
            emits: ['click'],
            channel: { name: 'btn', to: 'logic' }
        },
        tf1: {
            type: 'TextFieldComponent',
            emits: ['input'],
            channel: { name: 'box1', to: 'logic' }
        },
        tf2: {
            type: 'TextFieldComponent',
            emits: ['keypress'],
            channel: { name: 'box2', to: 'logic' }
        },
        tf3: {
            type: 'TextFieldComponent',
            emits: ['keypress'],
            channel: { name: '_', to: 'logic' }
        },
        console: {
            type: 'ConsoleComponent',
            emits: [],
            channel: { name: 'con', to: 'logic' }
        }
    }));

    xissle.run();
});
