<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [post-me](./post-me.md) &gt; [LocalHandle](./post-me.localhandle.md)

## LocalHandle interface

A handle to the local end of the connection

<b>Signature:</b>

```typescript
export interface LocalHandle<M extends MethodsType = any, E extends EventsType = any> 
```

## Remarks

Use this handle to:

- Emit custom events to the other end

- Set the methods that are exposed to the other end

## Methods

|  Method | Description |
|  --- | --- |
|  [emit(eventName, data, options)](./post-me.localhandle.emit.md) | Emit a custom event with a payload. The event can be captured by the other context. |
|  [setEmitTransfer(eventName, transfer)](./post-me.localhandle.setemittransfer.md) | Specify which parts of the payload of a given event should be transferred into the other context instead of cloned. |
|  [setMethod(methodName, method)](./post-me.localhandle.setmethod.md) | Set a specific method that will be exposed to the other end of the connection. |
|  [setMethods(methods)](./post-me.localhandle.setmethods.md) | Set the methods that will be exposed to the other end of the connection. |
|  [setReturnTransfer(methodName, transfer)](./post-me.localhandle.setreturntransfer.md) | Specify which parts of the return value of a given method call should be transferred into the other context instead of cloned. |
