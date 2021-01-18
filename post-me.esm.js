const MARKER = '@post-me';
function createUniqueIdFn() {
    let __id = 0;
    return function () {
        const id = __id;
        __id += 1;
        return id;
    };
}

class Emitter {
    constructor() {
        this._listeners = {};
    }
    addEventListener(eventName, listener) {
        let listeners = this._listeners[eventName];
        if (!listeners) {
            listeners = new Set();
            this._listeners[eventName] = listeners;
        }
        listeners.add(listener);
    }
    removeEventListener(eventName, listener) {
        let listeners = this._listeners[eventName];
        if (!listeners) {
            return;
        }
        listeners.delete(listener);
    }
    once(eventName) {
        return new Promise((resolve) => {
            const listener = (data) => {
                this.removeEventListener(eventName, listener);
                resolve(data);
            };
            this.addEventListener(eventName, listener);
        });
    }
    emit(eventName, data) {
        let listeners = this._listeners[eventName];
        if (!listeners) {
            return;
        }
        listeners.forEach((listener) => {
            listener(data);
        });
    }
    removeAllListeners() {
        Object.values(this._listeners).forEach((listeners) => {
            if (listeners) {
                listeners.clear();
            }
        });
    }
}

var MessageType;
(function (MessageType) {
    MessageType["HandshakeRequest"] = "handshake-request";
    MessageType["HandshakeResponse"] = "handshake-response";
    MessageType["Call"] = "call";
    MessageType["Response"] = "response";
    MessageType["Error"] = "error";
    MessageType["Event"] = "event";
    MessageType["Callback"] = "callback";
})(MessageType || (MessageType = {}));
// Message Creators
function createHandshakeRequestMessage(sessionId) {
    return {
        type: MARKER,
        action: MessageType.HandshakeRequest,
        sessionId,
    };
}
function createHandshakeResponseMessage(sessionId) {
    return {
        type: MARKER,
        action: MessageType.HandshakeResponse,
        sessionId,
    };
}
function createCallMessage(sessionId, requestId, methodName, args) {
    return {
        type: MARKER,
        action: MessageType.Call,
        sessionId,
        requestId,
        methodName,
        args,
    };
}
function createResponsMessage(sessionId, requestId, result, error) {
    const message = {
        type: MARKER,
        action: MessageType.Response,
        sessionId,
        requestId,
    };
    if (result !== undefined) {
        message.result = result;
    }
    if (error !== undefined) {
        message.error = error;
    }
    return message;
}
function createCallbackMessage(sessionId, requestId, callbackId, args) {
    return {
        type: MARKER,
        action: MessageType.Callback,
        sessionId,
        requestId,
        callbackId,
        args,
    };
}
function createEventMessage(sessionId, eventName, payload) {
    return {
        type: MARKER,
        action: MessageType.Event,
        sessionId,
        eventName,
        payload,
    };
}
// Type Guards
function isMessage(m) {
    return m.type === MARKER;
}
function isHandshakeRequestMessage(m) {
    return isMessage(m) && m.action === MessageType.HandshakeRequest;
}
function isHandshakeResponseMessage(m) {
    return isMessage(m) && m.action === MessageType.HandshakeResponse;
}
function isCallMessage(m) {
    return isMessage(m) && m.action === MessageType.Call;
}
function isResponseMessage(m) {
    return isMessage(m) && m.action === MessageType.Response;
}
function isCallbackMessage(m) {
    return isMessage(m) && m.action === MessageType.Callback;
}
function isEventMessage(m) {
    return isMessage(m) && m.action === MessageType.Event;
}

