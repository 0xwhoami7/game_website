const app = document.querySelector("#app");
const cfg = window.COMMON_GROUND_CONFIG || {};
const hasSupabase = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
const sb = hasSupabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
const channel = "BroadcastChannel" in window ? new BroadcastChannel("common-ground") : null;

const state = {
  room: null,
  participants: [],
  responses: [],
  role: null,
  person: null,
  timer: null,
  subscription: null,
  demo: false
};

const icons = {
  arrow: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  plus: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>`,
  users: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  play: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m7 4 13 8-13 8V4Z"/></svg>`,
  copy: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m5 12 4 4L19 6"/></svg>`,
  chart: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18M7 16l4-5 4 3 5-7"/></svg>`,
  qr: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 20h2"/></svg>`,
  lock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
  eye: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  next: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 18 6-6-6-6"/></svg>`
};

const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const esc = (value = "") => String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
const roomKey = code => `cg_room_${code}`;
const personKey = code => `cg_person_${code}`;
const hostKey = code => `cg_host_${code}`;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const avg = values => values.length ? values.reduce((a, b) => a + Number(b), 0) / values.length : 0;
const joinUrl = code => `${location.origin}${location.pathname}?join=${code}`;
const initials = name => name.split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
const fmt = n => Number(n).toFixed(1).replace(".0", "");

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.querySelector("#toast-region").appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function header(compact = false) {
  return `<header class="container topbar">
    <a class="brand" href="${location.pathname}" data-link><span class="brand-mark"></span><span>Common Ground</span></a>
    <div class="top-actions">
      <span class="status-pill"><i class="dot"></i>${hasSupabase ? "Realtime connected" : "Demo mode"}</span>
      ${compact ? `<button class="btn btn-ghost btn-small" data-action="leave">Leave room</button>` : `<button class="btn btn-ghost btn-small desktop-only" data-action="how">How it works</button><button class="btn btn-secondary btn-small" data-action="join-open">Join a game</button>`}
    </div>
  </header>`;
}

function navigate(query = "") {
  history.pushState({}, "", `${location.pathname}${query}`);
  route();
}

function landing() {
  cleanup();
  const bars = [21, 30, 47, 71, 94, 68, 51, 38, 25, 16, 10, 6].map(v => `<i style="height:${v}%"></i>`).join("");
  app.innerHTML = `<div class="shell">${header()}
    <main class="container">
      <section class="hero">
        <div>
          <div class="eyebrow">The Keynesian beauty contest</div>
          <h1>Think like<br><em>the crowd.</em></h1>
          <p class="hero-copy">Everyone picks a number. The winner gets closest to two-thirds of the group average. Simple rules, surprisingly deep strategy—and a room full of second-guessing.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-action="create-open">Create a workshop ${icons.arrow}</button>
            <button class="btn btn-secondary" data-action="join-open">Join with a code</button>
            <button class="btn btn-ghost" data-action="demo">View demo</button>
          </div>
          <div class="micro-copy">${icons.lock} No accounts for participants · Free to host</div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="orbit"></div>
          <div class="game-preview">
            <div class="preview-head"><span class="eyebrow">Round 3 result</span><span class="pill">32 players</span></div>
            <div class="preview-number">31.8</div>
            <div class="preview-label">group average · target was <strong>21.2</strong></div>
            <div class="mini-distribution">${bars}</div>
          </div>
          <div class="float-note"><span>Closest choice</span><strong>21</strong><span>Maya takes the round ✦</span></div>
        </div>
      </section>
      <section class="feature-strip" id="how">
        <article class="feature"><span class="feature-no">01 / INVITE</span><h3>One scan. Everyone's in.</h3><p>Put the QR code on the workshop screen. Participants join instantly—no sign-up needed.</p></article>
        <article class="feature"><span class="feature-no">02 / PLAY</span><h3>You run the room.</h3><p>Choose the range, number of rounds and pace. Reveal results only when you're ready.</p></article>
        <article class="feature"><span class="feature-no">03 / DISCUSS</span><h3>Make thinking visible.</h3><p>Watch the average evolve and explore the full distribution of choices after every round.</p></article>
      </section>
      <footer class="footer-note"><span>Made for classrooms, workshops & curious groups.</span><span>Inspired by John Maynard Keynes · Built for modern browsers.</span></footer>
    </main>
  </div>`;
}

