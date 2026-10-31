import { createGame, startNewGame, continueGame, lockBids, needsRedeal, STORAGE_KEY, validState, validNames, validTricks, migrateDefaultNames, recordResult, roundPoints, displayPoints, totals } from '../lib/game.js';

const $ = selector => document.querySelector(selector);
const colors = ['var(--mint)', 'var(--peach)', 'var(--lilac)', 'var(--blue)'];
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const icon = name => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
let state = { version: 1, active: createGame(), history: [] };
let canSave = true;

function showStorageError(message) {
  $('#storage-notice').textContent = message;
  $('#storage-notice').hidden = false;
}

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const stored = JSON.parse(raw);
    if (!validState(stored)) throw new Error('Invalid saved game');
    state = migrateDefaultNames(stored);
  }
} catch {
  // Preserve unreadable data instead of overwriting a potentially recoverable game.
  canSave = false;
  showStorageError('We couldn’t read your saved games. Existing data has been kept. This session’s changes won’t be saved.');
}

function persist() {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('#storage-notice').hidden = true;
  } catch {
    showStorageError('Your browser couldn’t save this game. Keep this tab open to retain your scores.');
  }
}

function commit(next) {
  state = next;
  persist();
  render();
}

function scoreCells(round) {
  return round.bids.map((bid, i) => {
    const points = roundPoints(bid, round.won[i]);
    return `<td class="${points < 0 ? 'negative' : ''}">${displayPoints(points)}<small><span>${bid} bid</span> <span>${round.won[i]} won</span></small></td>`;
  }).join('');
}

function scoreRows(game) {
  return game.rounds.map((result, i) => `<tr><th scope="row" aria-label="Round ${i + 1}">${i + 1}</th>${scoreCells(result)}</tr>`).join('')
    + (game.rounds.length === 5 ? '' : `<tr class="current-row"><th scope="row" aria-label="Round ${game.rounds.length + 1}, current">${game.rounds.length + 1}<span class="live-dot" aria-hidden="true"></span></th>${game.bids.map(bid => `<td>${bid}<small>${game.locked ? 'bid locked' : 'bid'}</small></td>`).join('')}</tr>`);
}

function renderHistory() {
  const drafts = state.history.filter(game => game.rounds.length < 5).length;
  const completed = state.history.length - drafts;
  $('#history-count').textContent = `${drafts} ${drafts === 1 ? 'draft' : 'drafts'} · ${completed} completed ${completed === 1 ? 'game' : 'games'}`;
  if (!state.history.length) {
    $('#history-list').innerHTML = `<div class="empty-history">${icon('history-icon')}<h3>The first of many good games.</h3><p>Finish a game or choose New game to save your current table as a draft. You can continue drafts from here.</p><a class="primary-button" href="#game">Let’s play ${icon('back')}</a></div>`;
    return;
  }
  const openGames = new Set([...document.querySelectorAll('.history-game details[open]')].map(node => node.dataset.game));
  $('#history-list').innerHTML = state.history.map((game, gameIndex) => {
    const complete = game.rounds.length === 5;
    const date = new Date(complete ? game.finishedAt : game.startedAt);
    const dateLabel = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const title = `${date.toLocaleDateString('en-GB', { weekday: 'long' })} at the table`;
    const points = totals(game);
    const best = Math.max(...points);
    const winners = points.filter(value => value === best).length;
    return `<article class="history-game" style="--history-color:${colors[gameIndex % 4]}"><details data-game="${escape(game.id)}" ${openGames.has(game.id) ? 'open' : ''}>
      <summary>
        <div class="history-game-heading">
          <time class="history-date" datetime="${escape(date.toISOString())}" aria-label="${escape(dateLabel)}"><strong>${date.getDate()}</strong>${date.toLocaleDateString('en-GB', { month: 'short' })}</time>
          <div class="history-title"><h3>${escape(title)}${complete ? '' : '<span class="draft-tag">Draft</span>'}</h3><p>${escape(dateLabel)} · ${game.rounds.length} of 5 rounds played</p></div>
          <span class="history-action"><span class="when-closed">View scorecard</span><span class="when-open">Hide scorecard</span>${icon('chevron')}</span>
        </div>
        <div class="history-results">${game.names.map((name, i) => `<div class="history-player">
          <span class="mini-avatar" style="background:${colors[i]}" aria-hidden="true">${escape([...name][0].toUpperCase())}</span>
          <div class="history-player-info"><span class="history-player-name">${escape(name)}</span><span class="history-player-score">${displayPoints(points[i])} <small>pts</small></span>${complete && points[i] === best ? `<span class="history-winner">${icon('trophy')}${winners > 1 ? 'Joint winner' : 'Winner'}</span>` : ''}</div>
        </div>`).join('')}</div>
      </summary>
      <div class="history-detail">
        <h3>Round by round</h3>
        <div class="score-table-wrap" role="region" aria-label="${escape(title)}: round-by-round scorecard">
          <table><caption class="sr-only">${escape(title)}: ${complete ? 'final' : 'draft'} scorecard</caption>
            <thead><tr><th scope="col">Round</th>${game.names.map(name => `<th scope="col">${escape(name)}</th>`).join('')}</tr></thead>
            <tbody>${scoreRows(game)}</tbody>
            <tfoot><tr><th scope="row">${complete ? 'Final' : 'Total'} points</th>${points.map(value => `<td>${displayPoints(value)}</td>`).join('')}</tr></tfoot>
          </table>
        </div>
        <p class="score-legend">Points are shown above each round’s bid and tricks won.</p>
      </div>
    </details>${complete ? '' : `<div class="draft-actions"><p>Continue round ${game.rounds.length + 1}${game.locked ? ' · Bids locked' : ''}</p><button class="primary-button" data-continue-game="${escape(game.id)}">Continue<span class="sr-only"> round ${game.rounds.length + 1} with ${escape(game.names.join(', '))}</span></button></div>`}</article>`;
  }).join('');
}

