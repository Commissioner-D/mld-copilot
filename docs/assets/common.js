// Gemeinsam fuer Seite und Admin: Einstellungen, Sprache, API.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

const API = (window.MLDC_CONFIG && window.MLDC_CONFIG.api) || "http://localhost:8787";

// ---------- Sprache ----------
const STR = {
  de: {
    trades: "Trades", polls: "Umfragen", admin: "Admin", info: "Info", how: "So wird ausgewertet", more_info: "Mehr dazu unter Info →",
    need_link: "<strong>Nur ansehen.</strong> Zum Abstimmen brauchst du deinen persönlichen Link vom Commish.",
    hello: "Angemeldet als", no_trades: "Noch keine Trades zur Abstimmung.", no_polls: "Noch keine Umfragen.",
    gets: "bekommt", pick: "Pick", round: "Runde", from: "von",
    open: "offen", closed: "beendet", left: "noch", days: "T", hours: "Std", minutes: "Min",
    ends: "endet", ended: "Beendet", no_end: "ohne Zeitlimit",
    voted_of: (a, b) => `${a} von ${b} abgestimmt`,
    you_voted: "abgestimmt", your_trade: "dein Trade",
    question: "Wer hat aus Sicht seines eigenen Teams den besseren Deal gemacht?",
    s3: "klar", s2: "deutlich", s1: "leicht", s0: "fair",
    confirm: "Stimme endgültig abgeben?", submit: "Abgeben", cancel: "Abbrechen",
    final_note: "Stimmen sind endgültig und können nicht geändert werden.",
    hidden_until_vote: "Den Stand siehst du, sobald du abgestimmt hast.",
    hidden_until_close: "Ergebnisse werden nach dem Ende der Abstimmung angezeigt.",
    participant_note: "Du bist an diesem Trade beteiligt und stimmst nicht ab.",
    v_clear: side => `klarer Vorteil für ${side}`, v_tendency: side => `Tendenz zu ${side}`,
    v_none: "kein klares Bild", v_none_sub: "Die Liga ist sich nicht einig oder hält den Trade für fair.",
    v_trade: { small: "Kleiner Trade", medium: "Mittlerer Trade", large: "Großer Trade" }, v_cap: "Ergebnis", v_interim: "Zwischenstand",
    v_early: (n, m) => `Erst ${n} von ${m} haben abgestimmt, das kann sich noch deutlich ändern. Wer noch nicht abgestimmt hat, zählt vorerst halb als „fair“.`,
    v_open: (n, m) => `${n} von ${m} haben abgestimmt, die Abstimmung läuft noch.`,
    strength: ["", "leicht", "deutlich", "klar"], strength_label: "Stärke",
    comments: "Kommentare", no_comments: "Noch keine Kommentare.", write: "Kommentar schreiben…", send: "Senden",
    anon: "anonym", public: "öffentlich",
    vis_live: "Stand jederzeit sichtbar", vis_after_vote: "Stand nach eigener Stimme", vis_after_close: "Ergebnis nach Ende",
    th_simple: "einfache Mehrheit", th_two_thirds: "2/3-Mehrheit", th_unanimous: "einstimmig",
    quorum: n => `Quorum ${n}`, end_yes: n => `entschieden bei ${n}× Ja`, end_no: n => `entschieden bei ${n}× Nein`,
    yes: "Ja", no: "Nein", abstain: "Enthaltung", multi_hint: "Mehrfachauswahl möglich",
    accepted: "Angenommen", rejected: "Abgelehnt", no_quorum: "Quorum nicht erreicht", current: "Aktueller Stand",
    anonymous_person: "Anonym", back: "← Zurück", error: "Fehler", loading: "Lädt…",
    err_already_voted: "Du hast schon abgestimmt.", err_closed: "Die Abstimmung ist beendet.",
    err_token_required: "Dein Link fehlt oder ist ungültig.", err_vote_first: "Erst abstimmen, dann kommentieren.",
    age: n => `${n} J.`, pos_rank: n => `#${n} Pos.`, avg_pts: x => `Ø ${x} Pkt`, snaps: n => `${n} % Snaps`,
    tier_early: "früh", tier_mid: "mittel", tier_late: "spät",
    size: "Tragweite", size_small: "gering", size_medium: "mittel", size_large: "hoch", unrated: "nicht bewertet",
    outlook_tip: "Prognose nach aktuellem Points for Optimum (niedrigster PfO = frühester Pick)",
    abst_open: n => `${n} offen · zählen ½`, abst_closed: n => `${n} Enthaltung${n === 1 ? "" : "en"} · zählen ½`,
    theme: "Darstellung", lang: "Sprache", settings: "Einstellungen",
    th_system: "Wie Gerät", th_light: "Hell", th_dark: "Dunkel",
    logout: "Link auf diesem Gerät vergessen", logout_confirm: "Wirklich abmelden? Du brauchst danach deinen Link erneut.", trade_poll: "Zum Trade",
  },
  en: {
    trades: "Trades", polls: "Polls", admin: "Admin", info: "Info", how: "How this is evaluated", more_info: "More under Info →",
    need_link: "<strong>View only.</strong> To vote you need your personal link from the commish.",
    hello: "Signed in as", no_trades: "No trades up for a vote yet.", no_polls: "No polls yet.",
    gets: "gets", pick: "Pick", round: "Round", from: "from",
    open: "open", closed: "closed", left: "", days: "d", hours: "h", minutes: "min",
    ends: "ends", ended: "Ended", no_end: "no time limit",
    voted_of: (a, b) => `${a} of ${b} voted`,
    you_voted: "voted", your_trade: "your trade",
    question: "Who got the better deal from their own team's point of view?",
    s3: "clearly", s2: "solidly", s1: "slightly", s0: "fair",
    confirm: "Submit your vote? It's final.", submit: "Submit", cancel: "Cancel",
    final_note: "Votes are final and can't be changed.",
    hidden_until_vote: "You'll see the results once you've voted.",
    hidden_until_close: "Results are shown when voting ends.",
    participant_note: "You're part of this trade, so you don't vote.",
    v_clear: side => `clear edge for ${side}`, v_tendency: side => `leaning ${side}`,
    v_none: "no clear picture", v_none_sub: "The league is split or sees the trade as fair.",
    v_trade: { small: "Small trade", medium: "Medium trade", large: "Big trade" }, v_cap: "Result", v_interim: "Interim",
    v_early: (n, m) => `Only ${n} of ${m} have voted, this can still change a lot. Those who haven't voted count as half a "fair" for now.`,
    v_open: (n, m) => `${n} of ${m} have voted, voting is still open.`,
    strength: ["", "slight", "solid", "clear"], strength_label: "Strength",
    comments: "Comments", no_comments: "No comments yet.", write: "Write a comment…", send: "Send",
    anon: "anonymous", public: "public",
    vis_live: "Results always visible", vis_after_vote: "Results after your vote", vis_after_close: "Results after close",
    th_simple: "simple majority", th_two_thirds: "2/3 majority", th_unanimous: "unanimous",
    quorum: n => `quorum ${n}`, end_yes: n => `decided at ${n}× yes`, end_no: n => `decided at ${n}× no`,
    yes: "Yes", no: "No", abstain: "Abstain", multi_hint: "Pick as many as you like",
    accepted: "Accepted", rejected: "Rejected", no_quorum: "Quorum not met", current: "Current standing",
    anonymous_person: "Anonymous", back: "← Back", error: "Error", loading: "Loading…",
    err_already_voted: "You've already voted.", err_closed: "Voting has ended.",
    err_token_required: "Your link is missing or invalid.", err_vote_first: "Vote first, then comment.",
    age: n => `${n} yrs`, pos_rank: n => `pos #${n}`, avg_pts: x => `avg ${x} pts`, snaps: n => `${n}% snaps`,
    tier_early: "early", tier_mid: "middle", tier_late: "late",
    size: "Impact", size_small: "low", size_medium: "medium", size_large: "high", unrated: "not rated",
    outlook_tip: "Projection from current Points for Optimum (lowest PfO = earliest pick)",
    abst_open: n => `${n} pending · count ½`, abst_closed: n => `${n} abstained · count ½`,
    theme: "Appearance", lang: "Language", settings: "Settings",
    th_system: "Match device", th_light: "Light", th_dark: "Dark",
    logout: "Forget link on this device", logout_confirm: "Sign out? You'll need your link again afterwards.", trade_poll: "Go to trade",
  },
};
let LANG = store.get("mldc_lang") || ((navigator.language || "").toLowerCase().startsWith("de") ? "de" : "en");
const t = (k, ...a) => { const v = STR[LANG][k]; return typeof v === "function" ? v(...a) : v ?? k; };