function modal(type, preset = {}) {
  const isJoin = type === "join";
  const content = isJoin ? `
    <div class="modal-head"><div><div class="eyebrow">Participant</div><h2>Join the room</h2></div><button class="modal-close" data-action="modal-close">×</button></div>
    <form id="join-form">
      <div class="form-group"><label for="join-code">6-character room code</label><input class="input input-code" id="join-code" maxlength="6" autocomplete="off" value="${esc(preset.code || "")}" placeholder="ABC123" required></div>
      <div class="form-group"><label for="join-name">What should we call you?</label><input class="input" id="join-name" maxlength="32" autocomplete="name" placeholder="Your name" required></div>
      <button class="btn btn-primary btn-wide" type="submit">Enter the room ${icons.arrow}</button>
    </form>` : `
    <div class="modal-head"><div><div class="eyebrow">Facilitator setup</div><h2>Create a workshop</h2></div><button class="modal-close" data-action="modal-close">×</button></div>
    <div class="rule-box"><strong>The rule:</strong> Everyone chooses a number. The winner is closest to <span id="rule-factor">⅔</span> of the group's average.</div>
    <form id="create-form">
      <div class="form-group"><label for="host-name">Workshop or facilitator name</label><input class="input" id="host-name" maxlength="48" value="Keynesian Game" required></div>
      <div class="input-row">
        <div class="form-group"><label for="rounds">Number of rounds</label><select class="select" id="rounds"><option>3</option><option selected>5</option><option>7</option><option>10</option></select></div>
        <div class="form-group"><label for="range-max">Number range</label><select class="select" id="range-max"><option value="50">0–50</option><option value="100" selected>0–100</option><option value="1000">0–1,000</option></select></div>
      </div>
      <div class="form-group"><label>Target multiplier</label><div class="segmented" id="factor"><button type="button" data-value="0.5">½ avg.</button><button type="button" class="active" data-value="0.6666667">⅔ avg.</button><button type="button" data-value="0.8">⅘ avg.</button></div></div>
      <div class="form-group"><label>Time per round</label><div class="segmented" id="duration"><button type="button" data-value="30">30 sec</button><button type="button" class="active" data-value="60">60 sec</button><button type="button" data-value="0">No timer</button></div></div>
      <button class="btn btn-primary btn-wide" type="submit">Create room ${icons.arrow}</button>
      <p class="helper">You'll get a QR code and private facilitator controls on the next screen.</p>
    </form>`;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop"><div class="modal">${content}</div></div>`);
  document.querySelector(".modal input")?.focus();
}

async function createRoom(form) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const room = {
    id: uid(), code, host_token: uid(), host_name: form.querySelector("#host-name").value.trim(),
    status: "lobby", current_round: 0, rounds: Number(form.querySelector("#rounds").value),
    range_max: Number(form.querySelector("#range-max").value),
    target_factor: Number(form.querySelector("#factor .active").dataset.value),
    duration_sec: Number(form.querySelector("#duration .active").dataset.value),
    started_at: null, created_at: new Date().toISOString()
  };
  try {
    if (hasSupabase) {
      const { data, error } = await sb.from("rooms").insert(room).select().single();
      if (error) throw error;
      Object.assign(room, data);
    } else saveLocal(room, [], []);
    localStorage.setItem(hostKey(code), room.host_token);
    document.querySelector(".modal-backdrop")?.remove();
    navigate(`?host=${code}`);
  } catch (err) { toast(`Couldn't create room: ${err.message}`); }
}

