<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [post-me](./post-me.md) &gt; [Messenger](./post-me.messenger.md)

## Messenger interface

An interface used internally to exchange low level messages across contexts.

<b>Signature:</b>

```typescript
export interface Messenger 
```

## Remarks

Having a single interface lets post-me deal with Workers, Windows, and MessagePorts without having to worry about their differences.

A few concrete implementations of the Messenger interface are provided.

## Methods

|  Method | Description |
|  --- | --- |
|  [addMessageListener(listener)](./post-me.messenger.addmessagelistener.md) | Add a listener to messages received by the other context |
|  [postMessage(message, transfer)](./post-me.messenger.postmessage.md) | Send a message to the other context |
