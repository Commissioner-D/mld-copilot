// MLD-Copilot: Admin (nur fuer den Commish). Zeigt keine Abstimmungsergebnisse.
const A = {
  de: {
    title: "Admin", key: "Admin-Schlüssel", login: "Anmelden", logout: "Abmelden", wrong: "Schlüssel falsch.",
    managers: "Manager & Links", sync: "Teams von Fleaflicker holen", team: "Team", owner: "Name", active: "aktiv",
    link: "Link", new_link: "Neuer Link", link_note: "Nur jetzt sichtbar. Ein neuer Link macht den alten ungültig.",
    copy: "Kopieren", copied: "Kopiert", whatsapp: "Per WhatsApp", save: "Speichern",
    msg: (name, link) => `Servus ${name}! Dein persönlicher Link für den MLD-Copilot (Trade-Abstimmungen & Umfragen). Nicht weitergeben:\n${link}`,
    trades: "Trades", check: "Jetzt auf neue Trades prüfen", checked: r => `${r.added} neu, ${r.updated} aktualisiert`,
    recent: "Abgeschlossene Trades aus Fleaflicker", import: "Zur Abstimmung", imported: "übernommen",
    votes: "Stimmen", close: "Beenden", extend: "+24 h", hide: "Ausblenden", show: "Einblenden",
    new_poll: "Neue Umfrage", q: "Frage", desc: "Beschreibung (optional)", kind: "Art",
    k_yesno: "Ja / Enthaltung / Nein", k_single: "Eine Option wählen", k_multi: "Mehrere Optionen wählen",
    options: "Optionen (eine pro Zeile)", anon: "Anonym", vis: "Ergebnis sichtbar",
    v_live: "jederzeit", v_after_vote: "nach eigener Stimme", v_after_close: "nach Ende",
    th: "Mehrheit", th_simple: "einfach", th_two_thirds: "2/3", th_unanimous: "einstimmig",
    quorum: "Quorum (Mindestbeteiligung, optional)", hours: "Dauer in Stunden (leer = ohne Limit)",
    end_all: "Endet, wenn alle abgestimmt haben", end_yes: "Endet bei so vielen Ja (optional)", end_no: "Endet bei so vielen Nein (optional)",
    trade_id: "Zu Trade-ID (optional)", create: "Umfrage starten", created: "Umfrage gestartet",
    polls: "Umfragen", open: "offen", closed: "beendet", none: "Keine.",
  },
  en: {
    title: "Admin", key: "Admin key", login: "Sign in", logout: "Sign out", wrong: "Wrong key.",
    managers: "Managers & links", sync: "Pull teams from Fleaflicker", team: "Team", owner: "Name", active: "active",
    link: "Link", new_link: "New link", link_note: "Shown only now. A new link invalidates the old one.",
    copy: "Copy", copied: "Copied", whatsapp: "Via WhatsApp", save: "Save",
    msg: (name, link) => `Hey ${name}! Your personal MLD-Copilot link (trade votes & polls). Don't share it:\n${link}`,
    trades: "Trades", check: "Check for new trades now", checked: r => `${r.added} new, ${r.updated} updated`,
    recent: "Completed trades from Fleaflicker", import: "Open vote", imported: "imported",
    votes: "votes", close: "Close", extend: "+24 h", hide: "Hide", show: "Show",
    new_poll: "New poll", q: "Question", desc: "Description (optional)", kind: "Type",
    k_yesno: "Yes / Abstain / No", k_single: "Pick one option", k_multi: "Pick several options",
    options: "Options (one per line)", anon: "Anonymous", vis: "Results visible",
    v_live: "always", v_after_vote: "after own vote", v_after_close: "after close",
    th: "Majority", th_simple: "simple", th_two_thirds: "2/3", th_unanimous: "unanimous",
    quorum: "Quorum (min. turnout, optional)", hours: "Duration in hours (empty = no limit)",
    end_all: "Ends when everyone has voted", end_yes: "Ends at this many yes (optional)", end_no: "Ends at this many no (optional)",
    trade_id: "Linked trade ID (optional)", create: "Start poll", created: "Poll started",
    polls: "Polls", open: "open", closed: "closed", none: "None.",
  },
};
const a = k => A[LANG][k];
const $m = document.querySelector("main");
const KEY = () => store.get("mldc_admin");
const adm = (method, path, body) => api(method, "/admin" + path, body, { "X-Admin-Key": KEY() || "" });
const PAGE = location.href.replace(/admin\.html.*$/, "");