function render() {
  const game = state.active;
  const complete = game.rounds.length === 5;
  const redeal = !complete && needsRedeal(game.bids);
  const points = totals(game);
  const round = game.rounds.length + 1;
  game.names.forEach((name, i) => {
    document.querySelectorAll(`[data-name="${i}"]`).forEach(node => { node.textContent = name; });
    document.querySelectorAll(`[data-initial="${i}"]`).forEach(node => { node.textContent = [...name][0].toUpperCase(); });
    $(`#bid-${i}`).value = game.bids[i];
    $(`[data-player-total="${i}"]`).textContent = displayPoints(points[i]);
  });
  document.querySelectorAll('.stepper').forEach(button => {
    const i = Number(button.dataset.index);
    const step = Number(button.dataset.step);
    button.disabled = complete || game.locked || game.bids[i] + step < 1 || game.bids[i] + step > 13;
    button.setAttribute('aria-label', `${step < 0 ? 'Decrease' : 'Increase'} ${game.names[i]}’s bid`);
  });
  $('#round-tag').textContent = complete ? '5 rounds complete' : `Round ${round} of 5`;
  $('#bids-heading').textContent = complete ? 'That’s a wrap!' : 'The table';
  $('#bid-instructions').textContent = complete ? 'A good game, safely tucked into History.' : redeal ? 'Combined bids below 8 require a redeal.' : game.locked ? 'After play, record the tricks each player actually won.' : 'Set everyone’s bid, then lock them in.';
  $('#bid-total').textContent = complete ? 'Good company. Great game.' : game.locked && !redeal ? 'Bids are locked. Game on!' : `${game.bids.reduce((a, b) => a + b, 0)} total bids`;
  $('#bid-status').textContent = complete ? 'Your full scorecard is in History.' : redeal ? 'Redeal required for this hand.' : game.locked ? `Your calls are set for round ${round}.` : 'All four players are ready to call.';
  $('#lock-label').textContent = complete ? 'Play again' : redeal ? 'Redeal' : game.locked ? 'Record tricks' : 'Lock bids';
  $('#lock-icon').setAttribute('href', complete ? '#plus' : redeal ? '#history-icon' : game.locked ? '#score' : '#lock');
  $('#status-icon').setAttribute('href', complete ? '#trophy' : redeal ? '#history-icon' : game.locked ? '#check' : '#spade');
  $('#unlock-bids').hidden = complete || !game.locked;
  $('#edit-players').hidden = complete;
  $('#rounds-played').textContent = game.rounds.length ? `${game.rounds.length} ${game.rounds.length === 1 ? 'round' : 'rounds'} played` : 'No rounds played yet';
  $('#score-rows').innerHTML = scoreRows(game);
  $('#score-totals').innerHTML = `<tr><th scope="row">${complete ? 'Final points' : 'Total points'}</th>${points.map(value => `<td>${displayPoints(value)}</td>`).join('')}</tr>`;
  $('#edit-result').hidden = !game.rounds.length;
  const order = game.names.map((name, i) => ({ name, i, points: points[i] })).sort((a, b) => b.points - a.points);
  $('.standings-list').innerHTML = order.map(player => `<li class="standing"><span class="rank">${1 + points.filter(value => value > player.points).length}</span><span class="mini-avatar" style="background:${colors[player.i]}" aria-hidden="true">${escape([...player.name][0].toUpperCase())}</span><span class="standing-name">${escape(player.name)}</span><span class="standing-score ${player.points < 0 ? 'negative' : ''}">${displayPoints(player.points)}<small>pts</small></span></li>`).join('');
  $('#standings-note').textContent = complete ? `${order.filter(player => player.points === order[0].points).map(player => player.name).join(' & ')} ${order.filter(player => player.points === order[0].points).length > 1 ? 'share the win' : 'takes the win'}. One more game?` : game.rounds.length ? `Still anyone’s game. ${5 - game.rounds.length} ${5 - game.rounds.length === 1 ? 'round' : 'rounds'} to go.` : 'A fresh table. Anyone’s game.';
  renderHistory();
}

