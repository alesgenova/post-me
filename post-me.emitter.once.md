<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [post-me](./post-me.md) &gt; [Emitter](./post-me.emitter.md) &gt; [once](./post-me.emitter.once.md)

## Emitter.once() method

Add a listener to a specific event, that will only be invoked once

<b>Signature:</b>

```typescript
once<K extends keyof E>(eventName: K): Promise<E[K]>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  eventName | K | The name of the event |

<b>Returns:</b>

Promise&lt;E\[K\]&gt;

## Remarks

After the first occurrence of the specified event, the listener will be invoked and immediately removed.