async function joinRoom(form) {
  const code = form.querySelector("#join-code").value.trim().toUpperCase();
  const name = form.querySelector("#join-name").value.trim();
  if (!code || !name) return;
  try {
    const room = await fetchRoom(code);
    if (!room) throw new Error("That room doesn't exist yet");
    if (room.status === "finished") throw new Error("That game has already ended");
    let person = { id: uid(), room_id: room.id, name, token: uid(), joined_at: new Date().toISOString() };
    if (hasSupabase) {
      const { data, error } = await sb.from("participants").insert(person).select().single();
      if (error) throw error;
      person = data;
    } else {
      const bundle = getLocal(code);
      bundle.participants.push(person);
      saveLocal(bundle.room, bundle.participants, bundle.responses);
    }
    localStorage.setItem(personKey(code), JSON.stringify(person));
    document.querySelector(".modal-backdrop")?.remove();
    navigate(`?play=${code}`);
  } catch (err) { toast(err.message); }
}

function saveLocal(room, participants, responses) {
  localStorage.setItem(roomKey(room.code), JSON.stringify({ room, participants, responses }));
  channel?.postMessage({ code: room.code });
}

function getLocal(code) {
  try { return JSON.parse(localStorage.getItem(roomKey(code))) || { room: null, participants: [], responses: [] }; }
  catch { return { room: null, participants: [], responses: [] }; }
}

async function fetchRoom(code) {
  if (hasSupabase) {
    const { data, error } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
    if (error) throw error;
    return data;
  }
  return getLocal(code).room;
}

async function loadAll(code) {
  if (state.demo) return;
  if (hasSupabase) {
    const room = await fetchRoom(code);
    if (!room) return null;
    const [{ data: participants, error: pe }, { data: responses, error: re }] = await Promise.all([
      sb.from("participants").select("*").eq("room_id", room.id).order("joined_at"),
      sb.from("responses").select("*").eq("room_id", room.id).order("created_at")
    ]);
    if (pe || re) throw pe || re;
    Object.assign(state, { room, participants, responses });
  } else {
    const bundle = getLocal(code);
    Object.assign(state, bundle);
  }
  return state.room;
}

function cleanup() {
  clearInterval(state.timer);
  state.timer = null;
  if (state.subscription) sb?.removeChannel(state.subscription);
  state.subscription = null;
  if (channel) channel.onmessage = null;
  window.onstorage = null;
  state.demo = false;
}

function subscribe(code) {
  if (hasSupabase) {
    state.subscription = sb.channel(`room-${code}`).on("postgres_changes", { event: "*", schema: "public" }, async payload => {
      if ([state.room?.id, state.person?.id].includes(payload.new?.room_id) || payload.new?.id === state.room?.id || payload.old?.room_id === state.room?.id) {
        await loadAll(code); renderRole();
      }
    }).subscribe();
  } else {
    channel && (channel.onmessage = e => { if (e.data.code === code) { loadAll(code); renderRole(); } });
    window.onstorage = e => { if (e.key === roomKey(code)) { loadAll(code); renderRole(); } };
  }
}

async function hostPage(code) {
  cleanup();
  state.role = "host";
  try {
    if (!await loadAll(code)) return notFound("Room not found", "Create a fresh workshop from the home page.");
    if (!localStorage.getItem(hostKey(code)) && !state.demo) return notFound("Facilitator key missing", "Open the private host link on the device that created this room.");
    renderHost(); subscribe(code);
  } catch (e) { notFound("Could not load the room", e.message); }
}

async function playerPage(code) {
  cleanup();
  state.role = "player";
  try {
    if (!await loadAll(code)) { modal("join", { code }); landing(); return; }
    const stored = JSON.parse(localStorage.getItem(personKey(code)) || "null");
    if (!stored) { landing(); modal("join", { code }); return; }
    state.person = stored;
    renderPlayer(); subscribe(code);
  } catch (e) { notFound("Could not join the room", e.message); }
}

function renderRole() { state.role === "host" ? renderHost() : renderPlayer(); }

function roomProgress() {
  return Array.from({ length: state.room.rounds }, (_, i) => `<i class="${i + 1 < state.room.current_round ? "done" : i + 1 === state.room.current_round ? "current" : ""}"></i>`).join("");
}

