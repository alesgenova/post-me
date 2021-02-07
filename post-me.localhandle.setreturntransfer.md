<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [post-me](./post-me.md) &gt; [LocalHandle](./post-me.localhandle.md) &gt; [setReturnTransfer](./post-me.localhandle.setreturntransfer.md)

## LocalHandle.setReturnTransfer() method

Specify which parts of the return value of a given method call should be transferred into the other context instead of cloned.

<b>Signature:</b>

```typescript
setReturnTransfer<K extends keyof M>(methodName: K, transfer: (result: InnerType<ReturnType<M[K]>>) => Transferable[]): void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  methodName | K | The name of the method |
|  transfer | (result: InnerType&lt;ReturnType&lt;M\[K\]&gt;&gt;) =&gt; Transferable\[\] | A function that takes as parameter the return value of a method call, and returns a list of transferable objects. |

<b>Returns:</b>

void

## Remarks

You only need to call setReturnTransfer once per method. After the transfer function is set, it will automatically be used every time a value is returned by the specified method.
