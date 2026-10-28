// MLD-Copilot: Hauptseite
(function captureToken() {
  const u = new URL(location.href);
  const k = u.searchParams.get("k");
  if (k) {
    store.set("mldc_token", k);
    u.searchParams.delete("k");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  }
})();

const $main = document.querySelector("main");
let ME = null;
let pending = null;            // { kind, id, value } vor der Bestaetigung

const LABELS = v => v === 0 ? t("s0") : t("s" + Math.abs(v));

function teamShort(name) { return name || "?"; }

const num1 = x => x == null ? null : (Math.round(x * 10) / 10).toString().replace(".", LANG === "de" ? "," : ".");

function playerInfo(i, pos) {
  if (!i) return "";
  const bits = [];
  if (i.age) bits.push(t("age", Math.floor(i.age)));
  if (i.rookie) bits.push("Rookie");
  if (i.pos_rank) bits.push(esc(pos || "") + i.pos_rank);
  if (i.pts_avg != null) bits.push(t("avg_pts", num1(i.pts_avg)));
  const inj = i.injury ? ` <span class="inj">${esc(i.injury)}</span>` : "";
  return `<div class="pinfo">${bits.join(" · ")}${inj}</div>`;
}

function pickOutlook(o) {
  return o ? ", " + o.tier.split("/").map(x => t("tier_" + x)).join("/") : "";
}

function sideHtml(s, cls) {
  const items = [
    ...s.players.map(p => `<li>${esc(p.name)}<span class="pos">${esc(p.pos || "")}${p.team ? " · " + esc(p.team) : ""}</span>${playerInfo(p.info, p.pos)}</li>`),
    ...s.picks.map(p => `<li class="pick">${esc(p.season)} ${t("round")} ${esc(p.round ?? "?")}${p.from ? ` (${t("from")} ${esc(p.from)})` : ""}${pickOutlook(p.outlook)}</li>`),
  ];
  return `<div class="side ${cls}"><h4>${esc(s.team_name)}<span class="gets">${t("gets")}</span></h4><ul>${items.join("") || "<li>–</li>"}</ul></div>`;
}

function statusPill(x) {
  if (x.closed) return `<span class="pill">${t("closed")}</span>`;
  if (x.closes_at) return `<span class="pill open">${countdown(x.closes_at)}</span>`;
  return `<span class="pill open">${t("open")}</span>`;
}

// ---------- Trades ----------
function tradeCard(tr) {
  const mine = tr.me?.participant ? `<span class="pill mine">${t("your_trade")}</span>` :
               tr.me?.vote !== null && tr.me?.vote !== undefined ? `<span class="pill mine">✓ ${t("you_voted")}</span>` : "";
  return `<div class="card${tr.me?.can_vote ? " new" : ""}"><a class="stretch" href="#/trade/${tr.id}">
    <div class="card-head"><h3>${esc(tr.sides[0].team_name)} ⇄ ${esc(tr.sides[1].team_name)}</h3><div>${mine} ${statusPill(tr)}</div></div>
    <div class="card-body"><div class="sides">${sideHtml(tr.sides[0], "a")}${sideHtml(tr.sides[1], "b")}</div>
    <div class="meta" style="margin-top:8px">${fmtDate(tr.opened_at)} · ${t("voted_of", tr.voted, tr.eligible)}</div></div></a></div>`;
}

function verdictHtml(r, tr) {
  const name = r.side === "A" ? tr.sides[0].team_name : r.side === "B" ? tr.sides[1].team_name : null;
  let head, sub;
  if (r.level === "none") { head = t("v_none"); sub = t("v_none_sub"); }
  else {
    head = r.level === "clear" ? t("v_clear", esc(name)) : t("v_tendency", esc(name));
    sub = `${t("strength_label")}: ${t("strength")[Math.round(r.strength)] || r.strength}`;
  }
  const ab = r.abstentions || 0;
  const max = Math.max(1, ...Object.entries(r.distribution).map(([v, n]) => n + (Number(v) === 0 ? ab : 0)));
  const H = n => Math.round(70 * n / max);
  const cols = [-3, -2, -1, 0, 1, 2, 3].map(v => {
    const n = r.distribution[v] || 0;
    const names = r.ballots.filter(b => b.value === v).map(b => esc(b.name)).join(", ");
    const abst = v === 0 && ab ? `<div class="bar abst" style="height:${H(ab)}px" title="${esc(t(tr.closed ? "abst_closed" : "abst_open", ab))}"></div>` : "";
    const label = v === 0 && ab ? `<div class="abst-lab">${esc(t(tr.closed ? "abst_closed" : "abst_open", ab))}</div>` : "";
    return `<div class="col ${v < 0 ? "a" : v > 0 ? "b" : ""}"><div class="n">${n || ""}${v === 0 && ab ? `<span class="n-abst"> +${ab}</span>` : ""}</div>
      ${abst}<div class="bar" style="height:${H(n)}px"></div><div class="lab">${LABELS(v)}</div>${label}<div class="names">${names}</div></div>`;
  }).join("");
  return `<div class="verdict ${r.side || ""}"><b>${head}</b><span class="meta">${sub}</span></div>
    <div class="scale-labels" style="margin-top:12px"><span class="la">◀ ${esc(tr.sides[0].team_name)}</span><span class="lb">${esc(tr.sides[1].team_name)} ▶</span></div>
    <div class="dist">${cols}</div>
    <div class="meta" style="margin-top:8px">${t("voted_of", r.votes, r.votes + r.abstentions)} · ${leadLine(r)}</div>
    <details class="explain"><summary>${t("how")}</summary>${INFO[LANG].short}<a href="#/info">${t("more_info")}</a></details>`;
}