function makeCallbackEvent(requestId) {
    return `callback_${requestId}`;
}
function makeResponseEvent(requestId) {
    return `response_${requestId}`;
}
class Dispatcher extends Emitter {
    constructor(messenger, sessionId) {
        super();
        this.uniqueId = createUniqueIdFn();
        this.messenger = messenger;
        this.sessionId = sessionId;
        this.removeMessengerListener = this.messenger.addMessageListener(this.messengerListener.bind(this));
    }
    messengerListener(event) {
        const { data } = event;
        if (!isMessage(data)) {
            return;
        }
        if (this.sessionId !== data.sessionId) {
            return;
        }
        if (isCallMessage(data)) {
            this.emit(MessageType.Call, data);
        }
        else if (isResponseMessage(data)) {
            this.emit(makeResponseEvent(data.requestId), data);
        }
        else if (isEventMessage(data)) {
            this.emit(MessageType.Event, data);
        }
        else if (isCallbackMessage(data)) {
            this.emit(makeCallbackEvent(data.requestId), data);
        }
    }
    callOnRemote(methodName, args, transfer) {
        const requestId = this.uniqueId();
        const callbackEvent = makeCallbackEvent(requestId);
        const responseEvent = makeResponseEvent(requestId);
        const message = createCallMessage(this.sessionId, requestId, methodName, args);
        this.messenger.postMessage(message, transfer);
        return { callbackEvent, responseEvent };
    }
    respondToRemote(requestId, value, error, transfer) {
        const message = createResponsMessage(this.sessionId, requestId, value, error);
        this.messenger.postMessage(message, transfer);
    }
    callbackToRemote(requestId, callbackId, args) {
        const message = createCallbackMessage(this.sessionId, requestId, callbackId, args);
        this.messenger.postMessage(message);
    }
    emitToRemote(eventName, payload, transfer) {
        const message = createEventMessage(this.sessionId, eventName, payload);
        this.messenger.postMessage(message, transfer);
    }
    close() {
        this.removeMessengerListener();
        this.removeAllListeners();
    }
}
class ParentHandshakeDispatcher extends Emitter {
    constructor(messenger, sessionId) {
        super();
        this.messenger = messenger;
        this.sessionId = sessionId;
        this.removeMessengerListener = this.messenger.addMessageListener(this.messengerListener.bind(this));
    }
    messengerListener(event) {
        const { data } = event;
        if (!isMessage(data)) {
            return;
        }
        if (this.sessionId !== data.sessionId) {
            return;
        }
        if (isHandshakeResponseMessage(data)) {
            this.emit(data.sessionId, data);
        }
    }
    initiateHandshake() {
        const message = createHandshakeRequestMessage(this.sessionId);
        this.messenger.postMessage(message);
        return this.sessionId;
    }
    close() {
        this.removeMessengerListener();
        this.removeAllListeners();
    }
}
class ChildHandshakeDispatcher extends Emitter {
    constructor(messenger) {
        super();
        this.messenger = messenger;
        this.removeMessengerListener = this.messenger.addMessageListener(this.messengerListener.bind(this));
    }
    messengerListener(event) {
        const { data } = event;
        if (isHandshakeRequestMessage(data)) {
            this.emit(MessageType.HandshakeRequest, data);
        }
    }
    acceptHandshake(sessionId) {
        const message = createHandshakeResponseMessage(sessionId);
        this.messenger.postMessage(message);
    }
    close() {
        this.removeMessengerListener();
        this.removeAllListeners();
    }
}

var ProxyType;
(function (ProxyType) {
    ProxyType["Callback"] = "callback";
})(ProxyType || (ProxyType = {}));
function createCallbackProxy(callbackId) {
    return {
        type: MARKER,
        proxy: ProxyType.Callback,
        callbackId,
    };
}
function isCallbackProxy(p) {
    return p.type === MARKER && p.proxy === ProxyType.Callback;
}