function renderHost() {
  const r = state.room;
  if (!r) return;
  app.innerHTML = `<div class="shell">${header(true)}<main class="container page">
    <div class="room-banner"><div><div class="eyebrow" style="color:var(--lime-2)">Workshop room</div><div class="room-code">${r.code}</div></div><div class="room-meta"><span class="pill">${icons.users} ${state.participants.length} joined</span><span class="pill">${r.rounds} rounds</span><span class="pill">0–${r.range_max}</span></div></div>
    ${r.status === "lobby" ? hostLobby() : r.status === "answering" ? hostAnswering() : hostResults()}
  </main></div>`;
  if (r.status === "lobby") makeQr();
  if (r.status === "answering") startTimer();
}

function hostLobby() {
  const r = state.room;
  return `<div class="grid grid-sidebar">
    <section class="card"><div class="card-title"><div><h2>People in the room</h2><span class="subtle">They'll appear here as they join.</span></div><span class="pill">${state.participants.length} ready</span></div>${participantList()}</section>
    <aside class="grid">
      <section class="card card-dark"><div class="card-title"><div><h3>Scan to join</h3><span class="subtle">Point any phone camera here</span></div>${icons.qr}</div><div class="qr-box" id="qr"></div><div class="join-link"><code>${joinUrl(r.code)}</code><button data-action="copy-link">Copy</button></div></section>
      <section class="card"><div class="card-title"><h3>Game setup</h3><button class="btn btn-ghost btn-small" data-action="settings">Edit</button></div><div class="choice-chips"><span class="choice-chip">${r.rounds} rounds</span><span class="choice-chip">0–${r.range_max}</span><span class="choice-chip">target ${factorLabel(r.target_factor)}</span><span class="choice-chip">${r.duration_sec ? `${r.duration_sec}s timer` : "no timer"}</span></div></section>
      <button class="btn btn-primary btn-wide" data-action="start" ${state.participants.length < 1 && !state.demo ? "disabled" : ""}>${icons.play} Start round 1</button>
    </aside>
  </div>`;
}

function participantList() {
  if (!state.participants.length) return `<div class="empty-state"><div class="empty-icon">⌁</div><strong>No one here yet</strong><p>Ask the room to scan the QR code.</p></div>`;
  const current = responsesForRound(state.room.current_round);
  return `<div class="participant-list">${state.participants.map((p, i) => {
    const done = current.some(x => x.participant_id === p.id);
    return `<div class="participant"><span class="avatar" style="background:hsl(${(i * 47 + 70) % 360} 40% 88%)">${esc(initials(p.name))}</span><div class="participant-info"><div class="participant-name">${esc(p.name)}</div><div class="participant-status">${state.room.status === "lobby" ? "Ready to play" : done ? "Answer locked" : "Thinking…"}</div></div>${done ? `<span class="check">${icons.check}</span>` : ""}</div>`;
  }).join("")}</div>`;
}

function hostAnswering() {
  const current = responsesForRound(state.room.current_round);
  const pct = state.participants.length ? Math.round(current.length / state.participants.length * 100) : 0;
  return `<div class="grid grid-sidebar">
    <section class="card game-stage">
      <div class="round-top"><div><div class="eyebrow">Round ${state.room.current_round} of ${state.room.rounds}</div><div class="round-progress">${roomProgress()}</div></div><div class="timer" id="timer">${timerText()}</div></div>
      <div class="prompt-card"><span class="pill">Choices are hidden</span><h2>Pick a number from 0 to ${state.room.range_max}</h2><p>Closest to ${factorLabel(state.room.target_factor)} of the group average wins.</p></div>
      <div style="padding:30px 0"><div class="card-title"><div><h2>${current.length} of ${state.participants.length} submitted</h2><span class="subtle">Results stay private until you reveal them.</span></div><strong>${pct}%</strong></div><div style="height:10px;background:#dedfd6;border-radius:20px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--green);transition:.3s"></div></div></div>
      ${participantList()}
    </section>
    <aside class="grid" style="align-content:start">
      <section class="card"><div class="card-title"><h3>Facilitator controls</h3><span class="pill">Live</span></div><div class="control-stack"><button class="control-button" data-action="reveal" ${current.length === 0 ? "disabled" : ""}><span class="control-icon">${icons.eye}</span><span><strong>Reveal results</strong><span>Close voting and show the choices</span></span></button><button class="control-button" data-action="copy-link"><span class="control-icon">${icons.copy}</span><span><strong>Copy join link</strong><span>Invite anyone who is missing</span></span></button></div></section>
      <section class="card"><div class="stat-label">Round rule</div><div class="stat-value">${factorLabel(state.room.target_factor)}</div><div class="subtle">of the group average · range 0–${state.room.range_max}</div></section>
    </aside>
  </div>`;
}

