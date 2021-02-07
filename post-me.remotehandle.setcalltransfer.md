<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [post-me](./post-me.md) &gt; [RemoteHandle](./post-me.remotehandle.md) &gt; [setCallTransfer](./post-me.remotehandle.setcalltransfer.md)

## RemoteHandle.setCallTransfer() method

Specify which parts of the arguments of a given method call should be transferred into the other context instead of cloned.

<b>Signature:</b>

```typescript
setCallTransfer<K extends keyof M>(methodName: K, transfer: (...args: Parameters<M[K]>) => Transferable[]): void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  methodName | K | The name of the method |
|  transfer | (...args: Parameters&lt;M\[K\]&gt;) =&gt; Transferable\[\] | A function that takes as parameters the arguments of a method call, and returns a list of transferable objects. |

<b>Returns:</b>

void

## Remarks

You only need to call setCallTransfer once per method. After the transfer function is set, it will automatically be used by all subsequent calls to the specified method.
