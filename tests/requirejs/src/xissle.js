// TODO try to fit browser ES6 modules, nodejs and requirejs
const libxissle = (function xissle() { // eslint-disable-line no-unused-vars
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
                    return p = 'browser';
                } else {
                    return p = 'unknown';
                }
            }
        };
    }());

    /**
     * The core part of the framework.
     *
     * Contains all the necessary features to run in any environment.
     */
    const core = (function core(platform) {
        'use strict';

        const {each, argsToArray} = (function helpers() {
            // TODO(medium): consistency
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

            function argsToArray() {
                const args = new Array(arguments.length);
                for (let i = 0; i < args.length; i++) {
                    args[i] = arguments[i];
                }
                return args;
            }

            return {
                each,
                argsToArray
            };
        }());

        const EventEmitter = (function eventEmitter() {
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
                    const args = argsToArray.apply(null, arguments).slice(1);

                    if (handlers) {
                        handlers.forEach(handler => handler.apply(null, args));
                    }
                }
            };
        }());

        /**
         * Private method for subscribing a component's selected actions to a group.
         *
         * @param {Group} group
         * @param {instanceof ExternalComponent} component
         * @param {Object} publicActions
         */
        function subscribe(group, component, publicActions) {
            component.groups.set(group.name, group);

            if (publicActions === true) {
                publicActions = Object.keys(component.actions);
            } else if (publicActions === false) {
                publicActions = [];
            }

            if (!(publicActions instanceof Array)) {
                throw new XissleError('Invalid action subscription arguments: expected ' +
                    `'true/false/string[]' found '${typeof publicActions}'`);
            }

            const publicActionsSet = new Set(publicActions);
            each(component.actions, (handler, event) => {
                if (publicActionsSet.has(event)) {
                    group.on(event, function(fromComponent) {
                        const context = {
                            from: fromComponent,
                            group: group.name,
                            info: component.info,
                            message: component.message.bind(component)
                        };

                        handler.call(component.storage, context,
                            ...argsToArray.apply(null, arguments).slice(1));
                    });
                }
            });
        }

        class XissleError extends Error {
            constructor(msg) {
                super(msg);
            }
        }

        class Xissle {
            constructor() {
                let globalObj = {};

                if (platform === 'nodejs') {
                    globalObj = global;
                } else if (platform.indexOf('browser') === 0) {
                    globalObj = window;
                }

                // TODO(medium): make this useful
                this.components = new Map([
                    ['global', new ExternalComponent('global', globalObj, {})]
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

                this.components.set(component.name, component);

                const global = this.groups.get('global');

                subscribe(global, component, ['main']);
            }

            group(name, components) {
                if (this.groups.has(name)) {
                    throw new XissleError('Duplicate group name.');
                }

                const group = new Group(name);
                this.groups.set(name, group);

                each(components, (actions, name) => {
                    subscribe(group, this.components.get(name), actions);
                });
            }

            channel(name, comp1, comp2) {
                this.group(name, { [comp1]: true, [comp2]: true });
            }

            run() {
                const runMain = () => {
                    this.groups.get('global').emit('main', 'global', ...arguments);
                };

                if (platform.indexOf('browser') === 0) {
                    this.loadViews(arguments[0] || document).then(runMain);
                } else {
                    runMain();
                }
            }
        }

        Xissle.mutable = function mutable(obj, name) {
            const objName = name || '_anonymous_';
            const valueStorage = obj;
            const supervisedStorage = {};

            each(valueStorage, (value, key) => {
                if (value === null || value === undefined) {
                    throw new XissleError(`Uninitialized: ${objName}.${key}`);
                }

                Object.defineProperty(supervisedStorage, key, {
                    get: function() {
                        return valueStorage[key];
                    },
                    set: function(value) {
                        if (typeof value !== typeof this[key] || value === null) {
                            throw new XissleError(`Type missmatch: ${objName}.${key} expected ` +
                                `'${typeof this[key]}' found ` +
                                `'${value === null ? 'null' : typeof value}'`);
                        }
                        valueStorage[key] = value;
                    }
                });
            });

            return Object.seal(supervisedStorage);
        };

        Xissle.immutable = function immutable(obj, name) {
            const objName = name || '_anonymous_';

            each(obj, (value, key) => {
                if (value === null || value === undefined) {
                    throw new XissleError(`Uninitialized: ${objName}.${key}`);
                }
            });

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
                this.name = (name || '') + '';
                this.storage = storage || {};
                this.actions = actions || {};
                this.groups = new Map();
            }

            info() {
                return {
                    name: this.name,
                    storage: this.storage,
                    groups: new Set(this.groups.keys()),
                };
            }

            /**
             * Message every component in a group.
             *
             * @param {string} group    The group's name to be broadcasted in.
             * @param {string} event    The event name.
             * @param {*} ...           The rest of the arguments are passed to the event handler.
             */
            message(group, event) {
                const g = this.groups.get(group);

                if (g) {
                    g.emit(event, this.name, ...argsToArray.apply(null, arguments).slice(2));
                } else {
                    throw new XissleError(`Group ${group} not found.`);
                }
            }
        }

        /**
         * Storage mutability with type checking on value set.
         *
         * This does have runtime overhead and thus should be used only when really necessary.
         */
        class MutableComponent extends ExternalComponent {
            constructor(name, storage, actions) {
                super(name, storage, actions);

                this.storage = Xissle.mutable(this.storage, this.name);
            }
        }

        /**
         * Shallow storage immutability
         */
        class Component extends ExternalComponent {
            constructor(name, storage, actions) {
                super(name, storage, actions);

                this.storage = Xissle.immutable(this.storage);
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

        const { Xissle, XissleError, ExternalComponent } = core;

        const http = (function http() {
            function request(method, path, opts) {
                return new Promise((res, rej) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open(method, path);
                    if (opts && typeof opts.raw === 'function') {
                        opts.raw(xhr);
                    }
                    xhr.onload = function() {
                        res(xhr.responseText);
                    };
                    xhr.onerror = function() {
                        rej();
                    };
                    xhr.send();
                });
            }

            // TODO(medium): consider making this module as a special IOComponent.
            class Http {
                constructor() {}

                get(url, opts) {
                    return request('GET', url, opts);
                }
            }

            const http = new Http();

            return http;
        }());

        const components = (function components() {
            class HtmlComponent extends ExternalComponent {
                constructor(name, element, events) {
                    super(name, element, {});

                    const self = this;

                    events.forEach(event => {
                        function listener(ev) {
                            self.groups.forEach(group => {
                                if (group.name !== 'global') {
                                    group.emit(event, self.name, ev);
                                }
                            });
                        }

                        if (!element.__xissleEventListeners) {
                            element.__xissleEventListeners = new Map([[event, [listener]]]);
                        } else {
                            const listeners = element.__xissleEventListeners.get(event);
                            if (listeners) {
                                listeners.push(listener);
                            } else {
                                element.__xissleEventListeners.set(event, [listener]);
                            }
                        }

                        // Attach the native handler
                        element.addEventListener(event, listener);
                    });
                }
            }

            class ButtonComponent extends HtmlComponent {
                constructor(name, element, events) {
                    super(name, element, events);
                }
            }

            class TextFieldComponent extends HtmlComponent {
                constructor(name, element, events) {
                    super(name, element, events);

                    this.actions = {
                        text(ctx, argument) {
                            // TODO(high): revisit this concept of callback getter
                            if (typeof argument === 'string') {
                                this.value = argument;

                                const oninput = this.__xissleEventListeners.get('input');
                                if (oninput) {
                                    oninput.forEach(handler => handler({
                                        // TODO: use the InputEvent class
                                        type: 'input',
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

            /**
             * Register custom HtmlComponent classes to lookup during DOM parsing.
             *
             * @param {Class} compClass The derived class.
             */
            Xissle.prototype.registerHtmlComponentClass = function registerHtmlComponentClass(compClass) {
                const name = compClass.name;

                if (!(compClass.prototype instanceof HtmlComponent)) {
                    throw new XissleError(`Trying to register a non HtmlComponent class ${name}`);
                }

                if (components.hasOwnProperty(name)) {
                    throw new XissleError(`HtmlComponent class ${name} already exists`);
                }

                if (!this.customHtmlComponents) {
                    this.customHtmlComponents = new Map([[name, compClass]]);
                } else if (this.customHtmlComponents.has(name)) {
                    throw new XissleError(`HtmlComponent class ${name} already exists`);
                } else {
                    this.customHtmlComponents.set(name, compClass);
                }
            };

            return {
                HtmlComponent,
                ButtonComponent,
                TextFieldComponent
            };
        }());

        const views = (function views(http) {
            if (!DOMParser) {
                throw new XissleError('DOMParser is not defined');
                // TODO(low): use innerHTML otherwise
            }

            const domParser = new DOMParser();

            /**
             * Parse all the components that are children of the element or the element it self
             * while constructing them and registering them as components of the xissle object.
             *
             * @param {Xissle} xissle
             * @param {DOMNode} element
             * @param {Object} configs      See View.configs
             */
            function parseHtmlDataComponents(xissle, element, configs) {
                const componentNames = [];

                element.querySelectorAll('[data-xi-component]').forEach(element => {
                    const name = element.dataset.xiComponent;
                    const config = configs[name];
                    const constructor = components[config.type] ||
                                        xissle.customHtmlComponents.get(config.type);

                    if (!constructor) {
                        throw new XissleError(`Nonexisting constructor ${config.type} while parsing DOM`);
                    }

                    // Create the desired component.
                    const component = new constructor(name, element, config.emits);

                    // Register the component
                    xissle.component(component);

                    // Push the name in the return list
                    componentNames.push(name);

                    if (config.channel) {
                        xissle.channel(config.channel.name, component.name, config.channel.to);
                    }
                });

                return componentNames;
            }

            /**
             * Load the views that are children of the element or the element itself.
             *
             * This also associates te element the view it's found on as it's root element.
             *
             * @param {Xissle} xissle
             * @param {DOMNode} element
             */
            function parseHtmlDataViews(xissle, element) {
                const promises = [];

                element.querySelectorAll('[data-xi-view]').forEach(viewElement => {
                    const name = viewElement.dataset.xiView;
                    const view = xissle.views.get(name);

                    if (!view) {
                        throw new XissleError(`View ${name} does not exist`);
                    }

                    view.rootElement = viewElement;

                    promises.push(loadView(xissle, view));
                });

                return Promise.all(promises);
            }

            /**
             * Load a single view by fetching it's html, constructing it and the components it
             * contains as well as recursively loading any sub-views.
             *
             * @param {Xissle} xissle
             * @param {View} view
             *
             * @returns {Promise}
             */
            function loadView(xissle, view) {
                if (view.loaded) {
                    throw new XissleError(`View ${view.name} already loaded`);
                }

                const html = view.html;
                const opts = view.opts;
                // TODO(medium): Optimize?
                const htmlPromise = html.indexOf('url:') === 0 ?
                    http.get(html.substr(4)).then(html => { return { html, opts }; }) :
                    Promise.resolve({ html, opts });

                return htmlPromise.then(({ html, opts }) => {
                    view.html = html;

                    // Parse the html string to a document
                    const content = domParser.parseFromString(html, 'text/html');

                    // Parse the content document to create and register the HtmlComponents
                    const componentNames = parseHtmlDataComponents(xissle, content, view.configs);

                    return parseHtmlDataViews(xissle, content).then(() => {
                        // Attach the view's contents to it's root element
                        content.querySelectorAll('body > *').forEach(child => {
                            view.rootElement.appendChild(child);
                        });

                        if (opts) {
                            const { groupName } = opts;

                            if (groupName) {
                                xissle.group(groupName, componentNames.reduce((acc, name) => {
                                    acc[name] = true;
                                    return acc;
                                }, {}));
                            }
                        }

                        view.loaded = true;
                        return view;
                    });
                }, () => {
                    throw new XissleError(`View template request failed for ${view.name}`);
                });
            }

            /**
             * The way to define interactive html as part of the Xissle framework.
             */
            class View {
                constructor(name, html, configs, opts) {
                    this.name = name;
                    this.rootElement = null;
                    // Configuration jsons that describe the HtmlComponents in the view
                    this.configs = configs;
                    this.opts = opts;
                    // Either an url or the html content itself. If an url, it will change to the
                    // actual content when received
                    this.html = html;
                    this.loaded = false;
                }
            }

            /**
             * Register a View
             *
             * @param {View} view The view to register
             */
            Xissle.prototype.view = function view(view) {
                if (!this.views) {
                    this.views = new Map();
                }

                if (!(view instanceof View)) {
                    throw new XissleError('Trying to register a non view');
                }

                if (this.views.has(view.name)) {
                    throw new XissleError('Duplicate view name');
                }

                this.views.set(view.name, view);
            };

            /**
             * Loads the views that are children of the provided element or the element itself.
             */
            Xissle.prototype.loadViews = function loadViews(element) {
                return parseHtmlDataViews(this, element);
            };

            return {
                View
            };
        }(http));

        return {
            http,
            components,
            views
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