class ConcreteRemoteHandle extends Emitter {
    constructor(dispatcher) {
        super();
        this._dispatcher = dispatcher;
        this._callTransfer = {};
        this._dispatcher.addEventListener(MessageType.Event, this._handleEvent.bind(this));
    }
    close() {
        this.removeAllListeners();
    }
    setCallTransfer(methodName, transfer) {
        this._callTransfer[methodName] = transfer;
    }
    call(methodName, ...args) {
        return this.customCall(methodName, args);
    }
    customCall(methodName, args, options = {}) {
        return new Promise((resolve, reject) => {
            const sanitizedArgs = [];
            const callbacks = [];
            let callbackId = 0;
            args.forEach((arg) => {
                if (typeof arg === 'function') {
                    callbacks.push(arg);
                    sanitizedArgs.push(createCallbackProxy(callbackId));
                    callbackId += 1;
                }
                else {
                    sanitizedArgs.push(arg);
                }
            });
            const hasCallbacks = callbacks.length > 0;
            let callbackListener = undefined;
            if (hasCallbacks) {
                callbackListener = (data) => {
                    const { callbackId, args } = data;
                    callbacks[callbackId](...args);
                };
            }
            let transfer = options.transfer;
            if (transfer === undefined && this._callTransfer[methodName]) {
                transfer = this._callTransfer[methodName](...sanitizedArgs);
            }
            const { callbackEvent, responseEvent } = this._dispatcher.callOnRemote(methodName, sanitizedArgs, transfer);
            if (hasCallbacks) {
                this._dispatcher.addEventListener(callbackEvent, callbackListener);
            }
            this._dispatcher.once(responseEvent).then((response) => {
                if (callbackListener) {
                    this._dispatcher.removeEventListener(callbackEvent, callbackListener);
                }
                const { result, error } = response;
                if (error !== undefined) {
                    reject(error);
                }
                else {
                    resolve(result);
                }
            });
        });
    }
    _handleEvent(data) {
        const { eventName, payload } = data;
        this.emit(eventName, payload);
    }
}
class ConcreteLocalHandle {
    constructor(dispatcher, localMethods) {
        this._dispatcher = dispatcher;
        this._methods = localMethods;
        this._returnTransfer = {};
        this._emitTransfer = {};
        this._dispatcher.addEventListener(MessageType.Call, this._handleCall.bind(this));
    }
    emit(eventName, payload, options = {}) {
        let transfer = options.transfer;
        if (transfer === undefined && this._emitTransfer[eventName]) {
            transfer = this._emitTransfer[eventName](payload);
        }
        this._dispatcher.emitToRemote(eventName, payload, transfer);
    }
    setReturnTransfer(methodName, transfer) {
        this._returnTransfer[methodName] = transfer;
    }
    setEmitTransfer(eventName, transfer) {
        this._emitTransfer[eventName] = transfer;
    }
    _handleCall(data) {
        const { requestId, methodName, args } = data;
        const callMethod = new Promise((resolve, reject) => {
            const method = this._methods[methodName];
            if (typeof method !== 'function') {
                reject(new Error(`The method "${methodName}" has not been implemented.`));
                return;
            }
            const desanitizedArgs = args.map((arg) => {
                if (isCallbackProxy(arg)) {
                    const { callbackId } = arg;
                    return (...args) => {
                        this._dispatcher.callbackToRemote(requestId, callbackId, args);
                    };
                }
                else {
                    return arg;
                }
            });
            Promise.resolve(method(...desanitizedArgs))
                .then(resolve)
                .catch(reject);
        });
        callMethod
            .then((result) => {
            let transfer;
            if (this._returnTransfer[methodName]) {
                transfer = this._returnTransfer[methodName](result);
            }
            this._dispatcher.respondToRemote(requestId, result, undefined, transfer);
        })
            .catch((error) => {
            this._dispatcher.respondToRemote(requestId, undefined, error);
        });
    }
}

class ConcreteConnection {
    constructor(dispatcher, localMethods) {
        this._dispatcher = dispatcher;
        this._localHandle = new ConcreteLocalHandle(dispatcher, localMethods);
        this._remoteHandle = new ConcreteRemoteHandle(dispatcher);
    }
    close() {
        this._dispatcher.close();
        this.remoteHandle().close();
    }
    localHandle() {
        return this._localHandle;
    }
    remoteHandle() {
        return this._remoteHandle;
    }
}