function scaleHtml(tr) {
  const btns = [-3, -2, -1, 0, 1, 2, 3].map(v =>
    `<button data-v="${v}" class="${pending && pending.kind === "trade" && pending.value === v ? "sel" : ""}">${LABELS(v)}</button>`).join("");
  return `<div class="question">${t("question")}</div>
    <div class="scale-labels"><span class="la">◀ ${esc(tr.sides[0].team_name)}</span><span class="lb">${esc(tr.sides[1].team_name)} ▶</span></div>
    <div class="scale" id="scale">${btns}</div>
    ${pending && pending.kind === "trade" ? confirmHtml() : `<div class="meta" style="margin-top:6px">${t("final_note")}</div>`}`;
}

function confirmHtml() {
  return `<div class="confirm"><span>${t("confirm")}</span><button class="btn" id="c-no">${t("cancel")}</button><button class="btn primary" id="c-yes">${t("submit")}</button></div><div class="err" id="vote-err"></div>`;
}

async function showTrade(id) {
  const tr = await api("GET", `/trades/${id}`);
  let html = `<a class="back" href="#/trades">${t("back")}</a><div class="card">
    <div class="card-head"><h3>${esc(tr.description || "")}</h3>${statusPill(tr)}</div><div class="card-body">
    <div class="sides">${sideHtml(tr.sides[0], "a")}${sideHtml(tr.sides[1], "b")}</div>
    <div class="meta" style="margin-top:8px">${fmtDate(tr.opened_at)} · ${tr.closed ? t("ended") + " " + fmtDate(tr.closed_at || tr.closes_at) : t("ends") + " " + fmtDate(tr.closes_at)} · ${t("voted_of", tr.voted, tr.eligible)}</div>`;
  if (tr.me?.participant) html += `<div class="notice" style="margin:14px 0 0">${t("participant_note")}</div>`;
  if (tr.me?.can_vote) html += scaleHtml(tr);
  if (tr.results) html += verdictHtml(tr.results, tr);
  else if (!tr.closed) html += `<div class="notice" style="margin:14px 0 0">${t("hidden_until_vote")}</div>`;
  if (tr.comments) html += commentsHtml(tr.comments);
  html += `</div></div>`;
  $main.innerHTML = html;

  const scale = document.getElementById("scale");
  if (scale) scale.onclick = e => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    pending = { kind: "trade", id: tr.id, value: Number(b.dataset.v) }; showTrade(id);
  };
  bindConfirm(async () => api("POST", `/trades/${tr.id}/vote`, { value: pending.value }), () => showTrade(id));
  bindComment("trade", tr.id, () => showTrade(id));
}

// ---------- Umfragen ----------
function pollInfo(p) {
  const bits = [p.anonymous ? t("anon") : t("public"), t("vis_" + p.visibility)];
  if (p.kind === "yesno" && p.threshold) bits.push(t("th_" + p.threshold));
  if (p.quorum) bits.push(t("quorum", p.quorum));
  if (p.end_yes) bits.push(t("end_yes", p.end_yes));
  if (p.end_no) bits.push(t("end_no", p.end_no));
  return bits.map(b => `<span class="pill">${esc(b)}</span>`).join(" ");
}

function pollCard(p) {
  const mine = p.me?.voted ? `<span class="pill mine">✓ ${t("you_voted")}</span>` : "";
  return `<div class="card${p.me?.can_vote ? " new" : ""}"><a class="stretch" href="#/poll/${p.id}">
    <div class="card-head"><h3>${esc(p.title)}</h3><div>${mine} ${statusPill(p)}</div></div>
    <div class="card-body"><div>${pollInfo(p)}</div><div class="meta" style="margin-top:8px">${fmtDate(p.opened_at)} · ${t("voted_of", p.voted_count, p.eligible)}</div></div></a></div>`;
}

