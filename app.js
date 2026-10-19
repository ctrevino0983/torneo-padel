// Torneo de Pádel: aplicación estática (sin build). Script clásico para funcionar también con file://.
(function () {
'use strict';

// Lógica pura del torneo: Round Robin, horarios, posiciones y fase final.

const MATCH_MINUTES = 30;

// Método del círculo. Con número impar se añade un descanso (null).
function roundRobin(teamIds) {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const rounds = [];
  let arr = ids;
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}

// Rondas Round Robin con el equipo en descanso (bye) de cada ronda, si lo hay.
function roundsWithBye(teamIds) {
  return roundRobin(teamIds).map((pairs) => {
    const played = new Set(pairs.flat());
    return { matches: pairs, bye: teamIds.find((id) => !played.has(id)) ?? null };
  });
}

// Mezcla Fisher-Yates (no modifica el arreglo original).
function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Asigna franjas de 30 min y canchas. Una jornada nunca repite equipo, y las
// franjas son consecutivas, por lo que ningún equipo juega dos partidos a la vez.
function buildGroupMatches(teamIds, courts) {
  const perSlot = Math.max(1, courts | 0);
  const matches = [];
  let slot = 0;
  roundRobin(teamIds).forEach((pairs, ri) => {
    for (let i = 0; i < pairs.length; i += perSlot) {
      pairs.slice(i, i + perSlot).forEach(([a, b], c) => {
        matches.push({ id: `G${matches.length + 1}`, stage: 'group', round: ri + 1, slot, court: c + 1, a, b });
      });
      slot++;
    }
  });
  return matches;
}

function slotTime(startTime, slot) {
  const [h, m] = (startTime || '09:00').split(':').map(Number);
  const total = (h * 60 + m + slot * MATCH_MINUTES) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function isValidResult(r) {
  return !!r && Number.isInteger(r.sa) && Number.isInteger(r.sb) && r.sa >= 0 && r.sb >= 0 &&
    r.sa !== r.sb && Number.isInteger(r.ga ?? 0) && Number.isInteger(r.gb ?? 0);
}

function winnerOf(match, results) {
  const r = results[match.id];
  if (!match.a || !match.b || !isValidResult(r)) return null;
  return r.sa > r.sb ? match.a : match.b;
}

function computeStandings(teams, matches, results) {
  const rows = new Map(teams.map((t) => [t.id, {
    id: t.id, name: t.name, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, gf: 0, gc: 0, pts: 0,
  }]));
  for (const m of matches) {
    const r = results[m.id];
    if (m.stage !== 'group' || !isValidResult(r)) continue;
    const A = rows.get(m.a), B = rows.get(m.b);
    if (!A || !B) continue;
    const ga = r.ga ?? 0, gb = r.gb ?? 0;
    A.pj++; B.pj++;
    A.sf += r.sa; A.sc += r.sb; B.sf += r.sb; B.sc += r.sa;
    A.gf += ga; A.gc += gb; B.gf += gb; B.gc += ga;
    const [w, l] = r.sa > r.sb ? [A, B] : [B, A];
    w.pg++; w.pts += 3; l.pp++;
  }
  return [...rows.values()]
    .map((x) => ({ ...x, ds: x.sf - x.sc, dg: x.gf - x.gc }))
    .sort((x, y) => y.pts - x.pts || y.ds - x.ds || y.dg - x.dg || x.name.localeCompare(y.name, 'es'));
}

function groupComplete(matches, results) {
  const g = matches.filter((m) => m.stage === 'group');
  return g.length > 0 && g.every((m) => isValidResult(results[m.id]));
}

// Fase final a partir de los cabezas de serie (ids ordenados por posición).
// 4+ equipos: semifinales 1v4 y 2v3, final y tercer lugar. Con 2 o 3 equipos: solo final entre los dos primeros.
function buildPlayoffs(seeds, results, groupSlots, courts) {
  const perSlot = Math.max(1, courts | 0);
  if (seeds.length < 2) return [];
  if (seeds.length < 4) {
    return [{ id: 'F', stage: 'final', label: 'Final', slot: groupSlots, court: 1, a: seeds[0], b: seeds[1] }];
  }
  const semis = [
    { id: 'S1', stage: 'semi', label: 'Semifinal 1', a: seeds[0], b: seeds[3] },
    { id: 'S2', stage: 'semi', label: 'Semifinal 2', a: seeds[1], b: seeds[2] },
  ];
  let slot = groupSlots;
  semis.forEach((m, i) => {
    m.slot = slot + Math.floor(i / perSlot);
    m.court = (i % perSlot) + 1;
  });
  slot = semis[semis.length - 1].slot + 1;
  const loser = (m) => {
    const w = winnerOf(m, results);
    return w ? (w === m.a ? m.b : m.a) : null;
  };
  const third = { id: 'T', stage: 'third', label: 'Tercer lugar', a: loser(semis[0]), b: loser(semis[1]) };
  const final = { id: 'F', stage: 'final', label: 'Final', a: winnerOf(semis[0], results), b: winnerOf(semis[1], results) };
  final.slot = slot; final.court = 1;
  third.slot = perSlot > 1 ? slot : slot + 1;
  third.court = perSlot > 1 ? 2 : 1;
  return [...semis, third, final];
}

function podium(playoffs, results) {
  const f = playoffs.find((m) => m.id === 'F');
  const t = playoffs.find((m) => m.id === 'T');
  if (!f) return null;
  const w = winnerOf(f, results);
  if (!w) return null;
  return { first: w, second: w === f.a ? f.b : f.a, third: t ? winnerOf(t, results) : null };
}

// ---------- Estado y persistencia ----------
const KEY = 'torneo-padel:v1';
const INITIAL = () => ({
  teams: [], courts: 2, startTime: '09:00',
  matches: null, results: {}, seeds: null,
  rounds: null, roundResults: {},
});

// Compatible con datos antiguos: descarta "pool" y completa campos faltantes.
function normalize(s) {
  const base = INITIAL();
  if (!s || typeof s !== 'object' || !Array.isArray(s.teams)) return base;
  const rest = { ...s };
  delete rest.pool;
  const out = { ...base, ...rest };
  out.teams = out.teams.filter((t) => t && t.id && (t.name || t.players));
  if (!out.results || typeof out.results !== 'object') out.results = {};
  if (!out.roundResults || typeof out.roundResults !== 'object') out.roundResults = {};
  out.courts = Math.max(1, Math.min(20, parseInt(out.courts, 10) || 2));
  if (typeof out.startTime !== 'string' || !/^\d{1,2}:\d{2}$/.test(out.startTime)) out.startTime = '09:00';
  return out;
}

function load() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return INITIAL(); }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento no disponible */ }
}