// ---------- Darstellung ----------
function applyTheme() {
  const th = store.get("mldc_theme");
  if (th) document.documentElement.setAttribute("data-theme", th);
  else document.documentElement.removeAttribute("data-theme");
}
applyTheme();
document.documentElement.lang = LANG;

const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const FLAG_AT = '<svg class="flag" viewBox="0 0 30 20"><rect width="30" height="20" fill="#c8102e"/><rect y="6.67" width="30" height="6.67" fill="#fff"/></svg>';
const FLAG_US = '<svg class="flag" viewBox="0 0 38 20"><rect width="38" height="20" fill="#fff"/>' +
  [0, 2, 4, 6, 8, 10, 12].map(i => `<rect y="${i * 20 / 13}" width="38" height="${20 / 13}" fill="#b22234"/>`).join("") +
  '<rect width="15.2" height="10.77" fill="#3c3b6e"/>' +
  [[2, 2], [6, 2], [10, 2], [4, 5.4], [8, 5.4], [12, 5.4], [2, 8.8], [6, 8.8], [10, 8.8]].map(([x, y]) => `<circle cx="${x + 1}" cy="${y}" r=".8" fill="#fff"/>`).join("") + "</svg>";

function isDark() {
  const th = store.get("mldc_theme");
  return th ? th === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

const ICON_GEAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>';

function renderToggles(el, onChange) {
  const th = store.get("mldc_theme") || "system";
  const opt = (group, val, label, icon = "") =>
    `<button role="menuitemradio" aria-checked="${group === "theme" ? th === val : LANG === val}" data-${group}="${val}">${icon}<span>${label}</span></button>`;
  el.innerHTML = `<div class="settings">
    <button class="icon-btn gear" aria-haspopup="true" aria-expanded="false" title="${t("settings")}" aria-label="${t("settings")}">${ICON_GEAR}<span class="caret">▾</span></button>
    <div class="menu" role="menu" hidden>
      <div class="menu-h">${t("theme")}</div>
      ${opt("theme", "system", t("th_system"))}${opt("theme", "light", t("th_light"))}${opt("theme", "dark", t("th_dark"))}
      <div class="menu-h">${t("lang")}</div>
      ${opt("lang", "de", "Deutsch", FLAG_AT)}${opt("lang", "en", "English", FLAG_US)}
      ${store.get("mldc_token") ? `<div class="menu-sep"></div><button data-logout="1"><span>${t("logout")}</span></button>` : ""}
    </div></div>`;
  const btn = el.querySelector(".gear"), menu = el.querySelector(".menu");
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); };
  if (!window.__mldcMenu) {             // globale Listener nur einmal registrieren
    window.__mldcMenu = true;
    const closeAll = () => document.querySelectorAll(".settings .menu").forEach(m => { m.hidden = true; });
    document.addEventListener("click", e => { if (!e.target.closest(".settings")) closeAll(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
  }
  menu.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.theme) { store.set("mldc_theme", b.dataset.theme === "system" ? null : b.dataset.theme); applyTheme(); }
    if (b.dataset.lang) { LANG = b.dataset.lang; store.set("mldc_lang", LANG); document.documentElement.lang = LANG; onChange && onChange(); }
    if (b.dataset.logout && confirm(t("logout_confirm"))) { store.set("mldc_token", null); location.reload(); return; }
    renderToggles(el, onChange);
  };
}

// ---------- Helfer ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtDate(ms) {
  return new Date(ms).toLocaleString(LANG === "de" ? "de-AT" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function countdown(ms) {
  let s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  const parts = d ? [`${d} ${t("days")}`, `${h} ${t("hours")}`] : h ? [`${h} ${t("hours")}`, `${m} ${t("minutes")}`] : [`${m} ${t("minutes")}`];
  return LANG === "de" ? "noch " + parts.join(" ") : parts.join(" ") + " left";
}

async function api(method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const tok = store.get("mldc_token");
  if (tok) headers.Authorization = "Bearer " + tok;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(API + "/api" + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || r.status); e.code = data.error; e.status = r.status; throw e; }
  return data;
}

function errText(e) { return STR[LANG]["err_" + e.code] || `${t("error")}: ${e.code || e.message}`; }
