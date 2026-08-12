import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveServicePaginationStatus,
  shouldCompleteAfterRange,
} from '../lib/schedules/service-pagination.ts';

const range = { startDate: '2026-11-10', endDate: '2027-02-07' };

test('authoritative last date completes or reopens pagination deterministically', () => {
  assert.equal(resolveServicePaginationStatus({
    operationStatus: 'idle',
    loadedThrough: '2026-11-09',
    lastServiceDate: '2026-09-30',
    summaryStatus: 'success',
    rangeQueryUnavailable: false,
  }), 'complete');

  assert.equal(resolveServicePaginationStatus({
    operationStatus: 'complete',
    loadedThrough: '2026-11-09',
    lastServiceDate: '2026-12-24',
    summaryStatus: 'success',
    rangeQueryUnavailable: false,
  }), 'idle');
});

test('loading and errors remain stable until their request settles', () => {
  for (const status of ['loading', 'error']) {
    assert.equal(resolveServicePaginationStatus({
      operationStatus: status,
      loadedThrough: '2026-11-09',
      lastServiceDate: null,
      summaryStatus: 'pending',
      rangeQueryUnavailable: false,
    }), status);
  }

  assert.equal(resolveServicePaginationStatus({
    operationStatus: 'idle',
    loadedThrough: null,
    lastServiceDate: null,
    summaryStatus: 'error',
    rangeQueryUnavailable: true,
  }), 'error');
});

test('a newly authoritative final date clears a stale pagination error', () => {
  assert.equal(resolveServicePaginationStatus({
    operationStatus: 'error',
    loadedThrough: '2026-11-09',
    lastServiceDate: '2026-09-30',
    summaryStatus: 'success',
    rangeQueryUnavailable: false,
  }), 'complete');
});

test('an empty range completes unless a known later service requires progress', () => {
  assert.equal(shouldCompleteAfterRange({
    fetchedServiceCount: 0,
    targetRange: range,
    lastServiceDate: null,
    summaryStatus: 'error',
  }), true);
  assert.equal(shouldCompleteAfterRange({
    fetchedServiceCount: 0,
    targetRange: range,
    lastServiceDate: '2027-03-01',
    summaryStatus: 'success',
  }), false);
  assert.equal(shouldCompleteAfterRange({
    fetchedServiceCount: 2,
    targetRange: range,
    lastServiceDate: '2027-01-01',
    summaryStatus: 'success',
  }), true);
});

test('a resolved empty schedule is complete before another request', () => {
  assert.equal(resolveServicePaginationStatus({
    operationStatus: 'idle',
    loadedThrough: '2026-11-09',
    lastServiceDate: null,
    summaryStatus: 'success',
    rangeQueryUnavailable: false,
  }), 'complete');
});