const uniqueSessionId = createUniqueIdFn();
const runUntil = (worker, condition, unfulfilled, maxAttempts, attemptInterval) => {
    let attempt = 0;
    const fn = () => {
        if (!condition() && (attempt < maxAttempts || maxAttempts < 1)) {
            worker();
            attempt += 1;
            setTimeout(fn, attemptInterval);
        }
        else if (!condition() && attempt >= maxAttempts && maxAttempts >= 1) {
            unfulfilled();
        }
    };
    fn();
};
function ParentHandshake(messenger, localMethods = {}, maxAttempts = 5, attemptsInterval = 100) {
    const thisSessionId = uniqueSessionId();
    let connected = false;
    return new Promise((resolve, reject) => {
        const handshakeDispatcher = new ParentHandshakeDispatcher(messenger, thisSessionId);
        handshakeDispatcher.once(thisSessionId).then((response) => {
            connected = true;
            handshakeDispatcher.close();
            const { sessionId } = response;
            const dispatcher = new Dispatcher(messenger, sessionId);
            const connection = new ConcreteConnection(dispatcher, localMethods);
            resolve(connection);
        });
        runUntil(() => handshakeDispatcher.initiateHandshake(), () => connected, () => reject(new Error(`Handshake failed, reached maximum number of attempts`)), maxAttempts, attemptsInterval);
    });
}
function ChildHandshake(messenger, localMethods = {}) {
    return new Promise((resolve, reject) => {
        const handshakeDispatcher = new ChildHandshakeDispatcher(messenger);
        handshakeDispatcher.once(MessageType.HandshakeRequest).then((response) => {
            const { sessionId } = response;
            handshakeDispatcher.acceptHandshake(sessionId);
            handshakeDispatcher.close();
            const dispatcher = new Dispatcher(messenger, sessionId);
            const connection = new ConcreteConnection(dispatcher, localMethods);
            resolve(connection);
        });
    });
}

const acceptableMessageEvent = (event, remoteWindow, acceptedOrigin) => {
    const { source, origin } = event;
    if (source !== remoteWindow) {
        return false;
    }
    if (origin !== acceptedOrigin && acceptedOrigin !== '*') {
        return false;
    }
    return true;
};
class WindowMessenger {
    constructor({ localWindow, remoteWindow, remoteOrigin, }) {
        localWindow = localWindow || window;
        this.postMessage = (message, transfer) => {
            remoteWindow.postMessage(message, remoteOrigin, transfer);
        };
        this.addMessageListener = (listener) => {
            const outerListener = (event) => {
                if (acceptableMessageEvent(event, remoteWindow, remoteOrigin)) {
                    listener(event);
                }
            };
            localWindow.addEventListener('message', outerListener);
            const removeListener = () => {
                localWindow.removeEventListener('message', outerListener);
            };
            return removeListener;
        };
    }
}
class WorkerMessenger {
    constructor({ worker }) {
        this.postMessage = (message, transfer = []) => {
            worker.postMessage(message, transfer);
        };
        this.addMessageListener = (listener) => {
            const outerListener = (event) => {
                listener(event);
            };
            worker.addEventListener('message', outerListener);
            const removeListener = () => {
                worker.removeEventListener('message', outerListener);
            };
            return removeListener;
        };
    }
}
const debug = (namespace, log) => {
    log = log || console.debug || console.log || (() => { });
    return (...data) => {
        log(namespace, ...data);
    };
};
function DebugMessenger(messenger, log) {
    log = log || debug('post-me');
    const debugListener = function (event) {
        const { data } = event;
        log('⬅️ received message', data);
    };
    messenger.addMessageListener(debugListener);
    return {
        postMessage: function (message) {
            log('➡️ sending message', message);
            messenger.postMessage(message);
        },
        addMessageListener: function (listener) {
            return messenger.addMessageListener(listener);
        },
    };
}

export { ChildHandshake, DebugMessenger, ParentHandshake, WindowMessenger, WorkerMessenger, debug };