$('#players').addEventListener('click', event => {
  const button = event.target.closest('button[data-step]');
  if (!button || button.disabled || state.active.locked || state.active.rounds.length === 5) return;
  const bids = [...state.active.bids];
  const index = Number(button.dataset.index);
  bids[index] = Math.min(13, Math.max(1, bids[index] + Number(button.dataset.step)));
  commit({ ...state, active: { ...state.active, bids } });
});

function showTable() {
  location.hash = '#game';
  updateView();
  $('#bids-heading').focus();
  window.scrollTo(0, 0);
}

function newGame() {
  commit(startNewGame(state));
  showTable();
}

document.querySelectorAll('[data-new-game]').forEach(button => button.addEventListener('click', newGame));
$('#history-list').addEventListener('click', event => {
  const button = event.target.closest('[data-continue-game]');
  if (!button) return;
  try {
    commit(continueGame(state, button.dataset.continueGame));
    showTable();
  } catch (error) {
    showStorageError(error.message);
  }
});

$('#lock-bids').addEventListener('click', () => {
  if (state.active.rounds.length === 5) {
    newGame();
  } else if (needsRedeal(state.active.bids)) {
    commit(lockBids(state));
    $('#bid-status').textContent = 'Redeal the cards, then set new bids.';
  } else if (state.active.locked) openResults();
  else commit(lockBids(state));
});
$('#unlock-bids').addEventListener('click', () => {
  commit({ ...state, active: { ...state.active, locked: false } });
  $('#lock-bids').focus();
});

const playerDialog = $('#players-dialog');
const playerForm = $('#players-form');
$('#edit-players').addEventListener('click', () => {
  state.active.names.forEach((name, i) => {
    const input = playerForm.elements.namedItem(`player${i}`);
    input.value = name;
    input.setCustomValidity('');
  });
  playerDialog.showModal();
});
playerForm.addEventListener('input', event => event.target.setCustomValidity(''));
playerForm.addEventListener('submit', event => {
  event.preventDefault();
  const inputs = state.active.names.map((_, i) => playerForm.elements.namedItem(`player${i}`));
  inputs.forEach(input => input.setCustomValidity(input.value.trim() ? '' : 'Enter a player name.'));
  if (!playerForm.reportValidity()) return;
  const names = inputs.map(input => input.value.trim());
  if (!validNames(names)) return;
  commit({ ...state, active: { ...state.active, names } });
  playerDialog.close();
});
$('#cancel-players').addEventListener('click', () => playerDialog.close());

