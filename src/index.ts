/**
 * @packageDocumentation Use web Workers and other Windows through a simple Promise API
 */

import { ParentHandshake, ChildHandshake } from './handshake';
import { Connection } from './connection';
import { Emitter, ConcreteEmitter } from './emitter';
import {
  Messenger,
  WindowMessenger,
  WorkerMessenger,
  PortMessenger,
  BareMessenger,
  DebugMessenger,
  debug,
} from './messenger';
import { RemoteHandle, LocalHandle } from './handles';
import { CallOptions, EmitOptions } from './common';

export {
  // Interfaces
  Connection,
  Emitter,
  RemoteHandle,
  LocalHandle,
  Messenger,
  // Methods
  ParentHandshake,
  ChildHandshake,
  DebugMessenger,
  debug,
  // Classes
  ConcreteEmitter,
  WindowMessenger,
  WorkerMessenger,
  PortMessenger,
  BareMessenger,
  // Types
  CallOptions,
  EmitOptions,
};