function loginView(err) {
  $m.innerHTML = `<div class="card admin"><div class="card-body">
    <label class="f">${a("key")}</label><input type="password" id="k" autocomplete="current-password">
    <div style="margin-top:10px"><button class="btn primary" id="go">${a("login")}</button></div>
    ${err ? `<div class="err">${a("wrong")}</div>` : ""}</div></div>`;
  document.getElementById("go").onclick = () => { store.set("mldc_admin", document.getElementById("k").value.trim()); render(); };
}

async function render() {
  if (!KEY()) return loginView();
  let mgrs;
  try { mgrs = await adm("GET", "/managers"); }
  catch (e) { if (e.status === 401) { store.set("mldc_admin", null); return loginView(true); } throw e; }
  const [trades, polls] = await Promise.all([adm("GET", "/trades"), api("GET", "/polls")]);

  $m.innerHTML = `<div class="admin">
  <div style="text-align:right;margin-bottom:8px"><button class="btn small" id="logout">${a("logout")}</button></div>

  <div class="card"><div class="card-head"><h3>${a("managers")}</h3><button class="btn small" id="sync">${a("sync")}</button></div>
  <div class="card-body"><div class="table-wrap"><table><tr><th>${a("team")}</th><th>${a("owner")}</th><th>${a("active")}</th><th>${a("link")}</th></tr>
  ${mgrs.map(m => `<tr data-id="${m.id}"><td>${esc(m.team_name)}</td>
    <td><input type="text" value="${esc(m.owner_name || "")}" data-owner></td>
    <td><input type="checkbox" data-active ${m.active ? "checked" : ""}></td>
    <td><button class="btn small" data-link>${m.has_token ? "↻ " : ""}${a("new_link")}</button></td></tr>
    <tr class="linkrow" data-for="${m.id}" hidden><td colspan="4"></td></tr>`).join("") || `<tr><td colspan="4">${a("none")}</td></tr>`}
  </table></div></div></div>

  <div class="card"><div class="card-head"><h3>${a("trades")}</h3><button class="btn small" id="check">${a("check")}</button></div>
  <div class="card-body"><div class="meta" id="checkres"></div>
  <div class="table-wrap"><table>${trades.map(tr => `<tr data-tid="${tr.id}"><td>${esc(tr.description || tr.id)}<div class="meta">${fmtDate(tr.opened_at)} · ${tr.voted} ${a("votes")} · ${tr.closed_at || Date.now() > tr.closes_at ? a("closed") : countdown(tr.closes_at)}</div></td>
    <td style="white-space:nowrap"><button class="btn small" data-act="extend">${a("extend")}</button>
    <button class="btn small" data-act="close">${a("close")}</button>
    <button class="btn small" data-act="hide" data-h="${tr.hidden ? 0 : 1}">${tr.hidden ? a("show") : a("hide")}</button></td></tr>`).join("") || `<tr><td>${a("none")}</td></tr>`}</table></div>
  <details style="margin-top:12px"><summary>${a("recent")}</summary><div id="recent" class="meta">…</div></details></div></div>

  <div class="card"><div class="card-head"><h3>${a("new_poll")}</h3></div><div class="card-body"><form id="pform">
    <label class="f">${a("q")}</label><input type="text" name="title" required maxlength="200">
    <label class="f">${a("desc")}</label><textarea name="body" rows="3"></textarea>
    <div class="grid2"><div><label class="f">${a("kind")}</label><select name="kind">
      <option value="yesno">${a("k_yesno")}</option><option value="single">${a("k_single")}</option><option value="multi">${a("k_multi")}</option></select></div>
      <div><label class="f">${a("vis")}</label><select name="visibility">
      <option value="after_vote">${a("v_after_vote")}</option><option value="after_close">${a("v_after_close")}</option><option value="live">${a("v_live")}</option></select></div></div>
    <div id="optwrap" hidden><label class="f">${a("options")}</label><textarea name="options" rows="4"></textarea></div>
    <div id="ynwrap" class="grid2"><div><label class="f">${a("th")}</label><select name="threshold">
      <option value="simple">${a("th_simple")}</option><option value="two_thirds">${a("th_two_thirds")}</option><option value="unanimous">${a("th_unanimous")}</option></select></div>
      <div><label class="f">${a("quorum")}</label><input type="number" name="quorum" min="1" max="16"></div>
      <div><label class="f">${a("end_yes")}</label><input type="number" name="end_yes" min="1" max="16"></div>
      <div><label class="f">${a("end_no")}</label><input type="number" name="end_no" min="1" max="16"></div></div>
    <div class="grid2"><div><label class="f">${a("hours")}</label><input type="number" name="hours" min="1" value="72"></div>
      <div><label class="f">${a("trade_id")}</label><input type="number" name="trade_id"></div></div>
    <label class="f"><input type="checkbox" name="anonymous"> ${a("anon")}</label>
    <label class="f"><input type="checkbox" name="end_all_voted" checked> ${a("end_all")}</label>
    <div style="margin-top:12px"><button class="btn primary">${a("create")}</button> <span class="meta" id="pres"></span></div>
  </form></div></div>

  <div class="card"><div class="card-head"><h3>${a("polls")}</h3></div><div class="card-body"><table>
    ${polls.map(p => `<tr data-pid="${p.id}"><td><a href="./#/poll/${p.id}">${esc(p.title)}</a><div class="meta">${p.voted_count}/${p.eligible} · ${p.closed ? a("closed") : a("open")}</div></td>
      <td>${p.closed ? "" : `<button class="btn small" data-pclose>${a("close")}</button>`}</td></tr>`).join("") || `<tr><td>${a("none")}</td></tr>`}
  </table></div></div></div>`;

  document.getElementById("logout").onclick = () => { store.set("mldc_admin", null); render(); };
  document.getElementById("sync").onclick = async () => { await adm("POST", "/managers/sync"); render(); };
  document.querySelectorAll("tr[data-id]").forEach(row => {
    const id = row.dataset.id;
    row.querySelector("[data-owner]").onchange = e => adm("POST", `/managers/${id}`, { owner_name: e.target.value });
    row.querySelector("[data-active]").onchange = e => adm("POST", `/managers/${id}`, { active: e.target.checked });
    row.querySelector("[data-link]").onclick = async () => {
      const { token } = await adm("POST", `/managers/${id}/token`);
      const link = `${PAGE}?k=${token}`;
      const name = row.querySelector("[data-owner]").value || "";
      const lr = document.querySelector(`tr.linkrow[data-for="${id}"]`); lr.hidden = false;
      lr.firstElementChild.innerHTML = `<div class="meta">${a("link_note")}</div><div class="linkbox">${esc(link)}</div>
        <button class="btn small" data-copy>${a("copy")}</button>
        <a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(a("msg")(name, link))}">${a("whatsapp")}</a>`;
      lr.querySelector("[data-copy]").onclick = async e => { await navigator.clipboard.writeText(link); e.target.textContent = a("copied"); };
    };
  });
  document.getElementById("check").onclick = async () => {
    const r = await adm("POST", "/trades/check"); document.getElementById("checkres").textContent = a("checked")(r);
    if (r.added) render();
  };
  document.querySelectorAll("tr[data-tid] button").forEach(b => b.onclick = async () => {
    const id = b.closest("tr").dataset.tid, act = b.dataset.act;
    await adm("POST", `/trades/${id}`, act === "extend" ? { extend_hours: 24 } : act === "close" ? { close: true } : { hidden: b.dataset.h === "1" });
    render();
  });
  document.querySelector("details").ontoggle = async e => {
    if (!e.target.open) return;
    const list = await adm("GET", "/trades/recent");
    const box = document.getElementById("recent");
    box.innerHTML = list.length ? `<table>${list.slice(0, 15).map(tr => `<tr><td>${esc(tr.description)}<div class="meta">${fmtDate(tr.date)}</div></td>
      <td>${tr.imported ? a("imported") : `<button class="btn small" data-imp="${tr.id}">${a("import")}</button>`}</td></tr>`).join("")}</table>` : a("none");
    box.querySelectorAll("[data-imp]").forEach(b => b.onclick = async () => { await adm("POST", "/trades/import", { id: Number(b.dataset.imp) }); render(); });
  };
  const f = document.getElementById("pform"), F = f.elements;
  const syncKind = () => { const k = F.kind.value; f.querySelector("#optwrap").hidden = k === "yesno"; f.querySelector("#ynwrap").hidden = k !== "yesno"; };
  F.kind.onchange = syncKind; syncKind();
  f.onsubmit = async e => {
    e.preventDefault();
    const num = n => F[n].value ? Number(F[n].value) : null;
    const b = { title: F.title.value, body: F.body.value || null, kind: F.kind.value, visibility: F.visibility.value,
      anonymous: F.anonymous.checked, end_all_voted: F.end_all_voted.checked, hours: num("hours"), trade_id: num("trade_id") };
    if (b.kind === "yesno") Object.assign(b, { threshold: F.threshold.value, quorum: num("quorum"), end_yes: num("end_yes"), end_no: num("end_no") });
    else b.options = F.options.value.split("\n");
    try { await adm("POST", "/polls", b); render(); }
    catch (err) { document.getElementById("pres").textContent = errText(err); }
  };
  document.querySelectorAll("[data-pclose]").forEach(b => b.onclick = async () => { await adm("POST", `/polls/${b.closest("tr").dataset.pid}/close`); render(); });
}

renderToggles(document.getElementById("toggles"), () => render());
render().catch(e => { $m.innerHTML = `<div class="notice err">${esc(errText(e))}</div>`; });
