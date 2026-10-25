// Gemeinsam fuer Seite und Admin: Einstellungen, Sprache, API.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

const API = (window.MLDC_CONFIG && window.MLDC_CONFIG.api) || "http://localhost:8787";

// ---------- Sprache ----------
const STR = {
  de: {
    trades: "Trades", polls: "Umfragen", admin: "Admin",
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
    v_clear: side => `Klarer Vorteil für ${side}`, v_tendency: side => `Tendenz zu ${side}`,
    v_none: "Kein klares Bild", v_none_sub: "Die Liga ist sich nicht einig oder hält den Trade für fair.",
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
    abst_open: n => `${n} offen · zählen ½`, abst_closed: n => `${n} Enthaltung${n === 1 ? "" : "en"} · zählen ½`,
    theme: "Hell/Dunkel", lang: "Sprache", trade_poll: "Zum Trade",
  },
  en: {
    trades: "Trades", polls: "Polls", admin: "Admin",
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
    v_clear: side => `Clear edge for ${side}`, v_tendency: side => `Leaning ${side}`,
    v_none: "No clear picture", v_none_sub: "The league is split or sees the trade as fair.",
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
    abst_open: n => `${n} pending · count ½`, abst_closed: n => `${n} abstained · count ½`,
    theme: "Light/Dark", lang: "Language", trade_poll: "Go to trade",
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

function renderToggles(el, onChange) {
  el.innerHTML = `
    <button class="icon-btn" id="tg-theme" title="${t("theme")}" aria-label="${t("theme")}">${isDark() ? ICON_SUN : ICON_MOON}</button>
    <button class="icon-btn" id="tg-de" title="Deutsch" aria-label="Deutsch" aria-pressed="${LANG === "de"}">${FLAG_AT}</button>
    <button class="icon-btn" id="tg-en" title="English" aria-label="English" aria-pressed="${LANG === "en"}">${FLAG_US}</button>`;
  el.querySelector("#tg-theme").onclick = () => {
    store.set("mldc_theme", isDark() ? "light" : "dark"); applyTheme(); renderToggles(el, onChange);
  };
  const setLang = l => { LANG = l; store.set("mldc_lang", l); document.documentElement.lang = l; renderToggles(el, onChange); onChange && onChange(); };
  el.querySelector("#tg-de").onclick = () => setLang("de");
  el.querySelector("#tg-en").onclick = () => setLang("en");
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