if (typeof document === 'undefined') {
  module.exports = {
    roundRobin, roundsWithBye, shuffle, buildGroupMatches, slotTime, isValidResult, winnerOf,
    computeStandings, groupComplete, buildPlayoffs, podium, normalize,
  };
  return;
}

let state = load();
let tab = 'equipos';
let editing = null;

const uid = () => Math.random().toString(36).slice(2, 9);
const label = (t) => (t.players ? t.players.join(' / ') : t.name);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teamName = (id) => { const t = state.teams.find((x) => x.id === id); return t ? label(t) : 'Por definir'; };
const mkTeam = (a, b, id = uid()) => ({ id, name: `${a} / ${b}`, players: [a, b] });
const started = () => !!state.matches;

function set(patch) { state = { ...state, ...patch }; save(); render(); }

// ---------- Vistas ----------
function standingsTable(rows, highlight = 0) {
  return `<div class="scroll"><table>
    <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>DS</th><th>DJ</th><th>Pts</th></tr></thead>
    <tbody>${rows.map((s, i) => `<tr class="${i < highlight ? 'top' : ''}"><td>${i + 1}</td><td>${esc(s.name)}</td><td>${s.pj}</td><td>${s.pg}</td><td>${s.pp}</td><td>${s.ds}</td><td>${s.dg}</td><td><b>${s.pts}</b></td></tr>`).join('')}</tbody>
  </table></div>`;
}

