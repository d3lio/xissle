# Xissle

Component based event driven js framework for nodejs and browsers.

## Ideology

Simple library revolving around `components` which are equivalent to singleton classes and `groups`
which by themselves are event emitters.

### Components

`Components` are made of two core parts:

    * Storage
    * Actions

The separation comes from `Rust` where `struct`s are used for composite data types instead of
classes and functions/methods are introduced by `impl` blocks.

A component's storage is it's state and can be either immutable (frozen) or mutable (sealed).
Both are non-extendable so any persistent state the component will use should be declared beforehand
and it must not be `null` or `undefined` and cannot be changed to neither of them at runtime.
The type of the storage variables cannot be changed at runtime as well. The idea behind these
decisions is memory safety in the form of no property lookup on or usage of null and undefined.
The inspiration for the decision again comes from `Rust`.

> **Note:** The storage management is only shallow which means any objects
defined in the storage can have their properties modified unless you wrap them in
`Xissle.mutable(obj)` or `Xissle.immutable(obj)`.
Be careful when using those or you might make a third party object immutable where it shouldn't be
since it's not managed by your code and it doesn't follow the idelogy of the framewok.

Actions are the "methods" of the component. This is where the component's logic goes. They cannot be
invoked directly but are only triggered by events emitted in `groups`.

#### Example
```JavaScript
    const {Xissle, Component} = require('xissle').core;

    const xissle = new Xissle(global);

    // Define a component by it's name, storage and actions.
    xissle.component(new Component('c1', {
        user: 'Jane Doe'
    }, {
        main({ message }, argv) {
            message('g1', 'greet', this.user);
        }
    }));

    xissle.component(new Component('c2', {}, {
        greet(ctx, user) {
            console.log(`Hello ${user}!`);
        }
    }));

    // Define a group by it's name and subscribers. Will explore it in the next section.
    xissle.group('g1', {
        // Unnecessary subscription since nothing in the group emits `main`
        // but for the purposes of the groups examle leave it as it is.
        c1: ['main'],
        c2: ['greet']
    });

    // Emit the `main` event which triggers `c1.main`. Every component registered through
    // `Xissle.component` is automatically subscribed to this event on the `global` component
    // if it has a main action.
    xissle.run(process.argv);
```

### Groups

`Groups` are event emitters which purpose is to allow components to interact with each other.

> **Note:** Groups as event emitters are synchronous like Nodejs' EventEmitter and
as a matter of fact uses them under Nodejs environment. For now
[this rule](https://nodejs.org/api/events.html#events_asynchronous_vs_synchronous) applies for making
you actions asynchronous. Later on there will be a more convenient method to make them asynchronous or default as such.

After creation of a component it can be grouped with other components so whenever any component in
the group emits an event every other component including itself can receive the event and can act
upon it. This happens by action subscription. When constructing the group you can determine which
component listens for what events. Then when an event is emitted, lets say `click` event, every
action called click that is subscribed to the group is triggered.

There is the concept of `channels` which are groups with only 2 participants and both have all of
their actions subscribed to the channel (group).

For example lets take a look at the above example and recreate it by using a channel

```JavaScript
    ...
    xissle.group('g1', {
        c1: ['main'],
        c2: ['greet']
    });
    ...
```

What this does is it creates a group called `g1` and the components `c1` and `c2` subscribe to it
with their actions `main` and `greet` respectively. First of all these actions are all that the
components have so we can simplify this example to

```JavaScript
    ...
    xissle.group('g1', {
        c1: true,
        c2: true
    });
    ...
```

Now by definition `channels` fit this example perfectly so lets see how it would look

```JavaScript
    ...
    xissle.channel('g1', 'c1', 'c2');
    ...
```

Much cleaner, isn't it? Well this is the main communication method between 2 components and you
are expected to use it often.

### Conclusion

The approach of this framework prevents dependencies and component hierarchies. They are all equal,
on the same layer and send messages to one another by groups which can be viewed as chats and the
components as users. Right now the framework is in an early stage and quite unoptimized but it
will get better with time.
