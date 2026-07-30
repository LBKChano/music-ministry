import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RefreshBatchError,
  RefreshCoordinator,
  runRefreshBatch,
  shouldShowInitialLoader,
} from '../lib/query/refresh-coordinator.ts';

test('overlapping refreshes for one resource share the same request', async () => {
  const coordinator = new RefreshCoordinator();
  let resolveRequest;
  let requestCount = 0;
  const request = () => {
    requestCount += 1;
    return new Promise(resolve => {
      resolveRequest = resolve;
    });
  };

  const first = coordinator.run('members:account:church', request);
  const second = coordinator.run('members:account:church', request);

  assert.equal(first, second);
  assert.equal(requestCount, 1);
  assert.equal(coordinator.isRefreshing('members:account:church'), true);

  resolveRequest('done');
  assert.equal(await first, 'done');
  assert.equal(await second, 'done');
  assert.equal(coordinator.isRefreshing(), false);
});

test('separate resources can refresh together', async () => {
  const coordinator = new RefreshCoordinator();
  const order = [];

  await Promise.all([
    coordinator.run('members', async () => {
      order.push('members');
    }),
    coordinator.run('services', async () => {
      order.push('services');
    }),
  ]);

  assert.deepEqual(new Set(order), new Set(['members', 'services']));
});

test('a refresh batch settles every task and reports partial failure', async () => {
  const completed = [];

  await assert.rejects(
    runRefreshBatch([
      async () => {
        completed.push('members');
      },
      async () => {
        throw new Error('offline');
      },
      async () => {
        completed.push('services');
      },
    ]),
    error => {
      assert.equal(error instanceof RefreshBatchError, true);
      assert.match(error.message, /Pull down to try again/);
      assert.equal(error.failures.length, 1);
      return true;
    },
  );

  assert.deepEqual(completed, ['members', 'services']);
});

test('only initialization without usable data needs a full-screen loader', () => {
  assert.equal(shouldShowInitialLoader(true, false), true);
  assert.equal(shouldShowInitialLoader(true, true), false);
  assert.equal(shouldShowInitialLoader(false, false), false);
  assert.equal(shouldShowInitialLoader(false, true), false);
});