function responsesForRound(round) { return state.responses.filter(x => Number(x.round) === Number(round)); }

function roundStats(round) {
  const answers = responsesForRound(round);
  const values = answers.map(x => Number(x.value));
  const average = avg(values);
  const target = average * state.room.target_factor;
  const ordered = answers.map(a => ({ ...a, person: state.participants.find(p => p.id === a.participant_id), gap: Math.abs(Number(a.value) - target) })).sort((a,b) => a.gap - b.gap);
  return { answers, values, average, target, winner: ordered[0] };
}

function hostResults() {
  const r = state.room;
  const current = roundStats(r.current_round);
  const isFinal = r.status === "finished" || r.current_round >= r.rounds;
  return `<div class="page-head"><div><div class="eyebrow">${isFinal ? "Workshop complete" : `Round ${r.current_round} results`}</div><h1>${isFinal ? "How the room thought." : "The crowd has spoken."}</h1></div><button class="btn btn-primary" data-action="${isFinal ? "new-game" : "next"}">${isFinal ? "New game" : `Start round ${r.current_round + 1}`} ${icons.next}</button></div>
    <div class="stats"><div class="stat"><div class="stat-label">Group average</div><div class="stat-value">${fmt(current.average)}</div><div class="stat-delta">round ${r.current_round}</div></div><div class="stat"><div class="stat-label">Winning target</div><div class="stat-value">${fmt(current.target)}</div><div class="stat-delta">${factorLabel(r.target_factor)} × average</div></div><div class="stat"><div class="stat-label">Responses</div><div class="stat-value">${current.values.length}</div><div class="stat-delta">of ${state.participants.length} players</div></div><div class="stat"><div class="stat-label">Spread</div><div class="stat-value">${current.values.length ? fmt(Math.max(...current.values) - Math.min(...current.values)) : "—"}</div><div class="stat-delta">highest − lowest</div></div></div>
    <div class="grid grid-2">
      <section class="card"><div class="card-title"><div><h2>Average by round</h2><span class="subtle">Watch the group's choices converge.</span></div><span class="pill">${icons.chart} trend</span></div><div class="chart-wrap">${lineChart()}</div></section>
      <section class="card"><div class="card-title"><div><h2>Choice distribution</h2><span class="subtle">Round ${r.current_round} · hover to inspect</span></div><span class="pill">0–${r.range_max}</span></div>${histogram(current.values)}</section>
      <section class="card winner">${current.winner ? `<div class="eyebrow">Closest to ${fmt(current.target)}</div><div class="winner-name">${esc(current.winner.person?.name || "Anonymous")}</div><div>chose <strong>${fmt(current.winner.value)}</strong> · ${fmt(current.winner.gap)} away from target</div>` : `<div class="winner-name">No winner yet</div>`}</section>
      <section class="card"><div class="card-title"><div><h3>What everyone chose</h3><span class="subtle">Answers are anonymous on the shared screen.</span></div></div><div class="choice-chips">${current.values.sort((a,b)=>a-b).map(v => `<span class="choice-chip">${fmt(v)}</span>`).join("") || `<span class="subtle">No answers this round.</span>`}</div></section>
    </div>`;
}

