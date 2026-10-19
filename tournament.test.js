const test = require('node:test');
const assert = require('node:assert/strict');
const { roundRobin, buildGroupMatches, computeStandings, buildPlayoffs, slotTime, shuffle, roundsWithBye, normalize } = require('./app.js');

for (const n of [2, 3, 4, 5, 6, 7, 8]) {
  test(`round robin con ${n} equipos`, () => {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    for (const courts of [1, 2, 3]) {
      const ms = buildGroupMatches(ids, courts);
      assert.equal(ms.length, (n * (n - 1)) / 2);
      const pairs = new Set(ms.map((m) => [m.a, m.b].sort().join('|')));
      assert.equal(pairs.size, ms.length);
      const busy = new Set();
      const courtUse = new Set();
      for (const m of ms) {
        for (const t of [m.a, m.b]) {
          assert.ok(!busy.has(`${m.slot}:${t}`), 'equipo duplicado en franja');
          busy.add(`${m.slot}:${t}`);
        }
        assert.ok(!courtUse.has(`${m.slot}:${m.court}`));
        courtUse.add(`${m.slot}:${m.court}`);
        assert.ok(m.court <= courts);
      }
    }
  });
}

test('posiciones y desempates', () => {
  const teams = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const ms = buildGroupMatches(['a', 'b'], 1);
  const st = computeStandings(teams, ms, { G1: { sa: 0, sb: 2, ga: 3, gb: 12 } });
  assert.equal(st[0].id, 'b');
  assert.equal(st[0].pts, 3);
});

test('fase final', () => {
  const p = buildPlayoffs(['1', '2', '3', '4'], { S1: { sa: 2, sb: 0 }, S2: { sa: 0, sb: 2 } }, 6, 2);
  assert.deepEqual([p[2].a, p[2].b, p[3].a, p[3].b], ['4', '2', '1', '3']);
  assert.equal(slotTime('09:00', 3), '10:30');
});

test('shuffle conserva los elementos y no muta', () => {
  const src = [1, 2, 3, 4, 5, 6];
  const out = shuffle(src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...out].sort(), src);
});

test('roundsWithBye: descanso con equipos impares', () => {
  const rounds = roundsWithBye(['a', 'b', 'c']);
  assert.equal(rounds.length, 3);
  assert.deepEqual(rounds.map((r) => r.bye).sort(), ['a', 'b', 'c']);
  assert.ok(roundsWithBye(['a', 'b', 'c', 'd']).every((r) => r.bye === null));
});

test('normalize migra datos antiguos (descarta pool) y tolera datos inválidos', () => {
  const s = normalize({ teams: [{ id: 'a', name: 'A / B' }], pool: ['x'], courts: 3 });
  assert.equal(s.pool, undefined);
  assert.equal(s.courts, 3);
  assert.equal(s.startTime, '09:00');
  assert.deepEqual(s.roundResults, {});
  assert.deepEqual(normalize(null).teams, []);
});