function matchCard(m, r, scope, showRound) {
  const ready = !!(m.a && m.b);
  const win = winnerOf(m, r ? { [m.id]: r } : {});
  const v = (k) => (r && r[k] !== undefined && r[k] !== null ? r[k] : '');
  const field = (k) => `<input type="number" min="0" inputmode="numeric" data-f="${k}" value="${esc(v(k))}" ${ready ? '' : 'disabled'} aria-label="${k}">`;
  return `<div class="match ${win ? 'done' : ''}" data-scope="${scope}" data-id="${esc(m.id)}">
    <div class="meta">${esc(m.label ?? (showRound ? `Jornada ${m.round}` : `Ronda ${m.round}`))} · Cancha ${m.court} · ${win ? 'Jugado' : 'Pendiente'}</div>
    <div class="teams"><span class="${win && win === m.a ? 'win' : ''}">${esc(teamName(m.a))}</span><span class="vs">vs</span><span class="${win && win === m.b ? 'win' : ''}">${esc(teamName(m.b))}</span></div>
    <div class="score">
      <span>Sets ${field('sa')} - ${field('sb')}</span>
      <span>Juegos ${field('ga')} - ${field('gb')}</span>
      <button data-action="save-result" ${ready ? '' : 'disabled'}>Guardar</button>
      ${r ? '<button class="ghost" data-action="clear-result">Borrar</button>' : ''}
    </div>
  </div>`;
}

function matchList(matches, results, scope, showRound, hideTime) {
  const slots = [...new Set(matches.map((m) => m.slot))].sort((a, b) => a - b);
  return `<div>${slots.map((slot) => `<div class="slot">
    ${hideTime ? '' : `<div class="time">${slotTime(state.startTime, slot)}</div>`}
    ${matches.filter((m) => m.slot === slot).map((m) => matchCard(m, results[m.id], scope, showRound)).join('')}
  </div>`).join('')}</div>`;
}

function roundMatchesOf() {
  return (state.rounds ?? []).flatMap((r, i) => r.matches.map(([a, b], k) => ({
    id: `R${i + 1}-${a}-${b}`, stage: 'group', round: i + 1, slot: i, court: k + 1, a, b,
  })));
}

function groupSlots() {
  return state.matches ? Math.max(0, ...state.matches.map((m) => m.slot)) + 1 : 0;
}

function playoffsOf() {
  return state.seeds ? buildPlayoffs(state.seeds, state.results, groupSlots(), state.courts) : [];
}

function viewEquipos() {
  const { teams } = state;
  const st = started();
  const items = teams.map((t) => (editing === t.id
    ? `<li><form class="row" data-form="rename" data-id="${esc(t.id)}">
        <input name="a" value="${esc(t.players?.[0] ?? t.name)}" aria-label="Jugador 1" required>
        <input name="b" value="${esc(t.players?.[1] ?? '')}" aria-label="Jugador 2" required>
        <button>Guardar</button><button type="button" class="ghost" data-action="cancel-edit">Cancelar</button>
      </form></li>`
    : `<li><span>${esc(label(t))}</span><span>
        <button class="ghost" data-action="edit" data-id="${esc(t.id)}">Editar</button>
        <button class="ghost danger" data-action="remove" data-id="${esc(t.id)}" ${st ? 'disabled' : ''}>Quitar</button>
      </span></li>`)).join('');
  return `<section>
    <h2>Equipos (${teams.length})</h2>
    <form class="row" data-form="add">
      <input name="a" placeholder="Jugador 1" aria-label="Jugador 1" ${st ? 'disabled' : ''} required>
      <input name="b" placeholder="Jugador 2" aria-label="Jugador 2" ${st ? 'disabled' : ''} required>
      <button ${st ? 'disabled' : ''}>Agregar equipo</button>
    </form>
    ${st ? '<p class="note">El calendario ya fue generado. Solo puedes editar equipos; reinicia para agregar o quitar.</p>' : ''}
    <ul class="list">${items}</ul>
    <h3>Configuración</h3>
    <div class="row">
      <label>Canchas <input type="number" min="1" max="20" id="courts" value="${state.courts}" ${st ? 'disabled' : ''}></label>
      <label>Hora de inicio <input type="time" id="startTime" value="${esc(state.startTime)}"></label>
    </div>
    <p class="note">Cada partido dura 30 minutos. Con número impar de equipos habrá descansos.</p>
    <div class="row">
      <button data-action="gen-rounds" ${teams.length < 2 ? 'disabled' : ''}>Generar rondas</button>
      <button data-action="generate" ${teams.length < 3 || st ? 'disabled' : ''}>Generar calendario Round Robin</button>
      ${st ? '<button class="ghost" data-action="reset-cal">Reiniciar calendario</button>' : ''}
      <button class="ghost danger" data-action="reset-all">Borrar torneo</button>
    </div>
    ${teams.length < 3 ? '<p class="note">Agrega al menos 3 equipos.</p>' : ''}
  </section>`;
}