function lineChart() {
  const points = [];
  for (let round = 1; round <= state.room.current_round; round++) {
    const s = roundStats(round);
    if (s.values.length) points.push({ round, value: s.average, target: s.target });
  }
  if (!points.length) return `<div class="empty-state">The trend appears after round one.</div>`;
  const W = 640, H = 260, pad = 42, max = state.room.range_max;
  const x = i => points.length === 1 ? W / 2 : pad + i * (W - pad * 2) / (points.length - 1);
  const y = v => H - pad - (v / max) * (H - pad * 1.5);
  const path = key => points.map((p,i) => `${i ? "L" : "M"}${x(i)},${y(p[key])}`).join(" ");
  const grid = [0,.25,.5,.75,1].map(v => `<line x1="${pad}" x2="${W-pad}" y1="${y(max*v)}" y2="${y(max*v)}" stroke="#dddcd3"/><text class="chart-label" x="4" y="${y(max*v)+3}">${fmt(max*v)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average and target by round">${grid}<path d="${path("average")}" fill="none" stroke="#164f3b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="${path("target")}" fill="none" stroke="#ef7d4f" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round"/>${points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="6" fill="#f6f3ea" stroke="#164f3b" stroke-width="4"/><text class="chart-label" x="${x(i)}" y="245" text-anchor="middle">R${p.round}</text>`).join("")}<g transform="translate(${W-190},8)"><line x2="20" y1="5" y2="5" stroke="#164f3b" stroke-width="4"/><text class="chart-label" x="26" y="8">Average</text><line x1="90" x2="110" y1="5" y2="5" stroke="#ef7d4f" stroke-width="3" stroke-dasharray="5 4"/><text class="chart-label" x="116" y="8">Target</text></g></svg>`;
}

function histogram(values) {
  const bins = Array(10).fill(0);
  values.forEach(v => bins[Math.min(9, Math.floor(Number(v) / state.room.range_max * 10))]++);
  const peak = Math.max(...bins, 1);
  return `<div class="histogram">${bins.map((n,i) => `<div class="hist-bin" title="${n} choice${n === 1 ? "" : "s"} between ${fmt(i*state.room.range_max/10)} and ${fmt((i+1)*state.room.range_max/10)}"><span class="hist-count">${n || ""}</span><div class="hist-bar ${n === peak && n ? "hot" : ""}" style="height:${Math.max(3,n/peak*150)}px"></div><span class="hist-label">${fmt(i*state.room.range_max/10)}–${fmt((i+1)*state.room.range_max/10)}</span></div>`).join("")}</div>`;
}

function renderPlayer() {
  const r = state.room;
  const mine = responsesForRound(r.current_round).find(x => x.participant_id === state.person.id);
  app.innerHTML = `<div class="shell">${header(true)}<main class="container page" style="max-width:820px">
    <div class="room-banner"><div><div class="eyebrow" style="color:var(--lime-2)">${esc(r.host_name)}</div><div class="room-code">${r.code}</div></div><div class="room-meta"><span class="pill">${esc(state.person.name)}</span><span class="pill">${r.current_round ? `Round ${r.current_round}/${r.rounds}` : "Waiting room"}</span></div></div>
    ${r.status === "lobby" ? playerWaiting() : r.status === "answering" ? (mine ? playerSubmitted(mine) : playerChoose()) : playerResult()}
  </main></div>`;
  if (r.status === "answering") startTimer();
}

function playerWaiting() {
  return `<section class="card waiting"><div class="waiting-orbit"></div><div class="eyebrow">You're in</div><h1>Waiting for the facilitator</h1><p class="subtle">${state.participants.length} ${state.participants.length === 1 ? "person is" : "people are"} in the room. Keep this tab open—the first round will appear automatically.</p></section>`;
}

function playerChoose() {
  const r = state.room;
  const initial = Math.round(r.range_max / 2);
  return `<section class="card game-stage"><div class="round-top"><div><div class="eyebrow">Round ${r.current_round} of ${r.rounds}</div><div class="round-progress">${roomProgress()}</div></div><div class="timer" id="timer">${timerText()}</div></div><div class="prompt-card"><h2>Choose a number from 0 to ${r.range_max}</h2><p>Try to get closest to ${factorLabel(r.target_factor)} of the group's average.</p></div><form id="answer-form" class="answer-panel"><div class="big-value" id="choice-value">${initial}</div><input class="big-range" id="choice" type="range" min="0" max="${r.range_max}" step="${r.range_max > 100 ? 1 : .1}" value="${initial}"><div class="range-labels"><span>0</span><span>${r.range_max}</span></div><button class="btn btn-primary btn-wide" style="margin-top:30px" type="submit">Lock in <span id="lock-value">${initial}</span> ${icons.arrow}</button></form></section>`;
}

