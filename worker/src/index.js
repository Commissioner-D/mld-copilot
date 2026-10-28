// MLD-Copilot Worker: Trade-Abstimmungen, Liga-Umfragen, Kommentare.
import { evaluateTrade, evaluatePoll, TRADE_PARAMS } from "./evaluate.js";

const FLEA = "https://www.fleaflicker.com/api";
const UA = { "User-Agent": "mld-copilot/1.0" };
const now = () => Date.now();

// ---------- Helfer ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function cors(env, req) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Key",
    "Access-Control-Max-Age": "86400", "Vary": "Origin",
  };
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 18) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function body(req) {
  try { return await req.json(); } catch { throw new HttpError(400, "invalid_json"); }
}

const leagueId = env => Number(env.LEAGUE_ID);
const tradeHours = env => Number(env.TRADE_HOURS || 72);

async function flea(path) {
  const r = await fetch(`${FLEA}/${path}`, { headers: UA, cf: { cacheTtl: 0 } });
  if (!r.ok) throw new HttpError(502, `fleaflicker_${r.status}`);
  return r.json();
}

// ---------- Auth ----------
async function currentManager(env, req) {
  const h = req.headers.get("Authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!tok) return null;
  const m = await env.DB.prepare("SELECT * FROM managers WHERE token_hash = ? AND active = 1 AND league_id = ?")
    .bind(await sha256(tok), leagueId(env)).first();
  return m || null;
}

function requireAdmin(env, req) {
  if (!env.ADMIN_KEY) throw new HttpError(503, "admin_not_configured");
  if (!safeEqual(req.headers.get("X-Admin-Key") || "", env.ADMIN_KEY)) throw new HttpError(401, "unauthorized");
}

async function eligibleManagers(env) {
  const { results } = await env.DB.prepare("SELECT id, team_id, team_name, owner_name FROM managers WHERE active = 1 AND league_id = ?")
    .bind(leagueId(env)).all();
  return results;
}

// ---------- Trades ----------
function parseTrade(tr) {
  const sides = (tr.teams || []).map(x => ({
    team_id: x.team?.id, team_name: x.team?.name,
    players: (x.playersObtained || []).filter(p => p.proPlayer).map(p => ({
      fl_id: p.proPlayer.id, name: p.proPlayer.nameFull, pos: p.proPlayer.position, team: p.proPlayer.proTeamAbbreviation })),
    picks: (x.picksObtained || []).map(p => ({ season: p.season, round: p.slot?.round ?? null,
                                              orig: p.originalOwner?.name || null })),
  }));
  for (const s of sides) for (const p of s.picks) {
    const other = sides.find(o => o !== s);
    p.orig = p.orig || other?.team_name || null;          // urspruenglicher Besitzer (fuer die Pick-Tendenz)
    p.from = other && p.orig !== other.team_name ? p.orig : null;   // nur zeigen, wenn nicht vom Gegenueber
  }
  return sides;
}

// ---------- Liga-Kontext aus dem Radar (league.json): Spielerinfos und PfO-Draft-Slots ----------
async function leagueCtx(env, { refresh = false } = {}) {
  if (!env.LEAGUE_DATA_URL || String(env.LEAGUE_DATA_LEAGUE) !== String(leagueId(env))) return null;
  const row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'league_ctx'").first();
  let ctx = row ? JSON.parse(row.v) : null;
  if (!refresh && ctx && ctx.v === 2 && now() - ctx.fetched < 3600e3) return ctx;
  try {
    const r = await fetch(env.LEAGUE_DATA_URL + "?t=" + now(), { cf: { cacheTtl: 0 } });
    if (!r.ok) throw new Error("league_json_" + r.status);
    const d = await r.json();
    const players = {};
    for (const t of d.teams || []) for (const p of t.roster || []) {
      players[p.fl_id] = { name: p.name, age: p.age, draft: p.draft, rookie: p.rookie, pos_rank: p.pos_rank, pos: p.pos,
                           pts_avg: p.pts_avg, injury: p.injury, snap: p.snap_last, owner: t.name };
    }
    const teams = Object.fromEntries((d.teams || []).map(t => [t.name, { slot: t.draft_slot ?? null, pfo: t.pfo ?? null }]));
    ctx = { v: 2, fetched: now(), generated: d.generated_utc, season: d.season, teams, players };
    await env.DB.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('league_ctx', ?)").bind(JSON.stringify(ctx)).run();
  } catch (e) { console.error("league ctx", e); }
  return ctx;
}

function enrichPlayers(sides, ctx) {
  if (!ctx) return sides;
  let byName = null;
  for (const s of sides) for (const p of s.players) {
    let i = p.fl_id != null ? ctx.players[p.fl_id] : null;
    if (!i && p.fl_id == null) {                       // aeltere Eintraege ohne ID: ueber Name + Position
      byName = byName || Object.values(ctx.players).reduce((m, x) => ((m[x.name] = m[x.name] || []).push(x), m), {});
      const c = (byName[p.name] || []).filter(x => x.pos === p.pos);
      if (c.length === 1) i = c[0];
    }
    if (i && !p.info) p.info = { age: i.age, draft: i.draft, rookie: i.rookie, pos_rank: i.pos_rank,
                                 pts_avg: i.pts_avg, injury: i.injury, snap: i.snap, asof: ctx.generated };
  }
  return sides;
}

// Pick-Tendenz: nur fuer den naechsten Draft, aus der aktuellen PfO-Reihenfolge (niedrigster PfO = frueher Pick)
function pickOutlook(sides, ctx) {
  if (!ctx || !ctx.season) return sides;
  const next = ctx.season + 1;
  const n = Object.values(ctx.teams).filter(t => t.slot).length || 16;
  for (const s of sides) for (const p of s.picks) {
    const orig = p.orig || p.from || sides.find(o => o !== s)?.team_name;   // aeltere Eintraege ohne "orig"
    const slot = p.season === next ? ctx.teams[orig]?.slot : null;
    p.outlook = slot ? { slot, of: n, tier: slot <= Math.round(n / 3) ? "early" : slot > n - Math.round(n / 3) ? "late" : "mid" } : null;
  }
  return sides;
}

async function syncTrades(env, { importCompletedHours } = {}) {
  const L = leagueId(env);
  const found = [];
  const review = await flea(`FetchTrades?sport=NFL&league_id=${L}&filter=TRADES_UNDER_REVIEW`);
  found.push(...(review.trades || []));
  const done = await flea(`FetchTrades?sport=NFL&league_id=${L}&filter=TRADES_COMPLETED`);
  const cutoff = now() - (importCompletedHours ?? tradeHours(env)) * 3600e3;
  for (const tr of done.trades || []) {
    const t = Number(tr.approvedOn || tr.proposedOn || 0);
    if (t >= cutoff) found.push(tr);
  }
  let added = 0, updated = 0;
  const ctx = found.length ? await leagueCtx(env) : null;
  for (const tr of found) {
    // Trades in Pruefung kommen ohne Statusfeld
    if (!tr.status) tr.status = (review.trades || []).some(x => x.id === tr.id) ? "TRADE_STATUS_UNDER_REVIEW" : null;
    const sides = enrichPlayers(parseTrade(tr), ctx);
    if (sides.length !== 2) continue;              // Mehr-Team-Trades: vorerst nicht
    const existing = await env.DB.prepare("SELECT id, status FROM trades WHERE id = ?").bind(tr.id).first();
    if (existing) {
      if (existing.status !== tr.status) {
        await env.DB.prepare("UPDATE trades SET status = ? WHERE id = ?").bind(tr.status, tr.id).run(); updated++;
      }
      continue;
    }
    const opened = now();
    await env.DB.prepare(`INSERT INTO trades (id, league_id, status, description, sides, team_a, team_b, opened_at, closes_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(tr.id, L, tr.status ?? null, tr.description || null, JSON.stringify(sides), sides[0].team_id, sides[1].team_id,
            opened, opened + tradeHours(env) * 3600e3).run();
    added++;
  }
  await env.DB.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('last_trade_check', ?)").bind(String(now())).run();
  return { added, updated, seen: found.length };
}

async function tradeView(env, t, me, managers, { withComments = false, ctx = null } = {}) {
  const sides = pickOutlook(enrichPlayers(JSON.parse(t.sides), ctx), ctx);
  // Testmodus: Beteiligte werden wie alle anderen behandelt (nur fuer die Sandkiste)
  const participants = env.TEST_MODE === "1" ? [] : [t.team_a, t.team_b];
  const voters = managers.filter(m => !participants.includes(m.team_id));
  const { results: votes } = await env.DB.prepare("SELECT manager_id, value FROM trade_votes WHERE trade_id = ?").bind(t.id).all();
  const allVoted = voters.length > 0 && voters.every(m => votes.some(v => v.manager_id === m.id));
  let closed = !!t.closed_at || now() >= t.closes_at || allVoted;
  if (closed && !t.closed_at) {
    t.closed_at = Math.min(now(), t.closes_at);
    await env.DB.prepare("UPDATE trades SET closed_at = ? WHERE id = ?").bind(t.closed_at, t.id).run();
  }
  const isParticipant = !!me && participants.includes(me.team_id);
  const myVote = me ? votes.find(v => v.manager_id === me.id) : null;
  const canSee = !!me && (isParticipant || !!myVote || closed);
  const view = {
    id: t.id, status: t.status, description: t.description, sides,
    opened_at: t.opened_at, closes_at: t.closes_at, closed, closed_at: t.closed_at,
    eligible: voters.length, voted: votes.length,
    me: me ? { participant: isParticipant, vote: myVote ? myVote.value : null,
               can_vote: !isParticipant && !myVote && !closed } : null,
    results: null, comments: null,
  };
  if (canSee) {
    const byId = Object.fromEntries(managers.map(m => [m.id, m]));
    const abst = Math.max(0, voters.length - votes.length);
    view.results = {
      ...evaluateTrade(votes.map(v => v.value), abst),
      ballots: votes.map(v => ({ value: v.value, name: byId[v.manager_id]?.owner_name || byId[v.manager_id]?.team_name || "?",
                                 team: byId[v.manager_id]?.team_name || "?" })),
    };
    if (withComments) view.comments = await listComments(env, "trade", t.id, false, managers);
  }
  return view;
}

// ---------- Umfragen ----------
async function pollView(env, p, me, managers, { withComments = false } = {}) {
  const { results: ballots } = await env.DB.prepare("SELECT manager_id FROM poll_ballots WHERE poll_id = ?").bind(p.id).all();
  const { results: votes } = await env.DB.prepare("SELECT manager_id, choice FROM poll_votes WHERE poll_id = ?").bind(p.id).all();
  const res = evaluatePoll(p, votes, ballots.length, managers.length);
  const allVoted = managers.length > 0 && managers.every(m => ballots.some(b => b.manager_id === m.id));
  const hitYes = p.kind === "yesno" && p.end_yes && res.yes >= p.end_yes;
  const hitNo = p.kind === "yesno" && p.end_no && res.no >= p.end_no;
  let closed = !!p.closed_at || (p.closes_at && now() >= p.closes_at) || (p.end_all_voted && allVoted) || hitYes || hitNo;
  if (hitYes) res.outcome = "accepted";            // erforderliche Stimmenzahl erreicht: entschieden
  else if (hitNo) res.outcome = "rejected";
  if (closed && !p.closed_at) {
    p.closed_at = p.closes_at ? Math.min(now(), p.closes_at) : now();
    await env.DB.prepare("UPDATE polls SET closed_at = ? WHERE id = ?").bind(p.closed_at, p.id).run();
  }
  const voted = !!me && ballots.some(b => b.manager_id === me.id);
  const canSee = !!me && (p.visibility === "live" || closed || (p.visibility === "after_vote" && voted));
  const view = {
    id: p.id, title: p.title, body: p.body, kind: p.kind, options: JSON.parse(p.options || "null"),
    anonymous: !!p.anonymous, visibility: p.visibility, threshold: p.threshold, quorum: p.quorum,
    end_all_voted: !!p.end_all_voted, end_yes: p.end_yes, end_no: p.end_no, trade_id: p.trade_id,
    opened_at: p.opened_at, closes_at: p.closes_at, closed, closed_at: p.closed_at,
    eligible: managers.length, voted_count: ballots.length,
    me: me ? { voted, can_vote: !voted && !closed, can_comment: voted || closed || p.visibility === "live" } : null,
    results: null, comments: null,
  };
  if (canSee) {
    view.results = res;
    if (!p.anonymous) {
      const byId = Object.fromEntries(managers.map(m => [m.id, m]));
      view.results.voters = votes.map(v => ({ choice: JSON.parse(v.choice),
        name: byId[v.manager_id]?.owner_name || byId[v.manager_id]?.team_name || "?" }));
    }
  }
  if (withComments && view.me?.can_comment) view.comments = await listComments(env, "poll", p.id, !!p.anonymous, managers);
  return view;
}

// ---------- Kommentare ----------
async function listComments(env, target, id, anonymous, managers) {
  const { results } = await env.DB.prepare(
    "SELECT id, manager_id, body, created_at FROM comments WHERE target = ? AND target_id = ? AND deleted = 0 ORDER BY created_at")
    .bind(target, id).all();
  const byId = Object.fromEntries(managers.map(m => [m.id, m]));
  return results.map(c => ({ id: c.id, body: c.body, created_at: c.created_at,
    name: anonymous || !c.manager_id ? null : byId[c.manager_id]?.owner_name || byId[c.manager_id]?.team_name || "?" }));
}

// ---------- Routen ----------
async function route(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const M = req.method;
  const L = leagueId(env);
  let m;

  if (path === "/api/health") {
    let fleaflicker = null;
    if (url.searchParams.get("deep") === "1") {
      try {
        const d = await flea(`FetchLeagueStandings?sport=NFL&league_id=${L}`);
        const rv = await flea(`FetchTrades?sport=NFL&league_id=${L}&filter=TRADES_UNDER_REVIEW`);
        fleaflicker = { ok: true, league: d.league?.name,
          under_review: (rv.trades || []).map(x => ({ id: x.id, status: x.status, description: x.description })) };
      }
      catch (e) { fleaflicker = { ok: false, error: e.message }; }
    }
    const last = await env.DB.prepare("SELECT v FROM meta WHERE k = 'last_trade_check'").first();
    const lastErr = await env.DB.prepare("SELECT v FROM meta WHERE k = 'last_trade_error'").first();
    return json({ ok: true, league_id: L, admin: !!env.ADMIN_KEY, test_mode: env.TEST_MODE === "1", last_trade_check: last ? Number(last.v) : null,
                  last_trade_error: lastErr ? lastErr.v : null,
                  params: TRADE_PARAMS, fleaflicker });
  }

  const me = await currentManager(env, req);
  const managers = await eligibleManagers(env);

  if (path === "/api/me" && M === "GET")
    return json(me ? { team_id: me.team_id, team_name: me.team_name, owner_name: me.owner_name } : null);

  if (path === "/api/trades" && M === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM trades WHERE league_id = ? AND hidden = 0 ORDER BY opened_at DESC LIMIT 50").bind(L).all();
    const ctx = await leagueCtx(env);
    return json(await Promise.all(results.map(t => tradeView(env, t, me, managers, { ctx }))));
  }
  if ((m = path.match(/^\/api\/trades\/(\d+)$/)) && M === "GET") {
    const t = await env.DB.prepare("SELECT * FROM trades WHERE id = ? AND league_id = ? AND hidden = 0").bind(Number(m[1]), L).first();
    if (!t) throw new HttpError(404, "not_found");
    return json(await tradeView(env, t, me, managers, { withComments: true, ctx: await leagueCtx(env) }));
  }
  if ((m = path.match(/^\/api\/trades\/(\d+)\/vote$/)) && M === "POST") {
    if (!me) throw new HttpError(401, "token_required");
    const t = await env.DB.prepare("SELECT * FROM trades WHERE id = ? AND league_id = ? AND hidden = 0").bind(Number(m[1]), L).first();
    if (!t) throw new HttpError(404, "not_found");
    const v = await tradeView(env, t, me, managers);
    if (v.closed) throw new HttpError(409, "closed");
    if (v.me.participant) throw new HttpError(403, "participant");
    if (v.me.vote !== null) throw new HttpError(409, "already_voted");
    const { value } = await body(req);
    if (!Number.isInteger(value) || value < -3 || value > 3) throw new HttpError(400, "invalid_value");
    await env.DB.prepare("INSERT INTO trade_votes (trade_id, manager_id, value, created_at) VALUES (?, ?, ?, ?)")
      .bind(t.id, me.id, value, now()).run();
    return json(await tradeView(env, t, me, managers, { withComments: true, ctx: await leagueCtx(env) }));
  }

  if (path === "/api/polls" && M === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM polls WHERE league_id = ? ORDER BY opened_at DESC LIMIT 50").bind(L).all();
    return json(await Promise.all(results.map(p => pollView(env, p, me, managers))));
  }
  if ((m = path.match(/^\/api\/polls\/(\d+)$/)) && M === "GET") {
    const p = await env.DB.prepare("SELECT * FROM polls WHERE id = ? AND league_id = ?").bind(Number(m[1]), L).first();
    if (!p) throw new HttpError(404, "not_found");
    return json(await pollView(env, p, me, managers, { withComments: true }));
  }
  if ((m = path.match(/^\/api\/polls\/(\d+)\/vote$/)) && M === "POST") {
    if (!me) throw new HttpError(401, "token_required");
    const p = await env.DB.prepare("SELECT * FROM polls WHERE id = ? AND league_id = ?").bind(Number(m[1]), L).first();
    if (!p) throw new HttpError(404, "not_found");
    const v = await pollView(env, p, me, managers);
    if (v.closed) throw new HttpError(409, "closed");
    if (v.me.voted) throw new HttpError(409, "already_voted");
    const { choice } = await body(req);
    const opts = JSON.parse(p.options || "[]");
    const okIdx = i => Number.isInteger(i) && i >= 0 && i < opts.length;
    const valid = p.kind === "yesno" ? ["yes", "no", "abstain"].includes(choice)
      : p.kind === "single" ? okIdx(choice)
      : Array.isArray(choice) && choice.length > 0 && choice.every(okIdx) && new Set(choice).size === choice.length;
    if (!valid) throw new HttpError(400, "invalid_choice");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO poll_ballots (poll_id, manager_id) VALUES (?, ?)").bind(p.id, me.id),
      env.DB.prepare("INSERT INTO poll_votes (id, poll_id, manager_id, choice) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), p.id, p.anonymous ? null : me.id, JSON.stringify(choice)),
    ]);
    return json(await pollView(env, p, me, managers, { withComments: true }));
  }

  if (path === "/api/comments" && M === "POST") {
    if (!me) throw new HttpError(401, "token_required");
    const { target, id, text } = await body(req);
    const clean = String(text || "").trim().slice(0, 1000);
    if (!clean) throw new HttpError(400, "empty");
    let anonymous = false;
    if (target === "trade") {
      const t = await env.DB.prepare("SELECT * FROM trades WHERE id = ? AND league_id = ?").bind(Number(id), L).first();
      if (!t) throw new HttpError(404, "not_found");
      const v = await tradeView(env, t, me, managers);
      if (!v.results) throw new HttpError(403, "vote_first");
    } else if (target === "poll") {
      const p = await env.DB.prepare("SELECT * FROM polls WHERE id = ? AND league_id = ?").bind(Number(id), L).first();
      if (!p) throw new HttpError(404, "not_found");
      const v = await pollView(env, p, me, managers);
      if (!v.me.can_comment) throw new HttpError(403, "vote_first");
      anonymous = !!p.anonymous;
    } else throw new HttpError(400, "invalid_target");
    await env.DB.prepare("INSERT INTO comments (target, target_id, manager_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(target, Number(id), anonymous ? null : me.id, clean, now()).run();
    return json({ ok: true });
  }

  // ---------- Admin ----------
  if (path.startsWith("/api/admin/")) {
    requireAdmin(env, req);
    const a = path.slice("/api/admin".length);

    if (a === "/managers" && M === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, team_id, team_name, owner_name, active, token_hash IS NOT NULL AS has_token FROM managers WHERE league_id = ? ORDER BY team_name").bind(L).all();
      return json(results);
    }
    if (a === "/managers/sync" && M === "POST") {
      const d = await flea(`FetchLeagueStandings?sport=NFL&league_id=${L}`);
      let n = 0;
      for (const div of d.divisions || []) for (const t of div.teams || []) {
        const owner = (t.owners || []).map(o => o.displayName).join(", ") || null;
        await env.DB.prepare(`INSERT INTO managers (league_id, team_id, team_name, owner_name, created_at) VALUES (?, ?, ?, ?, ?)
                              ON CONFLICT (league_id, team_id) DO UPDATE SET team_name = excluded.team_name, owner_name = excluded.owner_name`)
          .bind(L, t.id, t.name, owner, now()).run();
        n++;
      }
      return json({ ok: true, teams: n, league: d.league?.name });
    }
    if ((m = a.match(/^\/managers\/(\d+)\/token$/)) && M === "POST") {
      const tok = randomToken();
      const r = await env.DB.prepare("UPDATE managers SET token_hash = ? WHERE id = ? AND league_id = ?").bind(await sha256(tok), Number(m[1]), L).run();
      if (!r.meta.changes) throw new HttpError(404, "not_found");
      return json({ token: tok });   // nur einmal sichtbar
    }
    if ((m = a.match(/^\/managers\/(\d+)$/)) && M === "POST") {
      const { active, owner_name } = await body(req);
      if (active !== undefined) await env.DB.prepare("UPDATE managers SET active = ? WHERE id = ?").bind(active ? 1 : 0, Number(m[1])).run();
      if (owner_name !== undefined) await env.DB.prepare("UPDATE managers SET owner_name = ? WHERE id = ?").bind(String(owner_name).slice(0, 60), Number(m[1])).run();
      return json({ ok: true });
    }

    if (a === "/trades/check" && M === "POST") return json(await syncTrades(env));
    if (a === "/trades/recent" && M === "GET") {
      const d = await flea(`FetchTrades?sport=NFL&league_id=${L}&filter=TRADES_COMPLETED`);
      const known = new Set((await env.DB.prepare("SELECT id FROM trades").all()).results.map(r => r.id));
      return json((d.trades || []).map(tr => ({ id: tr.id, description: tr.description, status: tr.status,
        date: Number(tr.approvedOn || tr.proposedOn || 0), sides: parseTrade(tr), imported: known.has(tr.id) })));
    }
    if (a === "/trades/import" && M === "POST") {
      const { id } = await body(req);
      const d = await flea(`FetchTrades?sport=NFL&league_id=${L}&filter=TRADES_COMPLETED`);
      const tr = (d.trades || []).find(x => x.id === Number(id));
      if (!tr) throw new HttpError(404, "not_found");
      const sides = enrichPlayers(parseTrade(tr), await leagueCtx(env));
      const opened = now();
      await env.DB.prepare(`INSERT OR IGNORE INTO trades (id, league_id, status, description, sides, team_a, team_b, opened_at, closes_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(tr.id, L, tr.status ?? null, tr.description || null, JSON.stringify(sides), sides[0].team_id, sides[1].team_id,
              opened, opened + tradeHours(env) * 3600e3).run();
      return json({ ok: true });
    }
    if ((m = a.match(/^\/trades\/(\d+)$/)) && M === "POST") {
      const { hidden, extend_hours, close } = await body(req);
      const id = Number(m[1]);
      if (hidden !== undefined) await env.DB.prepare("UPDATE trades SET hidden = ? WHERE id = ?").bind(hidden ? 1 : 0, id).run();
      if (extend_hours) await env.DB.prepare("UPDATE trades SET closes_at = closes_at + ?, closed_at = NULL WHERE id = ?").bind(Number(extend_hours) * 3600e3, id).run();
      if (close) await env.DB.prepare("UPDATE trades SET closed_at = ? WHERE id = ? AND closed_at IS NULL").bind(now(), id).run();
      return json({ ok: true });
    }
    // Admin-Liste: Zeitstempel und Teilnahme, keine Ergebnisse (Commish ohne Sonderansicht)
    if (a === "/trades" && M === "GET") {
      const { results } = await env.DB.prepare(`SELECT t.id, t.description, t.opened_at, t.closes_at, t.closed_at, t.hidden,
          (SELECT COUNT(*) FROM trade_votes v WHERE v.trade_id = t.id) AS voted FROM trades t WHERE league_id = ? ORDER BY opened_at DESC`).bind(L).all();
      return json(results);
    }

    if (a === "/polls" && M === "POST") {
      const b = await body(req);
      const kind = ["yesno", "single", "multi"].includes(b.kind) ? b.kind : null;
      if (!kind || !String(b.title || "").trim()) throw new HttpError(400, "invalid_poll");
      const options = kind === "yesno" ? null : (b.options || []).map(s => String(s).trim()).filter(Boolean);
      if (options && options.length < 2) throw new HttpError(400, "need_options");
      const visibility = ["live", "after_vote", "after_close"].includes(b.visibility) ? b.visibility : "after_vote";
      const opened = now();
      const r = await env.DB.prepare(`INSERT INTO polls (league_id, title, body, kind, options, anonymous, visibility, threshold, quorum,
            end_all_voted, end_yes, end_no, trade_id, opened_at, closes_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(L, String(b.title).trim().slice(0, 200), b.body ? String(b.body).slice(0, 4000) : null, kind,
              options ? JSON.stringify(options) : null, b.anonymous ? 1 : 0, visibility,
              kind === "yesno" ? (["simple", "two_thirds", "unanimous"].includes(b.threshold) ? b.threshold : "simple") : null,
              b.quorum ? Number(b.quorum) : null, b.end_all_voted === false ? 0 : 1,
              b.end_yes ? Number(b.end_yes) : null, b.end_no ? Number(b.end_no) : null,
              b.trade_id ? Number(b.trade_id) : null, opened, b.hours ? opened + Number(b.hours) * 3600e3 : null).run();
      return json({ ok: true, id: r.meta.last_row_id });
    }
    if ((m = a.match(/^\/polls\/(\d+)\/close$/)) && M === "POST") {
      await env.DB.prepare("UPDATE polls SET closed_at = ? WHERE id = ? AND closed_at IS NULL").bind(now(), Number(m[1])).run();
      return json({ ok: true });
    }
    if ((m = a.match(/^\/comments\/(\d+)$/)) && M === "DELETE") {
      await env.DB.prepare("UPDATE comments SET deleted = 1 WHERE id = ?").bind(Number(m[1])).run();
      return json({ ok: true });
    }
  }

  throw new HttpError(404, "not_found");
}

export default {
  async fetch(req, env, ctx) {
    const h = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    try {
      const res = await route(req, env, ctx);
      for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json({ error: e instanceof HttpError ? e.message : "server_error" }, status, h);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(leagueCtx(env, { refresh: true }).then(() => syncTrades(env)).catch(async e => {
      console.error("trade check", e);
      await env.DB.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('last_trade_error', ?)")
        .bind(`${new Date().toISOString()} ${e.message}`).run();
    }));
  },
};
