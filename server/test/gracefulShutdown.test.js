import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { registerGracefulShutdown } from '../src/utils/gracefulShutdown.js';

test('SIGTERM closes the HTTP server and database once', async () => {
  const signals = new EventEmitter();
  const messages = [];
  let closeCalls = 0;
  let disconnectCalls = 0;
  const server = {
    close(callback) { closeCalls += 1; callback(null); },
    closeAllConnections() { assert.fail('force close should not run after a clean shutdown'); },
  };
  registerGracefulShutdown(server, {
    signalTarget: signals,
    disconnectDatabase: async () => { disconnectCalls += 1; },
    logger: { info: (message) => messages.push(message), error: assert.fail },
    timeoutMs: 100,
  });

  signals.emit('SIGTERM');
  await new Promise((resolve) => setImmediate(resolve));
  signals.emit('SIGINT');

  assert.equal(closeCalls, 1);
  assert.equal(disconnectCalls, 1);
  assert.match(messages[0], /SIGTERM/);
  assert.equal(signals.exitCode, undefined);
});
