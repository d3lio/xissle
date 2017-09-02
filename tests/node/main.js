'use strict';

const {Xissle, Component} = require('../../src/xissle').core;

const xissle = new Xissle(global);

xissle.component(new Component('c1', {
    user: 'Jane Doe'
}, {
    main({ groups }, argv) {
        console.log('Args:', argv);
        groups.get('g1').emit('greet', this.user);
    }
}));

xissle.component(new Component('c2', {}, {
    greet(ctx, user) {
        console.log(`Hello ${user}!`);
    }
}));

xissle.group('g1', {
    c1: ['main'],
    c2: ['greet']
});

xissle.run(process.argv);