function pollVoteHtml(p) {
  const sel = pending && pending.kind === "poll" ? pending.value : null;
  let inner;
  if (p.kind === "yesno") {
    inner = `<div class="choices yesno" id="choices">${["yes", "abstain", "no"].map(c =>
      `<button data-c="${c}" class="${sel === c ? "sel" : ""}">${t(c)}</button>`).join("")}</div>`;
  } else if (p.kind === "single") {
    inner = `<div class="choices" id="choices">${p.options.map((o, i) =>
      `<button data-c="${i}" class="${sel === i ? "sel" : ""}">${esc(o)}</button>`).join("")}</div>`;
  } else {
    const chosen = Array.isArray(sel) ? sel : [];
    inner = `<div class="meta" style="margin-bottom:6px">${t("multi_hint")}</div><div class="choices" id="choices">${p.options.map((o, i) =>
      `<button data-c="${i}" class="${chosen.includes(i) ? "sel" : ""}">${chosen.includes(i) ? "☑" : "☐"} ${esc(o)}</button>`).join("")}</div>`;
  }
  const ready = sel !== null && !(Array.isArray(sel) && sel.length === 0);
  return `<div style="margin-top:14px">${inner}</div>${ready ? confirmHtml() : `<div class="meta" style="margin-top:6px">${t("final_note")}</div>`}`;
}

function pollResultsHtml(p) {
  const r = p.results;
  let html = "";
  if (r.kind === "yesno") {
    const total = Math.max(1, r.yes + r.no + r.abstain);
    html += `<div class="verdict"><span class="meta">${p.closed ? "" : t("current")}</span>
      <div class="outcome ${r.outcome}">${t(r.outcome)}</div></div>
      <div class="bars">${[["yes", r.yes], ["abstain", r.abstain], ["no", r.no]].map(([k, n]) =>
        `<div class="row"><div>${t(k)}</div><div class="track"><div class="fill" style="width:${100 * n / total}%"></div></div><div class="v">${n}</div></div>`).join("")}</div>`;
  } else {
    const total = Math.max(1, ...r.counts);
    html += `<div class="bars">${p.options.map((o, i) =>
      `<div class="row"><div>${r.winners.includes(i) ? "★ " : ""}${esc(o)}</div><div class="track"><div class="fill" style="width:${100 * r.counts[i] / total}%"></div></div><div class="v">${r.counts[i]}</div></div>`).join("")}</div>`;
  }
  if (r.voters) {
    const label = c => p.kind === "yesno" ? t(c) : (Array.isArray(c) ? c : [c]).map(i => p.options[i]).join(", ");
    html += `<div class="meta" style="margin-top:10px">${r.voters.map(v => `${esc(v.name)}: ${esc(label(v.choice))}`).join(" · ")}</div>`;
  }
  html += `<div class="meta" style="margin-top:6px">${t("voted_of", r.ballots, r.eligible)}</div>`;
  return html;
}

async function showPoll(id) {
  const p = await api("GET", `/polls/${id}`);
  let html = `<a class="back" href="#/polls">${t("back")}</a><div class="card">
    <div class="card-head"><h3>${esc(p.title)}</h3>${statusPill(p)}</div><div class="card-body">
    ${p.body ? `<p style="margin-top:0;white-space:pre-wrap">${esc(p.body)}</p>` : ""}
    <div>${pollInfo(p)}</div>
    <div class="meta" style="margin-top:8px">${fmtDate(p.opened_at)} · ${p.closed ? t("ended") + " " + fmtDate(p.closed_at) : p.closes_at ? t("ends") + " " + fmtDate(p.closes_at) : t("no_end")}
    ${p.trade_id ? ` · <a href="#/trade/${p.trade_id}">${t("trade_poll")}</a>` : ""}</div>`;
  if (p.me?.can_vote) html += pollVoteHtml(p);
  if (p.results) html += pollResultsHtml(p);
  else if (p.me?.voted || p.closed) html += `<div class="notice" style="margin:14px 0 0">${t("hidden_until_close")}</div>`;
  else html += `<div class="notice" style="margin:14px 0 0">${t(p.visibility === "after_close" ? "hidden_until_close" : "hidden_until_vote")}</div>`;
  if (p.comments) html += commentsHtml(p.comments, p.anonymous);
  html += `</div></div>`;
  $main.innerHTML = html;

  const ch = document.getElementById("choices");
  if (ch) ch.onclick = e => {
    const b = e.target.closest("button[data-c]"); if (!b) return;
    const c = p.kind === "yesno" ? b.dataset.c : Number(b.dataset.c);
    if (p.kind === "multi") {
      const cur = pending && pending.kind === "poll" && Array.isArray(pending.value) ? pending.value : [];
      const next = cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c].sort((a, b) => a - b);
      pending = { kind: "poll", id: p.id, value: next };
    } else pending = { kind: "poll", id: p.id, value: c };
    showPoll(id);
  };
  bindConfirm(async () => api("POST", `/polls/${p.id}/vote`, { choice: pending.value }), () => showPoll(id));
  bindComment("poll", p.id, () => showPoll(id));
}

