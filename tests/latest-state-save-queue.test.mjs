import assert from 'node:assert/strict';
import test from 'node:test';

import { LatestStateSaveQueue } from '../lib/admin/latest-state-save-queue.ts';

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

test('serializes writes and collapses rapid edits to the latest state', async () => {
  const firstWrite = deferred();
  const latestWrite = deferred();
  const persisted = [];
  const optimistic = [];
  const confirmed = [];
  const statuses = [];

  const queue = new LatestStateSaveQueue({
    initialConfirmed: ['Opening'],
    persist: value => {
      persisted.push(value);
      return persisted.length === 1 ? firstWrite.promise : latestWrite.promise;
    },
    onOptimistic: value => optimistic.push(value),
    onConfirmed: value => confirmed.push(value),
    onRollback: () => assert.fail('queue should not roll back'),
    onStatusChange: status => statuses.push(status),
  });

  queue.enqueue(['Opening', 'Praise']);
  queue.enqueue(['Opening', 'Praise', 'Worship']);
  queue.enqueue(['Opening', 'Worship']);

  assert.deepEqual(persisted, [['Opening', 'Praise']]);

  firstWrite.resolve(['Opening', 'Praise']);
  await flushPromises();

  assert.deepEqual(persisted, [
    ['Opening', 'Praise'],
    ['Opening', 'Worship'],
  ]);

  latestWrite.resolve(['Opening', 'Worship']);
  await flushPromises();

  assert.deepEqual(optimistic, [
    ['Opening', 'Praise'],
    ['Opening', 'Praise', 'Worship'],
    ['Opening', 'Worship'],
  ]);
  assert.deepEqual(confirmed, [['Opening', 'Worship']]);
  assert.equal(statuses.at(-1), 'saved');
});

test('rolls back to the last confirmed state and retries the latest intent', async () => {
  const firstWrite = deferred();
  const retryWrite = deferred();
  const persisted = [];
  const rollbacks = [];
  const confirmed = [];
  const statuses = [];

  const queue = new LatestStateSaveQueue({
    initialConfirmed: ['Opening'],
    persist: value => {
      persisted.push(value);
      return persisted.length === 1 ? firstWrite.promise : retryWrite.promise;
    },
    onOptimistic: () => {},
    onConfirmed: value => confirmed.push(value),
    onRollback: (serverValue, retryValue) => {
      rollbacks.push({ serverValue, retryValue });
    },
    onStatusChange: status => statuses.push(status),
  });

  queue.enqueue(['Opening', 'Praise']);
  queue.enqueue(['Opening', 'Praise', 'Worship']);
  firstWrite.reject(new Error('offline'));
  await flushPromises();

  assert.deepEqual(rollbacks, [{
    serverValue: ['Opening'],
    retryValue: ['Opening', 'Praise', 'Worship'],
  }]);
  assert.equal(statuses.at(-1), 'error');
  assert.equal(queue.retry(), true);

  retryWrite.resolve(['Opening', 'Praise', 'Worship']);
  await flushPromises();

  assert.deepEqual(confirmed, [['Opening', 'Praise', 'Worship']]);
  assert.equal(statuses.at(-1), 'saved');
});

test('ignores an in-flight result after disposal', async () => {
  const write = deferred();
  const confirmed = [];

  const queue = new LatestStateSaveQueue({
    initialConfirmed: ['Opening'],
    persist: () => write.promise,
    onOptimistic: () => {},
    onConfirmed: value => confirmed.push(value),
    onRollback: () => assert.fail('disposed queue should not roll back'),
    onStatusChange: () => {},
  });

  queue.enqueue(['Opening', 'Praise']);
  queue.dispose();
  write.resolve(['Opening', 'Praise']);
  await flushPromises();

  assert.deepEqual(confirmed, []);
});
