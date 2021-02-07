<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [post-me](./post-me.md) &gt; [Emitter](./post-me.emitter.md) &gt; [removeEventListener](./post-me.emitter.removeeventlistener.md)

## Emitter.removeEventListener() method

Remove a listener from a specific event.

<b>Signature:</b>

```typescript
removeEventListener<K extends keyof E>(eventName: K, listener: (data: E[K]) => void): void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  eventName | K | The name of the event |
|  listener | (data: E\[K\]) =&gt; void | A listener function that had been added previously |

<b>Returns:</b>

void