function playerSubmitted(mine) {
  return `<section class="card submitted"><div class="submitted-mark">${icons.check}</div><div class="eyebrow">Answer locked</div><h2>You chose ${fmt(mine.value)}</h2><p class="subtle">Waiting for everyone else. The facilitator will reveal the results soon.</p><div class="choice-chip" style="display:inline-block;margin-top:18px">${responsesForRound(state.room.current_round).length} of ${state.participants.length} submitted</div></section>`;
}

function playerResult() {
  const s = roundStats(state.room.current_round);
  const mine = s.answers.find(x => x.participant_id === state.person.id);
  const won = s.winner?.participant_id === state.person.id;
  return `<div class="grid"><section class="card ${won ? "winner" : ""}" style="text-align:center;padding:42px"><div class="eyebrow">Round ${state.room.current_round} result</div><div class="big-value">${fmt(s.target)}</div><p class="subtle">winning target · ${factorLabel(state.room.target_factor)} of ${fmt(s.average)} average</p>${mine ? `<h2 style="margin-top:25px">${won ? "You won this round! ✦" : `Your choice: ${fmt(mine.value)}`}</h2>` : `<h2>You sat this round out</h2>`}</section><section class="card"><div class="card-title"><div><h2>How the room chose</h2><span class="subtle">The next round starts when your facilitator is ready.</span></div></div>${histogram(s.values)}</section></div>`;
}

function timerText() {
  const r = state.room;
  if (!r.duration_sec) return "No timer";
  if (!r.started_at) return `${r.duration_sec}s`;
  return `${Math.max(0, r.duration_sec - Math.floor((Date.now() - new Date(r.started_at).getTime()) / 1000))}s`;
}

function startTimer() {
  clearInterval(state.timer);
  const el = document.querySelector("#timer");
  if (!el || !state.room.duration_sec) return;
  const tick = () => {
    const remaining = Math.max(0, state.room.duration_sec - Math.floor((Date.now() - new Date(state.room.started_at).getTime()) / 1000));
    el.textContent = `${remaining}s`;
    if (remaining <= 0) clearInterval(state.timer);
  };
  tick(); state.timer = setInterval(tick, 1000);
}

async function patchRoom(patch) {
  const previous = { ...state.room };
  Object.assign(state.room, patch);
  try {
    if (state.demo) {
      renderRole();
      return;
    } else if (hasSupabase) {
      const token = localStorage.getItem(hostKey(state.room.code));
      const { error } = await sb.rpc("host_update_room", {
        p_room_id: state.room.id,
        p_host_token: token,
        p_status: state.room.status,
        p_current_round: state.room.current_round,
        p_started_at: state.room.started_at
      });
      if (error) throw error;
    } else saveLocal(state.room, state.participants, state.responses);
    renderRole();
  } catch (error) {
    state.room = previous;
    toast(`Couldn't update the game: ${error.message}`);
  }
}

async function submitAnswer(value) {
  const answer = { id: uid(), room_id: state.room.id, participant_id: state.person.id, round: state.room.current_round, value: Number(value), created_at: new Date().toISOString() };
  try {
    if (hasSupabase) {
      const { data, error } = await sb.from("responses").insert(answer).select().single();
      if (error) throw error;
      state.responses.push(data);
    } else { state.responses.push(answer); saveLocal(state.room, state.participants, state.responses); }
    renderPlayer();
  } catch (e) { toast(`Couldn't submit: ${e.message}`); }
}

function factorLabel(f) {
  if (Math.abs(f - .5) < .01) return "½";
  if (Math.abs(f - .8) < .01) return "⅘";
  return "⅔";
}