const resultDialog = $('#result-dialog');
const resultForm = $('#result-form');
let editingResult = false;
function readTricks() {
  return state.active.names.map((_, i) => resultForm.elements.namedItem(`won${i}`).valueAsNumber);
}
function updateTrickTotal() {
  const won = readTricks();
  const entered = won.map(value => Number.isNaN(value) ? 0 : value);
  const total = entered.reduce((sum, value) => sum + value, 0);
  const valid = validTricks(entered);
  $('#trick-total').textContent = valid
    ? `Total: ${total} / 13 tricks${total > 13 ? ` · ${total - 13} too many` : ''}`
    : 'Use whole numbers from 0 to 13.';
  $('#trick-total').classList.toggle('form-error', !valid || total > 13);
  $('#save-result').disabled = !validTricks(won) || total > 13;
}
function openResults(editing = false) {
  const game = state.active;
  editingResult = editing;
  const result = editing ? game.rounds.at(-1) : { bids: game.bids };
  $('#result-title').textContent = editing ? `Edit round ${game.rounds.length}` : `Round ${game.rounds.length + 1}: tricks won`;
  $('#result-description').textContent = editing ? 'Update the tricks each player won. The combined total must be 13 or less.' : 'Enter the tricks each player actually won. The combined total must be 13 or less.';
  $('#save-result').textContent = editing ? 'Save changes' : 'Save round';
  game.names.forEach((name, i) => {
    $(`[data-result-name="${i}"]`).textContent = name;
    $(`[data-result-bid="${i}"]`).textContent = `${result.bids[i]} bid`;
    resultForm.elements.namedItem(`won${i}`).value = editing ? result.won[i] : '';
  });
  $('#result-error').hidden = true;
  updateTrickTotal();
  resultDialog.showModal();
}
$('#edit-result').addEventListener('click', () => openResults(true));
resultForm.addEventListener('input', () => {
  $('#result-error').hidden = true;
  updateTrickTotal();
});
resultForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!resultForm.reportValidity()) return;
  try {
    commit(recordResult(state, readTricks(), editingResult));
    resultDialog.close();
  } catch (error) {
    $('#result-error').textContent = error.message;
    $('#result-error').hidden = false;
  }
});
$('#cancel-result').addEventListener('click', () => resultDialog.close());

$('#open-guide').addEventListener('click', () => $('#guide-dialog').showModal());
$('#close-guide').addEventListener('click', () => $('#guide-dialog').close());

function updateView() {
  const showHistory = ['#history', '#history-heading'].includes(location.hash);
  const switchingViews = $('#history').hidden === showHistory;
  $('#game').hidden = showHistory;
  $('#history').hidden = !showHistory;
  $('.skip').href = showHistory ? '#history-heading' : '#game';
  $('.skip').textContent = showHistory ? 'Skip to game history' : 'Skip to the game';
  const activeLink = showHistory ? '#history' : location.hash === '#scorecard' ? '#scorecard' : '#game';
  document.querySelectorAll('.nav a').forEach(link => {
    if (link.getAttribute('href') === activeLink) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (switchingViews) {
    if (location.hash === '#scorecard') $('#scorecard').scrollIntoView();
    else window.scrollTo(0, 0);
  }
}
window.addEventListener('hashchange', updateView);
// Keep a second open tab from silently replacing this tab's older game state.
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  try {
    const next = JSON.parse(event.newValue);
    if (!validState(next)) throw new Error('Invalid saved game');
    state = migrateDefaultNames(next);
    canSave = true;
    playerDialog.close();
    resultDialog.close();
    $('#storage-notice').hidden = true;
    if (state !== next) persist();
    render();
  } catch {
    canSave = false;
    showStorageError('Saved game data changed in another tab. This tab won’t overwrite it.');
  }
});

persist();
render();
updateView();
