<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [post-me](./post-me.md) &gt; [debug](./post-me.debug.md)

## debug() function

Create a logger function with a specific namespace

<b>Signature:</b>

```typescript
export declare function debug(namespace: string, log?: (...data: any[]) => void): (...data: any[]) => void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  namespace | string | The namespace will be prepended to all the arguments passed to the logger function |
|  log | (...data: any\[\]) =&gt; void | The underlying logger (<code>console.log</code> by default) |

<b>Returns:</b>

(...data: any\[\]) =&gt; void