function makeQr() {
  const el = document.querySelector("#qr");
  if (!el) return;
  if (window.QRCode) new QRCode(el, { text: joinUrl(state.room.code), width: 190, height: 190, colorDark: "#163d2e", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
  else el.innerHTML = `<div style="text-align:center;color:#182219"><strong>QR unavailable</strong><br><small>Share code ${state.room.code}</small></div>`;
}

function notFound(title, message) {
  cleanup();
  app.innerHTML = `<div class="shell">${header()}<main class="container page"><section class="card waiting"><div class="empty-icon">?</div><h1>${esc(title)}</h1><p class="subtle">${esc(message)}</p><a class="btn btn-primary" href="${location.pathname}" data-link>Back home</a></section></main></div>`;
}

function demoRoom() {
  const room = { id:"demo-room", code:"THINK2", host_token:"demo", host_name:"Economics Lab", status:"results", current_round:3, rounds:5, range_max:100, target_factor:2/3, duration_sec:60, started_at:null };
  const names = ["Maya","Noah","Zoya","Aarav","Sofia","Leo","Ananya","Omar","Ishaan","Mina","Theo","Nia","Kabir","Sara","Dev","Lina","Aditi","Ravi","Elena","Sam"];
  const participants = names.map((name,i)=>({id:`p${i}`,room_id:room.id,name}));
  const rounds = [[72,64,50,58,41,65,69,44,55,61,38,73,49,57,62,46,53,68,42,59],[44,37,32,41,28,35,48,31,39,42,25,46,34,38,40,29,36,43,27,33],[21,24,19,28,31,22,17,26,29,20,33,25,18,27,23,30,16,24,22,28]];
  const responses = rounds.flatMap((values, ri)=>values.map((value,i)=>({id:`a${ri}-${i}`,room_id:room.id,participant_id:`p${i}`,round:ri+1,value,created_at:new Date().toISOString()})));
  Object.assign(state,{room,participants,responses,role:"host",demo:true});
  localStorage.setItem(hostKey(room.code),"demo");
  if (!new URLSearchParams(location.search).has("demo")) history.pushState({},"",`${location.pathname}?demo=1`);
  renderHost();
}

document.addEventListener("click", async e => {
  const link = e.target.closest("[data-link]");
  if (link) { e.preventDefault(); navigate(""); return; }
  const btn = e.target.closest("[data-action]");
  const segmentChoice = e.target.closest(".segmented button[data-value]");
  if (segmentChoice) {
    const segment = segmentChoice.closest(".segmented");
    segment.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    segmentChoice.classList.add("active");
    const factor = document.querySelector("#factor .active")?.dataset.value;
    if (factor && document.querySelector("#rule-factor")) document.querySelector("#rule-factor").textContent = factorLabel(Number(factor));
    return;
  }
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "create-open") modal("create");
  if (action === "join-open") modal("join");
  if (action === "modal-close") btn.closest(".modal-backdrop")?.remove();
  if (action === "how") document.querySelector("#how")?.scrollIntoView();
  if (action === "demo") demoRoom();
  if (action === "copy-link") { await navigator.clipboard.writeText(joinUrl(state.room.code)); toast("Join link copied"); }
  if (action === "start" || action === "next") await patchRoom({ status:"answering", current_round: action === "start" ? 1 : state.room.current_round + 1, started_at:new Date().toISOString() });
  if (action === "reveal") await patchRoom({ status: state.room.current_round >= state.room.rounds ? "finished" : "results" });
  if (action === "new-game") navigate("");
  if (action === "leave") navigate("");
  if (action === "settings") toast("Settings lock once the room is created—start when you're ready.");
});

document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "create-form") createRoom(e.target);
  if (e.target.id === "join-form") joinRoom(e.target);
  if (e.target.id === "answer-form") submitAnswer(e.target.querySelector("#choice").value);
});

document.addEventListener("input", e => {
  if (e.target.id === "join-code") e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (e.target.id === "choice") { document.querySelector("#choice-value").textContent = fmt(e.target.value); document.querySelector("#lock-value").textContent = fmt(e.target.value); }
});

document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelector(".modal-backdrop")?.remove(); });
window.addEventListener("popstate", route);

function route() {
  const p = new URLSearchParams(location.search);
  if (p.get("host")) hostPage(p.get("host").toUpperCase());
  else if (p.get("play")) playerPage(p.get("play").toUpperCase());
  else if (p.get("join")) { landing(); modal("join", { code:p.get("join").toUpperCase() }); }
  else if (p.get("demo")) demoRoom();
  else landing();
}

route();
