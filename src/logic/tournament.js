// Lógica pura del torneo: Round Robin, horarios, posiciones y fase final.

export const MATCH_MINUTES = 30;

// Método del círculo. Con número impar se añade un descanso (null).
export function roundRobin(teamIds) {
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

// Asigna franjas de 30 min y canchas. Una jornada nunca repite equipo, y las
// franjas son consecutivas, por lo que ningún equipo juega dos partidos a la vez.
export function buildGroupMatches(teamIds, courts) {
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

export function slotTime(startTime, slot) {
  const [h, m] = (startTime || '09:00').split(':').map(Number);
  const total = (h * 60 + m + slot * MATCH_MINUTES) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function isValidResult(r) {
  return !!r && Number.isInteger(r.sa) && Number.isInteger(r.sb) && r.sa >= 0 && r.sb >= 0 &&
    r.sa !== r.sb && Number.isInteger(r.ga ?? 0) && Number.isInteger(r.gb ?? 0);
}

export function winnerOf(match, results) {
  const r = results[match.id];
  if (!match.a || !match.b || !isValidResult(r)) return null;
  return r.sa > r.sb ? match.a : match.b;
}

export function computeStandings(teams, matches, results) {
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

export function groupComplete(matches, results) {
  const g = matches.filter((m) => m.stage === 'group');
  return g.length > 0 && g.every((m) => isValidResult(results[m.id]));
}

// Fase final a partir de los cabezas de serie (ids ordenados por posición).
// 4+ equipos: semifinales 1v4 y 2v3, final y tercer lugar. Con 2 o 3 equipos: solo final entre los dos primeros.
export function buildPlayoffs(seeds, results, groupSlots, courts) {
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

export function podium(playoffs, results) {
  const f = playoffs.find((m) => m.id === 'F');
  const t = playoffs.find((m) => m.id === 'T');
  if (!f) return null;
  const w = winnerOf(f, results);
  if (!w) return null;
  return { first: w, second: w === f.a ? f.b : f.a, third: t ? winnerOf(t, results) : null };
}
