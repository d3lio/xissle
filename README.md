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
and it must not be `null` or `undefined` and cannot be changed to neither of them at *runtime.
The type of the storage variables cannot be changed at runtime as well. The idea behind these
decisions is memory safety in the form of no property lookup on or usage of null and undefined.
The inspiration for the decision again comes from `Rust`.

Actions are the "methods" of the component. This is where the component's logic goes. They cannot be
invoked directly by are triggered by events emitted in `groups`.

### Groups

`Groups` are event emitters which purpose is to allow components to interact with each other.

After creation of a component it can be grouped with other components so whenever any component in
the group emits an event every other component including itself can receive the event and can act
upon it. This happens by action subscription. When constructing the group you can determine which
component listens for what events. Then when an event is emitted, lets say `click` event, every
action called click that is subscribed to the group is triggered.

There is the concept of `channels` which are groups with only 2 participants and both have all of
their actions subscribed to the channel (group).

This approach prevents dependencies and component hierarchies. They are all equal, on the same layer
and send messages to one another by groups which can be viewed as chats and the components as users.
