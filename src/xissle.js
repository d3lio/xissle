const libxissle = (function xissle() {
    'use strict';

    const platform = (function() {
        let p;

        return function platform() {
            if (p) return p;

            try {
                if (global) return p = 'nodejs';
            } catch (err) {
                if (err instanceof ReferenceError && window) {
                    if (define) return p = 'browser.requirejs';
                } else {
                    return p = 'browser';
                }
            }
        }
    }());

    /**
     * The core part of the framework.
     *
     * Contains all the necessary features to run in any environment.
     */
    const core = (function core(platform) {
        'use strict';

        const EventEmitter = (function() {
            if (platform === 'nodejs') {
                return require('events');
            }

            return class EventEmitter {
                constructor() {
                    this.listeners = new Map();
                }

                on(event, handler) {
                    if (this.listeners.has(event)) {
                        this.listeners.get(event).push(handler);
                    } else {
                        this.listeners.set(event, [handler]);
                    }
                }

                emit(event) {
                    const handlers = this.listeners.get(event);
                    const args = Array.prototype.slice.call(arguments, 1);

                    if (handlers) {
                        handlers.forEach(handler => handler.apply(null, args));
                    }
                }
            };
        }());

        function each(target, cb) {
            if (target instanceof Array || target instanceof Set || target instanceof Map) {
                target.forEach(cb);
            } else if (typeof target === 'object') {
                for (let prop in target) {
                    if (target.hasOwnProperty(prop)) {
                        cb.call(this, target[prop], prop, target);
                    }
                }
            }
        }

        function subscribe(group, component, actions) {
            component.groups.set(group.name, group);

            const message = function message(group) {
                const g = this.get(group);

                if (g) {
                    g.emit(...Array.prototype.slice.call(arguments, 1));
                } else {
                    throw new XissleError(`Group ${group} not found.`);
                }
            }.bind(component.groups);

            if (actions === true) {
                actions = Object.keys(component.actions);
            }

            if (actions === false) {
                actions = [];
            }

            if (actions instanceof Array) {
                actions = new Set(actions);
                each(component.actions, (handler, event) => {
                    if (actions.has(event)) {
                        // TODO(high): the listener should probably know who called it.
                        group.on(event, handler.bind(
                            component.storage,
                            {
                                name: component.name,
                                storage: component.storage,
                                groups: component.groups,
                                currentGroup: group,
                                message: message
                            }
                        ));
                    }
                });

                return;
            }

            throw new XissleError('');
        }

        class XissleError extends Error {
            constructor(msg) {
                super(msg);
            }
        }

        class Xissle {
            constructor(global) {
                this.components = new Map([
                    ['global', new ExternalComponent('global', global, {})]
                ]);

                this.groups = new Map([
                    ['global', new Group('global')]
                ]);
            }

            component(component) {
                if (!(component instanceof ExternalComponent)) {
                    throw new XissleError('Trying to register a non component.');
                }

                if (this.components.has(component.name)) {
                    throw new XissleError('Duplicate component name.');
                }

                const global = this.groups.get('global');

                this.components.set(component.name, component);

                subscribe(global, component, ['main']);
            }

            group(name, components) {
                if (this.groups.has(name)) {
                    throw new XissleError('Duplicate group name.');
                }

                const group = new Group(name);
                this.groups.set(name, group);

                each(components, (actions, name) => {
                    subscribe(group, this.components.get(name), actions)
                });
            }

            channel(name, a, b) {
                this.group(name, { [a]: true, [b]: true });
            }

            run() {
                this.groups.get('global').emit('main', ...arguments);
            }
        }

        Xissle.immutable = function immutable(obj) {
            return Object.freeze(obj);
        };

        class Group extends EventEmitter {
            constructor(name) {
                super();
                this.name = name;
            }
        }

        /**
         * The base type of component.
         *
         * This should be used to wrap any third party or core language objects before introducing
         * them into the system. It should not be used by users to bypass Component's and
         * MutableComponent's storage guarantees.
         */
        class ExternalComponent {
            constructor(name, storage, actions) {
                this.name = name || '';
                this.storage = storage || {};
                this.actions = actions || {};
                this.groups = new Map();
            }
        }

        /**
         * Storage mutability with type checking on value set.
         *
         * This does have runtime overhead and thus should be used only when really necessary.
         */
        class MutableComponent extends ExternalComponent {
            constructor(name, storage, actions) {
                super(...arguments);

                const valueStorage = this.storage;
                const supervisedStorage = {};

                each(valueStorage, (value, key) => {
                    if (value === null || value === undefined) {
                        throw new XissleError(`Uninitialized: ${name}.${key}`);
                    }

                    Object.defineProperty(supervisedStorage, key, {
                        get: function() {
                            return valueStorage[key];
                        },
                        set: function(value) {
                            if (typeof value !== typeof this[key] || value === null) {
                                throw new XissleError(`Type missmatch: ${name}.${key} expected ` +
                                    `'${typeof this[key]}' found ` +
                                    `'${value === null ? 'null' : typeof value}'`);
                            }
                            valueStorage[key] = value;
                        }
                    });
                });

                this.storage = Object.seal(supervisedStorage);
            }
        }

        /**
         * Shallow storage immutability
         */
        class Component extends ExternalComponent {
            constructor(name, storage, actions) {
                super(...arguments);

                each(this.storage, (value, key) => {
                    if (value === null || value === undefined) {
                        throw new XissleError(`Uninitialized: ${name}.${key}`);
                    }
                });

                this.storage = Object.freeze(this.storage);
            }
        }

        return {
            Xissle,
            XissleError,
            ExternalComponent,
            MutableComponent,
            Component,
            Group
        };
    }(platform()));

    /**
     * The browser part of the framework.
     *
     * Contains html components and the dom parser.
     */
    function browser(core) {
        'use strict';

        const { Xissle, ExternalComponent } = core;

        const components = (function components() {
            function emit(group, event, args) {
                if (group.name !== 'global') {
                    group.emit(event, ...args);
                }
            }

            function htmlElementEventsProxy(element, component, events) {
                events.forEach(event => {
                    function listener(ev) {
                        component.groups.forEach(group => emit(group, event, [ev]));
                    }

                    if (!element._xissleEventListeners) {
                        element._xissleEventListeners = new Map([[event, [listener]]]);
                    } else {
                        const listeners = element._xissleEventListeners.get(event);
                        if (listeners) {
                            listeners.push(listener);
                        } else {
                            element._xissleEventListeners.set(event, [listener]);
                        }
                    }

                    // Attach the native handler
                    element.addEventListener(event, listener);
                });
            }

            class HtmlComponent extends ExternalComponent {
                constructor(name, element, events) {
                    super(name, element, {});

                    htmlElementEventsProxy(element, this, events);
                }
            }

            class ButtonComponent extends HtmlComponent {
                constructor(name, element, events) {
                    super(...arguments);
                }
            }

            class TextFieldComponent extends HtmlComponent {
                constructor(name, element, events) {
                    super(...arguments);

                    this.actions = {
                        text(ctx, argument) {
                            // TODO(high): revisit this concept of callback getter
                            if (typeof argument === 'string') {
                                this.value = argument;

                                const oninput = this._xissleEventListeners.get('input');
                                if (oninput) {
                                    oninput.forEach(handler => handler({
                                        // TODO: use the InputEvent class
                                        type: "input",
                                        target: this
                                    }));
                                }
                            } else if (typeof argument === 'function') {
                                argument.call(null, this.value);
                            }
                        }
                    };
                }
            }

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

            return {
                HtmlComponent,
                ButtonComponent,
                TextFieldComponent,
                ConsoleComponent,
            };
        }());

        const views = (function views() {
            class View {
                constructor(name) {
                    `div(
                        data-component: {


                        },
                        class: ""
                    ) {
                        div()
                    }`;
                    ['div', {'data-component': {}}, [
                        ['div', {}, []]
                    ]];
                }
            }

            return {
                View: View
            };
        }());

        Xissle.prototype.parseDom = function parseDom() {
            const htmlElements = document.querySelectorAll('[data-component]') || [];

            htmlElements.forEach(element => {
                let config;

                try {
                    config = JSON.parse(element.dataset.component);
                } catch(err) {
                    throw new XissleError(`TODO ${err.message}`);
                }

                const constructor = components[config.type];

                if (!constructor) {
                    throw new XissleError(`Nonexisting constructor ${config.type} while parsing DOM`);
                }

                // Create the desired component.
                const component = new constructor(config.name, element, config.emits);

                if (!(component instanceof components.HtmlComponent)) {
                    throw new XissleError('Element tried to instanciate a non HtmlComponent while parsing DOM');
                }

                this.component(component);

                if (config.channel) {
                    this.channel(config.channel.name, component.name, config.channel.to);
                }
            });
        }

        return {
            componenets: components,
            views: views
        };
    }

    const lib = {
        core: core
    };

    if (platform().indexOf('browser') === 0) {
        lib.browser = browser(core);
    }

    switch (platform()) {
        case 'nodejs':
            module.exports = lib;
            break;
        case 'browser.requirejs':
            define(() => lib);
            break;
        default:
            return lib;
    }
}());