function viewRondas() {
  const { rounds, teams } = state;
  let body;
  if (!rounds) {
    body = '<p class="note">Aún no se han generado las rondas. Se generan con los equipos registrados (mínimo 2).</p>';
  } else {
    const rm = roundMatchesOf();
    body = rounds.map((r, i) => `<div><h3>Ronda ${i + 1}</h3>
      ${matchList(rm.filter((m) => m.round === i + 1), state.roundResults, 'round', false, true)}
      ${r.bye ? `<div class="note">Descansa: ${esc(teamName(r.bye))}</div>` : ''}</div>`).join('') +
      `<h3>Tabla de posiciones de las rondas</h3>${standingsTable(computeStandings(teams, rm, state.roundResults))}
      <p class="note">3 puntos por victoria. Desempate: diferencia de sets (DS), luego de juegos (DJ).</p>`;
  }
  return `<section><h2>Rondas sugeridas</h2>
    <div class="row">
      <button data-action="gen-rounds" ${teams.length < 2 || rounds ? 'disabled' : ''}>Generar rondas</button>
      <button class="ghost" data-action="regen-rounds" ${teams.length < 2 || !rounds ? 'disabled' : ''}>Volver a generar</button>
    </div>${body}</section>`;
}

function viewCalendario() {
  return `<section><h2>Calendario</h2>${!started()
    ? '<p class="note">Aún no se ha generado el calendario.</p>'
    : matchList(state.matches, state.results, 'group', true, false)}</section>`;
}

function viewPosiciones() {
  const body = started() ? standingsTable(computeStandings(state.teams, state.matches, state.results), 4) : '<p class="note">Genera el calendario primero.</p>';
  return `<section><h2>Tabla de posiciones</h2>${body}
    <p class="note">3 puntos por victoria. Desempate: diferencia de sets (DS), luego de juegos (DJ). Clasifican los 4 primeros.</p></section>`;
}

function viewFinales() {
  const { seeds, results } = state;
  let body = '';
  if (!started()) body = '<p class="note">Genera el calendario primero.</p>';
  else if (!seeds) {
    const done = groupComplete(state.matches, results);
    body = `<p class="note">${done ? 'Fase de grupos completa.' : 'Registra todos los resultados de grupos para iniciar la fase final.'}</p>
      <button data-action="start-playoffs" ${done ? '' : 'disabled'}>Generar fase final</button>`;
  } else {
    const po = playoffsOf();
    const res = podium(po, results);
    const names = { semi: 'Semifinales', final: 'Final', third: 'Tercer lugar' };
    body = (res ? `<div class="podium">🏆 Campeón: <b>${esc(teamName(res.first))}</b> · 🥈 ${esc(teamName(res.second))}${res.third ? ` · 🥉 ${esc(teamName(res.third))}` : ''}</div>` : '') +
      `<div class="bracket">${['semi', 'final', 'third'].map((st) => `<div class="col"><h3>${names[st]}</h3>${matchList(po.filter((m) => m.stage === st), results, 'final', false, false)}</div>`).join('')}</div>`;
  }
  return `<section><h2>Fase final</h2>${body}</section>`;
}

