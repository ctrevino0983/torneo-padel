import { useEffect, useMemo, useState } from 'react';
import {
  buildGroupMatches, buildPlayoffs, computeStandings, groupComplete,
  isValidResult, podium, slotTime, winnerOf,
} from './logic/tournament.js';

const KEY = 'torneo-padel:v1';
const INITIAL = {
  teams: [], courts: 2, startTime: '09:00',
  matches: null, results: {}, seeds: null,
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && Array.isArray(s.teams) ? { ...INITIAL, ...s } : INITIAL;
  } catch {
    return INITIAL;
  }
}

const uid = () => Math.random().toString(36).slice(2, 9);

export default function App() {
  const [state, setState] = useState(load);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('equipos');

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const { teams, matches, results, seeds } = state;
  const teamName = (id) => teams.find((t) => t.id === id)?.name ?? 'Por definir';
  const started = !!matches;
  const groupSlots = matches ? Math.max(0, ...matches.map((m) => m.slot)) + 1 : 0;
  const standings = useMemo(
    () => (matches ? computeStandings(teams, matches, results) : []),
    [teams, matches, results],
  );
  const playoffs = useMemo(
    () => (seeds ? buildPlayoffs(seeds, results, groupSlots, state.courts) : []),
    [seeds, results, groupSlots, state.courts],
  );
  const result = seeds ? podium(playoffs, results) : null;
  const done = groupComplete(matches ?? [], results);

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  const addTeam = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || started) return;
    if (teams.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
      alert('Ya existe un equipo con ese nombre.');
      return;
    }
    set({ teams: [...teams, { id: uid(), name: n }] });
    setName('');
  };
  const rename = (id, n) => {
    n = n.trim();
    if (n) set({ teams: teams.map((t) => (t.id === id ? { ...t, name: n } : t)) });
    setEditing(null);
  };
  const remove = (id) => !started && set({ teams: teams.filter((t) => t.id !== id) });

  const generate = () => {
    if (teams.length < 3) return;
    set({
      matches: buildGroupMatches(teams.map((t) => t.id), state.courts),
      results: {}, seeds: null,
    });
    setTab('calendario');
  };
  const reset = (all) => {
    if (!confirm(all ? '¿Borrar todo el torneo?' : '¿Reiniciar el calendario y los resultados?')) return;
    setState(all ? INITIAL : { ...state, matches: null, results: {}, seeds: null });
    setTab('equipos');
  };
  const startPlayoffs = () => {
    const top = standings.slice(0, Math.min(4, standings.length)).map((s) => s.id);
    set({ seeds: top });
    setTab('finales');
  };
  const setResult = (id, r) => {
    const next = { ...results };
    if (r) next[id] = r; else delete next[id];
    if (id.startsWith('S')) { delete next.F; delete next.T; }
    set({ results: next });
  };
  // Al cambiar un resultado de grupo se invalida la fase final.
  const setGroupResult = (id, r) => {
    const next = { ...results };
    if (r) next[id] = r; else delete next[id];
    set({ results: Object.fromEntries(Object.entries(next).filter(([k]) => k.startsWith('G'))), seeds: null });
  };

  const tabs = [['equipos', 'Equipos'], ['calendario', 'Calendario'], ['posiciones', 'Posiciones'], ['finales', 'Finales']];

  return (
    <div className="app">
      <header>
        <h1>🎾 Torneo de Pádel</h1>
        <nav>
          {tabs.map(([k, l]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'equipos' && (
          <section>
            <h2>Equipos ({teams.length})</h2>
            <form className="row" onSubmit={addTeam}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del equipo" disabled={started} aria-label="Nombre del equipo" />
              <button disabled={started || !name.trim()}>Agregar</button>
            </form>
            {started && <p className="note">El calendario ya fue generado. Solo puedes renombrar equipos; reinicia para agregar o quitar.</p>}
            <ul className="list">
              {teams.map((t) => (
                <li key={t.id}>
                  {editing === t.id ? (
                    <form className="row" onSubmit={(e) => { e.preventDefault(); rename(t.id, e.target.elements.n.value); }}>
                      <input name="n" defaultValue={t.name} autoFocus />
                      <button>Guardar</button>
                      <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancelar</button>
                    </form>
                  ) : (
                    <>
                      <span>{t.name}</span>
                      <span>
                        <button className="ghost" onClick={() => setEditing(t.id)}>Editar</button>
                        <button className="ghost danger" disabled={started} onClick={() => remove(t.id)}>Quitar</button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <h3>Configuración</h3>
            <div className="row">
              <label>Canchas
                <input type="number" min="1" max="20" value={state.courts} disabled={started}
                  onChange={(e) => set({ courts: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })} />
              </label>
              <label>Hora de inicio
                <input type="time" value={state.startTime} onChange={(e) => set({ startTime: e.target.value })} />
              </label>
            </div>
            <p className="note">Cada partido dura 30 minutos. Con número impar de equipos habrá descansos.</p>
            <div className="row">
              <button onClick={generate} disabled={teams.length < 3 || started}>Generar calendario Round Robin</button>
              {started && <button className="ghost" onClick={() => reset(false)}>Reiniciar calendario</button>}
              <button className="ghost danger" onClick={() => reset(true)}>Borrar torneo</button>
            </div>
            {teams.length < 3 && <p className="note">Agrega al menos 3 equipos.</p>}
          </section>
        )}

        {tab === 'calendario' && (
          <section>
            <h2>Calendario</h2>
            {!started ? <p className="note">Aún no se ha generado el calendario.</p> : (
              <MatchList matches={matches} results={results} teamName={teamName} startTime={state.startTime} onChange={setGroupResult} showRound />
            )}
          </section>
        )}

        {tab === 'posiciones' && (
          <section>
            <h2>Tabla de posiciones</h2>
            {!started ? <p className="note">Genera el calendario primero.</p> : (
              <div className="scroll">
                <table>
                  <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>DS</th><th>DJ</th><th>Pts</th></tr></thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.id} className={i < 4 ? 'top' : ''}>
                        <td>{i + 1}</td><td>{s.name}</td><td>{s.pj}</td><td>{s.pg}</td><td>{s.pp}</td><td>{s.ds}</td><td>{s.dg}</td><td><b>{s.pts}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="note">3 puntos por victoria. Desempate: diferencia de sets (DS), luego de juegos (DJ). Clasifican los 4 primeros.</p>
          </section>
        )}

        {tab === 'finales' && (
          <section>
            <h2>Fase final</h2>
            {!started && <p className="note">Genera el calendario primero.</p>}
            {started && !seeds && (
              <>
                <p className="note">{done ? 'Fase de grupos completa.' : 'Registra todos los resultados de grupos para iniciar la fase final.'}</p>
                <button disabled={!done} onClick={startPlayoffs}>Generar fase final</button>
              </>
            )}
            {seeds && (
              <>
                {result && (
                  <div className="podium">
                    🏆 Campeón: <b>{teamName(result.first)}</b> · 🥈 {teamName(result.second)}
                    {result.third && <> · 🥉 {teamName(result.third)}</>}
                  </div>
                )}
                <div className="bracket">
                  {['semi', 'final', 'third'].map((st) => (
                    <div key={st} className="col">
                      <h3>{{ semi: 'Semifinales', final: 'Final', third: 'Tercer lugar' }[st]}</h3>
                      <MatchList matches={playoffs.filter((m) => m.stage === st)} results={results} teamName={teamName} startTime={state.startTime} onChange={setResult} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function MatchList({ matches, results, teamName, startTime, onChange, showRound }) {
  const slots = [...new Set(matches.map((m) => m.slot))].sort((a, b) => a - b);
  return (
    <div>
      {slots.map((slot) => (
        <div key={slot} className="slot">
          <div className="time">{slotTime(startTime, slot)}</div>
          {matches.filter((m) => m.slot === slot).map((m) => (
            <MatchCard key={m.id} m={m} r={results[m.id]} teamName={teamName} onChange={onChange} showRound={showRound} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MatchCard({ m, r, teamName, onChange, showRound }) {
  const ready = m.a && m.b;
  const [draft, setDraft] = useState({ sa: r?.sa ?? '', sb: r?.sb ?? '', ga: r?.ga ?? '', gb: r?.gb ?? '' });
  useEffect(() => {
    setDraft({ sa: r?.sa ?? '', sb: r?.sb ?? '', ga: r?.ga ?? '', gb: r?.gb ?? '' });
  }, [r]);
  const num = (v) => (v === '' ? NaN : parseInt(v, 10));
  const save = () => {
    const res = { sa: num(draft.sa), sb: num(draft.sb), ga: num(draft.ga) || 0, gb: num(draft.gb) || 0 };
    if (!isValidResult(res)) { alert('Ingresa sets distintos (en pádel no hay empates).'); return; }
    onChange(m.id, res);
  };
  const win = winnerOf(m, r ? { [m.id]: r } : {});
  const field = (k) => (
    <input type="number" min="0" inputMode="numeric" value={draft[k]} disabled={!ready}
      onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} aria-label={k} />
  );
  return (
    <div className={`match ${win ? 'done' : ''}`}>
      <div className="meta">{m.label ?? `Jornada ${m.round}`} · Cancha {m.court}</div>
      <div className="teams">
        <span className={win === m.a ? 'win' : ''}>{teamName(m.a)}</span>
        <span className="vs">vs</span>
        <span className={win === m.b ? 'win' : ''}>{teamName(m.b)}</span>
      </div>
      <div className="score">
        <span>Sets {field('sa')} - {field('sb')}</span>
        <span>Juegos {field('ga')} - {field('gb')}</span>
        <button disabled={!ready} onClick={save}>Guardar</button>
        {r && <button className="ghost" onClick={() => onChange(m.id, null)}>Borrar</button>}
      </div>
    </div>
  );
}