// ---------- Kommentare & Bestaetigung ----------
function commentsHtml(list, anonymous) {
  const items = list.length ? list.map(c => `<div class="comment"><span class="who">${esc(c.name || t("anonymous_person"))}</span>
    <span class="when">${fmtDate(c.created_at)}</span><p>${esc(c.body)}</p></div>`).join("") : `<div class="meta">${t("no_comments")}</div>`;
  return `<div class="comments"><h4>${t("comments")}${anonymous ? ` <span class="pill">${t("anon")}</span>` : ""}</h4>${items}
    <form class="comment-form" id="cform"><textarea maxlength="1000" placeholder="${t("write")}" required></textarea><button class="btn primary">${t("send")}</button></form>
    <div class="err" id="c-err"></div></div>`;
}

function bindConfirm(send, done) {
  const no = document.getElementById("c-no"), yes = document.getElementById("c-yes");
  if (no) no.onclick = () => { pending = null; done(); };
  if (yes) yes.onclick = async () => {
    yes.disabled = true;
    try { await send(); pending = null; done(); }
    catch (e) { document.getElementById("vote-err").textContent = errText(e); yes.disabled = false; }
  };
}

function bindComment(target, id, done) {
  const f = document.getElementById("cform"); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const text = f.querySelector("textarea").value.trim(); if (!text) return;
    f.querySelector("button").disabled = true;
    try { await api("POST", "/comments", { target, id, text }); done(); }
    catch (err) { document.getElementById("c-err").textContent = errText(err); f.querySelector("button").disabled = false; }
  };
}

// ---------- Listen & Routing ----------
async function showList(kind) {
  const items = await api("GET", kind === "polls" ? "/polls" : "/trades");
  const intro = ME ? `<div class="meta" style="margin-bottom:12px">${t("hello")} <b>${esc(ME.owner_name || ME.team_name)}</b> · ${esc(ME.team_name)}</div>`
                   : `<div class="notice">${t("need_link")}</div>`;
  $main.innerHTML = intro + (items.length ? items.map(kind === "polls" ? pollCard : tradeCard).join("")
    : `<div class="empty">${t(kind === "polls" ? "no_polls" : "no_trades")}</div>`);
}

let OPEN = { trades: 0, polls: 0 };
async function refreshOpen() {
  if (!ME) return;
  try {
    const [tr, po] = await Promise.all([api("GET", "/trades"), api("GET", "/polls")]);
    OPEN = { trades: tr.filter(x => x.me?.can_vote).length, polls: po.filter(x => x.me?.can_vote).length };
  } catch {}
}
function renderNav(active) {
  const b = k => OPEN[k] ? `<span class="badge">${OPEN[k]}</span>` : "";
  document.getElementById("tabs").innerHTML =
    `<a href="#/trades" class="${active === "trades" ? "active" : ""}">${t("trades")}${b("trades")}</a><a href="#/polls" class="${active === "polls" ? "active" : ""}">${t("polls")}${b("polls")}</a><a href="#/info" class="${active === "info" ? "active" : ""}">${t("info")}</a>`;
}

async function router() {
  const h = location.hash || "#/trades";
  await refreshOpen();
  let m;
  try {
    if ((m = h.match(/^#\/trade\/(\d+)/))) { renderNav("trades"); await showTrade(m[1]); }
    else if ((m = h.match(/^#\/poll\/(\d+)/))) { renderNav("polls"); await showPoll(m[1]); }
    else if (h.startsWith("#/polls")) { renderNav("polls"); await showList("polls"); }
    else if (h.startsWith("#/info")) { renderNav("info"); $main.innerHTML = `<div class="card info"><div class="card-body">${INFO[LANG].page()}</div></div>`; }
    else { renderNav("trades"); await showList("trades"); }
  } catch (e) {
    $main.innerHTML = `<div class="notice err">${esc(errText(e))}</div>`;
  }
}

window.addEventListener("hashchange", () => { pending = null; router(); window.scrollTo(0, 0); });

(async function init() {
  renderToggles(document.getElementById("toggles"), router);
  $main.innerHTML = `<div class="empty">${t("loading")}</div>`;
  try {
    ME = await api("GET", "/me");
    if (!ME && store.get("mldc_token")) store.set("mldc_token", null);   // Link gesperrt oder ungueltig
  } catch { ME = null; }                                                 // Netzwerkfehler: Token behalten
  router();
  setInterval(() => { if (!pending && !document.activeElement?.matches("textarea") && !location.hash.startsWith("#/info") && !document.querySelector("details[open]")) router(); }, 60000);
})();
