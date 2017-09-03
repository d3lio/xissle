define(require => {
    'use strict';

    const lib = require('src/xissle');
    const {Xissle, Component} = lib.core;
    const {HtmlComponent} = lib.browser.components;

    class ConsoleComponent extends HtmlComponent {
        constructor(name, element, events) {
            super(...arguments);

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

    xissle.parseDom({ ConsoleComponent });

    xissle.run();
});