const TABS = [['equipos', 'Equipos', viewEquipos], ['calendario', 'Calendario', viewCalendario], ['posiciones', 'Posiciones', viewPosiciones], ['finales', 'Finales', viewFinales], ['rondas', 'Rondas', viewRondas]];

function render() {
  document.getElementById('tabs').innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('');
  document.getElementById('main').innerHTML = TABS.find(([k]) => k === tab)[2]();
}

// ---------- Acciones ----------
function setResult(scope, id, r) {
  if (scope === 'round') {
    const next = { ...state.roundResults };
    if (r) next[id] = r; else delete next[id];
    set({ roundResults: next });
  } else if (scope === 'group') {
    // Al cambiar un resultado de grupo se invalida la fase final.
    const next = { ...state.results };
    if (r) next[id] = r; else delete next[id];
    set({ results: Object.fromEntries(Object.entries(next).filter(([k]) => k.startsWith('G'))), seeds: null });
  } else {
    const next = { ...state.results };
    if (r) next[id] = r; else delete next[id];
    if (id.startsWith('S')) { delete next.F; delete next.T; }
    set({ results: next });
  }
}

function genRounds(reshuffle) {
  if (state.teams.length < 2) return;
  const ids = state.teams.map((t) => t.id);
  tab = 'rondas';
  set({ rounds: roundsWithBye(reshuffle ? shuffle(ids) : ids), roundResults: {} });
}

function reset(all) {
  if (!confirm(all ? '¿Borrar todo el torneo?' : '¿Reiniciar el calendario y los resultados?')) return;
  tab = 'equipos';
  editing = null;
  if (all) { state = INITIAL(); save(); render(); } else set({ matches: null, results: {}, seeds: null });
}

document.addEventListener('click', (e) => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; render(); return; }
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const { action, id } = btn.dataset;
  const card = btn.closest('.match');
  const teamsReset = { rounds: null, roundResults: {} };
  switch (action) {
    case 'edit': editing = id; render(); break;
    case 'cancel-edit': editing = null; render(); break;
    case 'remove': if (!started()) set({ teams: state.teams.filter((t) => t.id !== id), ...teamsReset }); break;
    case 'gen-rounds': genRounds(false); break;
    case 'regen-rounds': genRounds(true); break;
    case 'generate':
      if (state.teams.length < 3) break;
      tab = 'calendario';
      set({ matches: buildGroupMatches(state.teams.map((t) => t.id), state.courts), results: {}, seeds: null });
      break;
    case 'reset-cal': reset(false); break;
    case 'reset-all': reset(true); break;
    case 'start-playoffs':
      tab = 'finales';
      set({ seeds: computeStandings(state.teams, state.matches, state.results).slice(0, 4).map((s) => s.id) });
      break;
    case 'clear-result': setResult(card.dataset.scope, card.dataset.id, null); break;
    case 'save-result': {
      const n = (k) => { const v = card.querySelector(`[data-f="${k}"]`).value; return v === '' ? NaN : parseInt(v, 10); };
      const res = { sa: n('sa'), sb: n('sb'), ga: n('ga') || 0, gb: n('gb') || 0 };
      if (!isValidResult(res)) { alert('Ingresa sets distintos (en pádel no hay empates).'); break; }
      setResult(card.dataset.scope, card.dataset.id, res);
      break;
    }
    default:
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const a = form.elements.a.value.trim();
  const b = form.elements.b.value.trim();
  if (!a || !b) { alert('Los nombres de ambos jugadores son obligatorios.'); return; }
  const teamsReset = { rounds: null, roundResults: {} };
  if (form.dataset.form === 'add') {
    if (started()) return;
    set({ teams: [...state.teams, mkTeam(a, b)], ...teamsReset });
  } else {
    editing = null;
    set({ teams: state.teams.map((t) => (t.id === form.dataset.id ? mkTeam(a, b, t.id) : t)), ...teamsReset });
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'courts') {
    state.courts = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1));
    e.target.value = state.courts;
    save();
  } else if (e.target.id === 'startTime') {
    state.startTime = e.target.value || '09:00';
    save();
  }
});

render();

})();
