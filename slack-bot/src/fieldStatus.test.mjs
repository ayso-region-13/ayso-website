import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldStatusFrom, fieldStatusHeadline } from './fieldStatus.js';

test('the same status in both areas is the plain regional status', () => {
  assert.deepEqual(fieldStatusFrom('Open', 'Open'), { status: 'Open', laCanadaStatus: '', pasadenaStatus: '' });
  assert.equal(fieldStatusHeadline('Closed', 'Closed'), 'Closed');
});

test('different statuses are stored per area, under a summary status', () => {
  assert.deepEqual(fieldStatusFrom('Closed', 'Open'), { status: 'Partly closed', laCanadaStatus: 'Closed', pasadenaStatus: 'Open' });
  assert.equal(fieldStatusHeadline('Closed', 'Open'), 'La Cañada Closed, Pasadena/Altadena Open');
});

test('a split with nothing closed is not called closed', () => {
  assert.equal(fieldStatusFrom('Monitoring', 'Open').status, 'Monitoring');
});
