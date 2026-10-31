import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startNewGame, continueGame, migrateDefaultNames, roundPoints, displayPoints, totals, validState, validTricks, validNames, recordResult } from '../src/lib/game.js';

const fresh = () => ({ version: 1, active: createGame(), history: [] });

test('saved default names update without changing scores, history, or custom names', () => {
  const oldNames = ['You', 'Aayush', 'Sneha', 'Rohan'];
  let state = { ...fresh(), active: createGame(oldNames) };
  for (let i = 0; i < 5; i++) {
    state.active.locked = true;
    state = recordResult(state, [4, 3, 3, 3]);
  }
  const original = structuredClone(state);
  const migrated = migrateDefaultNames(state);
  assert.deepEqual(migrated.active.names, ['Suyash', 'Aayush', 'Sandesh', 'Prasanna']);
  assert.deepEqual(migrated.active, { ...original.active, names: migrated.active.names });
  assert.deepEqual(migrated.history, original.history);
  assert.deepEqual(state, original);
  assert.equal(validState(migrated), true);
  assert.equal(migrateDefaultNames(migrated), migrated);
  state.active.names[2] = 'Custom player';
  assert.equal(migrateDefaultNames(state), state);
});

test('new games preserve unfinished scores and locked bids as an independent draft', () => {
  let state = fresh();
  state.active.names = ['Sam', 'Alex', 'Lee', 'Jo'];
  state.active.locked = true;
  state = recordResult(state, [4, 3, 2, 3]);
  state.active.bids = [6, 2, 1, 4];
  state.active.locked = true;
  const original = structuredClone(state);
  const next = startNewGame(state);
  assert.notEqual(next.active.id, state.active.id);
  assert.deepEqual(next.active.names, state.active.names);
  assert.deepEqual(next.active.bids, [3, 3, 3, 3]);
  assert.equal(next.active.rounds.length, 0);
  assert.equal(next.active.locked, false);
  assert.deepEqual(next.history, [original.active]);
  assert.equal(validState(JSON.parse(JSON.stringify(next))), true);
  next.active.names[0] = 'Another player';
  next.history[0].bids[0] = 1;
  assert.deepEqual(state, original);
});

test('continuing a draft restores its exact round and saves the current game in its place', () => {
  let state = fresh();
  state.active.bids = [4, 2, 3, 4];
  state.active.locked = true;
  state = recordResult(state, [5, 2, 1, 4]);
  state.active.bids = [2, 5, 3, 3];
  state.active.locked = true;
  const first = structuredClone(state.active);
  state = startNewGame(state);
  state.active.names[0] = 'New crew';
  state.active.bids[0] = 7;
  const second = structuredClone(state.active);
  state = JSON.parse(JSON.stringify(state));
  state = continueGame(state, first.id);
  assert.deepEqual(state.active, first);
  assert.deepEqual(state.history, [second]);
  assert.deepEqual(totals(state.active), [41, 20, -30, 40]);
  assert.equal(validState(state), true);
  state = continueGame(state, second.id);
  assert.deepEqual(state.active, second);
  assert.deepEqual(state.history, [first]);
  state = continueGame(state, first.id);
  for (let i = state.active.rounds.length; i < 5; i++) {
    state.active.locked = true;
    state = recordResult(state, state.active.bids);
  }
  assert.equal(state.history.length, 2);
  assert.equal(state.history.filter(game => game.id === first.id).length, 1);
  assert.equal(state.history.find(game => game.id === first.id).rounds.length, 5);
  assert.equal(validState(state), true);
  const completed = structuredClone(state);
  const next = startNewGame(state);
  assert.deepEqual(next.history, completed.history);
  assert.throws(() => continueGame(next, first.id), /no longer available/);
  assert.throws(() => continueGame(next, 'missing'), /no longer available/);
  assert.deepEqual(state, completed);
});

test('draft validation accepts a saved first round and rejects duplicates or malformed scores', () => {
  const state = startNewGame(fresh());
  assert.equal(validState(state), true);
  state.history.push(structuredClone(state.history[0]));
  assert.equal(validState(state), false);
  state.history.pop();
  state.history[0].id = state.active.id;
  assert.equal(validState(state), false);
  state.history[0].id = 'another-game';
  state.history[0].rounds.push({ bids: [3, 3, 3, 3], won: [14, 0, 0, 0] });
  assert.equal(validState(state), false);
});

