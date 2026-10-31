export const DEFAULT_NAMES = ['Suyash', 'Aayush', 'Sandesh', 'Prasanna'];
export const STORAGE_KEY = 'callbreak.v1';

export function createGame(names = DEFAULT_NAMES) {
  return { id: crypto.randomUUID(), startedAt: new Date().toISOString(), names: [...names], bids: [3, 3, 3, 3], locked: false, rounds: [] };
}

export function migrateDefaultNames(state) {
  const previous = ['You', 'Aayush', 'Sneha', 'Rohan'];
  if (!state.active.names.every((name, index) => name === previous[index])) return state;
  return { ...state, active: { ...state.active, names: [...DEFAULT_NAMES] } };
}

function saveDraft(state) {
  return state.active.rounds.length < 5
    ? [structuredClone(state.active), ...state.history.filter(game => game.id !== state.active.id)]
    : state.history;
}

export function startNewGame(state) {
  return { ...state, active: createGame(state.active.names), history: saveDraft(state) };
}

export function continueGame(state, id) {
  const draft = state.history.find(game => game.id === id && game.rounds.length < 5);
  if (!draft) throw new Error('This draft is no longer available. Choose another game from History.');
  return { ...state, active: structuredClone(draft), history: saveDraft(state).filter(game => game.id !== id) };
}

// Scores use tenths to avoid floating-point rounding errors across rounds.
export function roundPoints(bid, won) {
  return won < bid ? -bid * 10 : bid * 10 + won - bid;
}

export function displayPoints(points) {
  return String(points / 10).replace('-', '−');
}

export function totals(game) {
  return game.names.map((_, i) => game.rounds.reduce((sum, round) => sum + roundPoints(round.bids[i], round.won[i]), 0));
}

const four = (value, check) => Array.isArray(value) && value.length === 4 && value.every(check);
const count = (value, min) => Number.isInteger(value) && value >= min && value <= 13;
export const validNames = names => four(names, name => typeof name === 'string' && name.trim().length > 0 && name.length <= 18);
export const validTricks = won => four(won, value => count(value, 0));
const validBids = bids => four(bids, value => count(value, 1));
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function validGame(game) {
  return game && typeof game.id === 'string' && game.id.length > 0 && validDate(game.startedAt)
    && validNames(game.names) && validBids(game.bids) && typeof game.locked === 'boolean'
    && Array.isArray(game.rounds) && game.rounds.length <= 5
    && game.rounds.every(round => round && validBids(round.bids) && validTricks(round.won))
    && (game.rounds.length < 5 || validDate(game.finishedAt));
}

export function validState(state) {
  return state?.version === 1 && validGame(state.active) && Array.isArray(state.history)
    && state.history.every(validGame)
    && new Set(state.history.map(game => game.id)).size === state.history.length
    && (state.active.rounds.length < 5
      ? state.history.every(game => game.id !== state.active.id)
      : state.history.some(game => game.id === state.active.id && game.rounds.length === 5));
}

export function recordResult(state, won, editing = false) {
  const game = state.active;
  if (!validTricks(won)) throw new Error('Each trick count must be a whole number from 0 to 13.');
  if (editing && !game.rounds.length) throw new Error('There is no result to edit yet.');
  if (!editing && (game.rounds.length === 5 || !game.locked)) throw new Error('Lock the bids before recording a result.');
  const rounds = game.rounds.slice();
  if (editing) rounds[rounds.length - 1] = { ...rounds.at(-1), won: [...won] };
  else rounds.push({ bids: [...game.bids], won: [...won] });
  const active = { ...game, rounds, locked: editing ? game.locked : false };
  let history = state.history;
  if (rounds.length === 5) {
    active.finishedAt = game.finishedAt || new Date().toISOString();
    history = [structuredClone(active), ...history.filter(past => past.id !== active.id)];
  }
  return { ...state, active, history };
}
