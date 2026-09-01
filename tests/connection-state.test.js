const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldShowUserPosition, resolveConnectionStatus } = require('../lib/connection-state.js');

test('disconnected state hides user position on map', () => {
  const state = resolveConnectionStatus({
    isConnected: false,
    useQZSS: false,
    hasPosition: true,
    signalQuality: 'none',
  });

  assert.equal(state.connected, false);
  assert.equal(state.shouldShowUserPosition, false);
  assert.match(state.message, /未接続|位置情報なし/);
  assert.equal(shouldShowUserPosition({ isConnected: false, useQZSS: false, hasPosition: true }), false);
});

test('connected state keeps user position visible', () => {
  const state = resolveConnectionStatus({
    isConnected: true,
    useQZSS: true,
    hasPosition: true,
    signalQuality: 'good',
  });

  assert.equal(state.connected, true);
  assert.equal(state.shouldShowUserPosition, true);
  assert.match(state.message, /接続中|位置情報/);
  assert.equal(shouldShowUserPosition({ isConnected: true, useQZSS: true, hasPosition: true }), true);
});
