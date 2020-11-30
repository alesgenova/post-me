(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global['post-me'] = {}));
}(this, (function (exports) { 'use strict';

  var MessageType;
  (function (MessageType) {
      MessageType["Handshake"] = "@post-me/handshake";
      MessageType["Call"] = "@post-me/call";
      MessageType["Response"] = "@post-me/response";
      MessageType["Error"] = "@post-me/error";
      MessageType["Event"] = "@post-me/event";
  })(MessageType || (MessageType = {}));
  // Message Creators
  function createHandshakeMessage(sessionId) {
      return {
          type: MessageType.Handshake,
          sessionId,
          requestId: sessionId,
      };
  }
  function createCallMessage(sessionId, requestId, name, ...args) {
      return {
          type: MessageType.Call,
          sessionId,
          requestId,
          name,
          args,
      };
  }
  function createResponsMessage(sessionId, requestId, result) {
      return {
          type: MessageType.Response,
          sessionId,
          requestId,
          result,
      };
  }
  function createErrorMessage(sessionId, requestId, error) {
      return {
          type: MessageType.Error,
          sessionId,
          requestId,
          error,
      };
  }
  function createEventMessage(sessionId, name, payload) {
      return {
          type: MessageType.Event,
          sessionId,
          name,
          payload,
      };
  }
  // Type Guards
  function isMessage(m) {
      return (m.type !== undefined &&
          m.sessionId !== undefined);
  }
  function isHandshakeMessage(m) {
      return (isMessage(m) &&
          m.type === MessageType.Handshake &&
          m.requestId !== undefined);
  }
  function isCallMessage(m) {
      return (isMessage(m) &&
          m.type === MessageType.Call &&
          m.requestId !== undefined &&
          m.name !== undefined &&
          Array.isArray(m.args));
  }
  function isResponseMessage(m) {
      return (isMessage(m) &&
          m.type === MessageType.Response &&
          m.requestId !== undefined);
  }
  function isErrorMessage(m) {
      return (isMessage(m) &&
          m.type === MessageType.Error &&
          m.requestId !== undefined &&
          m.error !== undefined);
  }
  function isEventMessage(m) {
      return isMessage(m) && m.type === MessageType.Event;
  }

  class ConcreteConnection {
      constructor(localMethods, postMessage, addMessageListener, sessionId) {
          this.onMessage = (ev) => {
              const { data } = ev;
              if (!isMessage(data)) {
                  return;
              }
              if (data.sessionId !== this.sessionId()) {
                  return;
              }
              if (isCallMessage(data)) {
                  const { requestId, name, args } = data;
                  this.localCall(name, ...args)
                      .then((value) => {
                      const message = createResponsMessage(this.sessionId(), requestId, value);
                      this.sendMessage(message);
                  })
                      .catch((e) => {
                      const message = createErrorMessage(this.sessionId(), requestId, e);
                      this.sendMessage(message);
                  });
              }
              else if (isResponseMessage(data)) {
                  const { requestId, result } = data;
                  const promiseMethods = this._requests[requestId];
                  if (!promiseMethods) {
                      return;
                  }
                  promiseMethods.resolve(result);
                  delete this._requests[requestId];
                  return;
              }
              else if (isEventMessage(data)) {
                  const { name, payload } = data;
                  const listeners = this._eventListeners[name];
                  if (!listeners) {
                      return;
                  }
                  for (let listener of listeners) {
                      listener(payload);
                  }
                  return;
              }
              else if (isErrorMessage(data)) {
                  const { requestId, error } = data;
                  const promiseMethods = this._requests[requestId];
                  if (!promiseMethods) {
                      return;
                  }
                  promiseMethods.reject(error);
                  delete this._requests[requestId];
                  return;
              }
          };
          this.localEmit = (eventName, data) => {
              const message = createEventMessage(this.sessionId(), eventName, data);
              this.sendMessage(message);
          };
          this.remoteCall = (methodName, ...args) => {
              return new Promise((resolve, reject) => {
                  const requestId = this.uniqueRequestId();
                  this._requests[requestId] = { resolve, reject };
                  const message = createCallMessage(this.sessionId(), requestId, methodName, ...args);
                  this.sendMessage(message);
              });
          };
          this.localCall = (methodName, ...args) => {
              return new Promise((resolve, reject) => {
                  const method = this._localMethods[methodName];
                  if (!method) {
                      reject(new Error(`The method "${methodName}" has not been implemented.`));
                      return;
                  }
                  Promise.resolve(method(...args))
                      .then((val) => resolve(val))
                      .catch((e) => reject(e));
              });
          };
          this.remoteAddEventListener = (eventName, callback) => {
              let listeners = this._eventListeners[eventName];
              if (!listeners) {
                  listeners = new Set();
                  this._eventListeners[eventName] = listeners;
              }
              listeners.add(callback);
          };
          this.remoteRemoveEventListener = (eventName, callback) => {
              let listeners = this._eventListeners[eventName];
              if (!listeners) {
                  return;
              }
              listeners.delete(callback);
          };
          this.uniqueRequestId = (() => {
              let __requestId = 0;
              return () => {
                  const requestId = __requestId;
                  __requestId += 1;
                  return requestId;
              };
          })();
          this._localMethods = localMethods;
          this._postMessage = postMessage;
          this._addMessageListener = addMessageListener;
          this._sessionId = sessionId;
          this._requests = {};
          this._eventListeners = {};
          this._localHandle = {
              emit: this.localEmit,
          };
          this._remoteHandle = {
              call: this.remoteCall,
              addEventListener: this.remoteAddEventListener,
              removeEventListener: this.remoteRemoveEventListener,
          };
          this._removeMainListener = this._addMessageListener(this.onMessage);
      }
      localHandle() {
          return this._localHandle;
      }
      remoteHandle() {
          return this._remoteHandle;
      }
      sessionId() {
          return this._sessionId;
      }
      destroy() {
          this._removeMainListener();
      }
      sendMessage(message) {
          this._postMessage(message);
      }
  }

  function isWindow(w) {
      return globalThis.Window
          ? w.constructor.name === globalThis.Window.name
          : false;
  }

  const uniqueSessionId = (() => {
      let __sessionId = 0;
      return () => {
          const sessionId = __sessionId;
          __sessionId += 1;
          return sessionId;
      };
  })();
  const HANDSHAKE_SUCCESS = '@post-me/handshake-success';
  const makeWindowPostMessage = (w, origin) => {
      return (message) => {
          w.postMessage(message, origin);
      };
  };
  const makeWorkerPostMessage = (w) => {
      return (message) => {
          w.postMessage(message);
      };
  };
  const makeWindowAddMessageListener = (w, acceptedOrigin) => {
      const acceptEvent = (event) => {
          const { origin } = event;
          if (origin !== acceptedOrigin && acceptedOrigin !== '*') {
              return false;
          }
          return true;
      };
      return (listener) => {
          const outerListener = (event) => {
              if (acceptEvent(event)) {
                  listener(event);
              }
          };
          w.addEventListener('message', outerListener);
          const removeListener = () => {
              w.removeEventListener('message', outerListener);
          };
          return removeListener;
      };
  };
  const makeWorkerAddMessageListener = (w) => {
      return (listener) => {
          const outerListener = (event) => {
              {
                  listener(event);
              }
          };
          w.addEventListener('message', outerListener);
          const removeListener = () => {
              w.removeEventListener('message', outerListener);
          };
          return removeListener;
      };
  };
  function ParentHandshake(localMethods, otherWindow, acceptedOrigin, _thisWindow) {
      const thisWindow = _thisWindow || window;
      const thisSessionId = uniqueSessionId();
      return new Promise((resolve, reject) => {
          let postMessage;
          let addMessageListener;
          if (isWindow(otherWindow)) {
              postMessage = makeWindowPostMessage(otherWindow, acceptedOrigin);
          }
          else {
              postMessage = makeWorkerPostMessage(otherWindow);
          }
          if (isWindow(thisWindow) && isWindow(otherWindow)) {
              addMessageListener = makeWindowAddMessageListener(thisWindow, acceptedOrigin);
          }
          if (isWindow(thisWindow) && !isWindow(otherWindow)) {
              addMessageListener = makeWorkerAddMessageListener(otherWindow);
          }
          if (postMessage === undefined || addMessageListener === undefined) {
              reject(new Error('post-me does not work yet with this type of worker.'));
              return;
          }
          let removeHandshakeListener;
          const handshakeListener = (event) => {
              const { data } = event;
              if (isResponseMessage(data)) {
                  const { sessionId, requestId, result } = data;
                  if (sessionId === thisSessionId &&
                      requestId === thisSessionId &&
                      result === HANDSHAKE_SUCCESS) {
                      removeHandshakeListener();
                      resolve(new ConcreteConnection(localMethods, postMessage, addMessageListener, sessionId));
                  }
              }
          };
          removeHandshakeListener = addMessageListener(handshakeListener);
          const message = createHandshakeMessage(thisSessionId);
          postMessage(message);
      });
  }
  function ChildHandshake(localMethods, acceptedOrigin, _thisWindow) {
      const thisWindow = _thisWindow || window;
      return new Promise((resolve, reject) => {
          let postMessage;
          let addMessageListener;
          if (isWindow(thisWindow)) {
              addMessageListener = makeWindowAddMessageListener(thisWindow, acceptedOrigin);
          }
          else {
              addMessageListener = makeWorkerAddMessageListener(thisWindow);
          }
          if (addMessageListener === undefined) {
              reject(new Error('post-me does not work yet with this type of worker.'));
              return;
          }
          let removeHandshakeListener;
          const handshakeListener = (event) => {
              const { source, data } = event;
              if (isHandshakeMessage(data)) {
                  removeHandshakeListener();
                  if (source && isWindow(source)) {
                      postMessage = makeWindowPostMessage(source, acceptedOrigin);
                  }
                  else if (!source && !isWindow(thisWindow)) {
                      postMessage = makeWorkerPostMessage(thisWindow);
                  }
                  if (postMessage === undefined) {
                      reject(new Error('post-me does not work yet with this type of worker.'));
                      return;
                  }
                  const { sessionId, requestId } = data;
                  const message = createResponsMessage(sessionId, requestId, HANDSHAKE_SUCCESS);
                  postMessage(message);
                  resolve(new ConcreteConnection(localMethods, postMessage, addMessageListener, sessionId));
              }
          };
          removeHandshakeListener = addMessageListener(handshakeListener);
      });
  }

  exports.ChildHandshake = ChildHandshake;
  exports.ParentHandshake = ParentHandshake;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