test('scores made bids, overtricks, missed bids, and negative decimals exactly', () => {
  assert.equal(roundPoints(3, 3), 30);
  assert.equal(roundPoints(3, 5), 32);
  assert.equal(roundPoints(3, 2), -30);
  assert.equal(displayPoints(-9), '−0.9');
  let state = fresh();
  state.active.bids = [3, 4, 2, 3];
  state.active.locked = true;
  state = recordResult(state, [3, 4, 3, 3]);
  state.active.bids = [4, 4, 3, 3];
  state.active.locked = true;
  state = recordResult(state, [5, 4, 1, 3]);
  assert.deepEqual(totals(state.active), [71, 80, -9, 60]);
});

test('results require locked bids and valid individual trick counts', () => {
  const state = fresh();
  assert.throws(() => recordResult(state, [4, 3, 3, 3]), /Lock/);
  assert.equal(validTricks([4, 3, 3, 3]), true);
  for (const won of [[14, 0, 0, -1], [3.5, 3.5, 3, 3], [13], [NaN, 0, 0, 0]]) {
    assert.equal(validTricks(won), false);
    assert.throws(() => recordResult(state, won), /13/);
  }
  assert.equal(state.active.rounds.length, 0);
});

test('records the card values directly without a total-tricks check', () => {
  for (const bids of [[3, 3, 3, 3], [13, 13, 13, 13]]) {
    const state = fresh();
    state.active.bids = bids;
    state.active.locked = true;
    const next = recordResult(state, state.active.bids);
    assert.deepEqual(next.active.rounds[0], { bids, won: bids });
    assert.deepEqual(totals(next.active), bids.map(bid => bid * 10));
    assert.equal(next.active.locked, false);
    assert.equal(validState(JSON.parse(JSON.stringify(next))), true);
    assert.equal(state.active.rounds.length, 0);
    const recordedBid = bids[0];
    next.active.bids[0] = 1;
    assert.equal(next.active.rounds[0].won[0], recordedBid);
  }
});

test('the fifth round archives once, edits update it, and a new game keeps its snapshot', () => {
  let state = fresh();
  const original = structuredClone(state);
  for (let i = 0; i < 5; i++) {
    state.active.locked = true;
    state = recordResult(state, [4, 3, 3, 3]);
    assert.equal(state.history.length, i === 4 ? 1 : 0);
  }
  assert.equal(original.active.rounds.length, 0);
  assert.equal(validState(state), true);
  assert.deepEqual(totals(state.active), [155, 150, 150, 150]);
  assert.throws(() => recordResult(state, [4, 3, 3, 3]), /Lock/);
  state = recordResult(state, [3, 4, 3, 3], true);
  assert.equal(state.history.length, 1);
  assert.deepEqual(state.history[0].rounds[4].won, [3, 4, 3, 3]);
  assert.equal(state.active.rounds.length, 5);
  const past = structuredClone(state.history[0]);
  state.active = createGame(state.active.names);
  state.active.names[0] = 'New player';
  assert.deepEqual(state.history[0], past);
  assert.equal(validState(JSON.parse(JSON.stringify(state))), true);
});

test('saved data validation rejects malformed states and accepts names as plain text', () => {
  assert.equal(validState(fresh()), true);
  assert.equal(validNames(['  ', 'B', 'C', 'D']), false);
  assert.equal(validNames(['<img src=x>', 'B', 'C', 'D']), true);
  for (const value of [null, {}, { ...fresh(), version: 2 }, { ...fresh(), history: [{}] }]) assert.equal(Boolean(validState(value)), false);
  const state = fresh();
  state.active.bids[0] = 0;
  assert.equal(validState(state), false);
  state.active.bids[0] = 3;
  state.active.rounds.push({ bids: [3, 3, 3, 3], won: [14, 3, 3, 3] });
  assert.equal(validState(state), false);
});
