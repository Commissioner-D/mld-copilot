// Draft-Pick-Tracker (Test): zeichnet docs/data/draft_tracker.json als SVG.
// Daten: tools/build_draft_tracker.py, dienstags per Workflow aktualisiert.
const DPT_TXT = {
  de: { hist: "Bisheriger Verlauf", now: w => `Stand nach W${w}`, out: "Outlook und Draft", draft: "Draft",
        click: "Klick auf einen Namen blendet das Team ein oder aus", upd: d => `Stand: ${d}`,
        none: "Noch keine Daten. Der Tracker wird dienstags um 8:00 aktualisiert.", err: "Tracker konnte nicht geladen werden." },
  en: { hist: "Season so far", now: w => `After W${w}`, out: "Outlook & draft", draft: "Draft",
        click: "Tap a name to show or hide a team", upd: d => `Updated: ${d}`,
        none: "No data yet. The tracker updates Tuesdays at 8:00 (Vienna).", err: "Couldn't load the tracker." },
};
const DPT_LIGHT = ["#2a78d6","#eb6834","#1baf7a","#eda100","#e87ba4","#008300","#6250d6","#e34948","#0c447c","#993c1d","#085041","#854f0b","#993556","#3b6d11","#3c3489","#791f1f"];
const DPT_DARK = ["#3987e5","#d95926","#199e70","#c98500","#d55181","#0ca30c","#9085e9","#e66767","#85b7eb","#f0997b","#5dcaa5","#fac775","#ed93b1","#97c459","#afa9ec","#f09595"];
let DPT_DATA = null, DPT_SEL = null;

async function renderDraftTracker() {
  const box = document.getElementById("dpt");
  if (!box) return;
  const tx = DPT_TXT[LANG] || DPT_TXT.de;
  try {
    if (!DPT_DATA) {
      const r = await fetch("data/draft_tracker.json?t=" + Math.floor(Date.now() / 3600000));
      if (!r.ok) { box.innerHTML = `<p class="meta">${tx.none}</p>`; return; }
      DPT_DATA = await r.json();
    }
  } catch { box.innerHTML = `<p class="meta">${tx.err}</p>`; return; }
  const D = DPT_DATA;
  if (!DPT_SEL) DPT_SEL = new Set(ME && D.teams.some(t => t.id === ME.team_id) ? [ME.team_id] : []);
  const upd = new Date(D.generated_utc.replace("Z", ":00Z"));
  box.innerHTML = `<div class="meta" style="margin:4px 0 8px">${tx.click} · ${tx.upd(fmtDate(upd.getTime()))}</div>
    <div class="dpt-scroll"><svg class="dpt" viewBox="0 0 680 500" role="img" aria-label="Draft-Pick-Tracker"></svg></div>`;
  dptDraw(box.querySelector("svg"), D, tx);
}

function dptDraw(svg, D, tx) {
  const dark = isDark(), PAL = dark ? DPT_DARK : DPT_LIGHT;
  const css = getComputedStyle(document.documentElement);
  const MUT = css.getPropertyValue("--muted").trim() || "#888", TXT = css.getPropertyValue("--text").trim() || "#333";
  const GRAY = dark ? "#5f5e5a" : "#b4b2a9", GRID = dark ? "#3a3d42" : "#e6e5df", BASE = dark ? "#55585e" : "#c3c2b7";
  const COL = {}; [...D.teams].sort((a, b) => a.id - b.id).forEach((t, i) => COL[t.id] = PAL[i % PAL.length]);
  const n = D.teams.length, nHist = Math.max(1, D.teams[0].hist.length), cols = D.cols;
  const nonPO = D.teams.length - 7;
  const T = 58, RH = (500 - T - 10) / n, Y = r => T + (r - 1) * RH;
  const multi = cols.length > 1;
  const HX0 = 14, HX1 = multi ? 236 : 300, NX0 = HX1 + 8, NX1 = NX0 + 156, FX0 = NX1 + 8, FX1 = 664;
  const hx = w => nHist === 1 ? (HX0 + HX1) / 2 : HX0 + (w - 1) * (HX1 - HX0) / (nHist - 1);
  const fx = i => FX0 + (i + 1) * (FX1 - FX0) / cols.length;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
  const txt = (x, y, s, o) => { const e = el("text", Object.assign({ x, y, "font-size": 11, fill: MUT }, o || {})); e.textContent = s; return e; };
  const curve = pts => pts.slice(1).map((p, i) => { const [x0, y0] = pts[i], [x1, y1] = p, mx = (x0 + x1) / 2; return ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`; }).join("");
  const edges = (cur, q, lo, hi) => { let a = cur, b = cur; const top = [[FX0, Y(cur)]], bot = [[FX0, Y(cur)]];
    q.forEach((v, i) => { a = Math.min(a, v[lo]); b = Math.max(b, v[hi]); top.push([fx(i), Y(a)]); bot.push([fx(i), Y(b)]); });
    return [top, bot]; };
  const band = (cur, q, lo, hi) => { const [top, b0] = edges(cur, q, lo, hi), bot = b0.slice().reverse();
    return `M${top[0]}${curve(top)} L${bot[0]}${curve(bot)}Z`; };

  svg.innerHTML = "";
  const defs = el("defs", {});
  txt((HX0 + HX1) / 2, 14, tx.hist, { "text-anchor": "middle", "font-size": 12 });
  txt(NX0 + 4, 14, tx.now(D.last_week), { "font-size": 12 });
  txt((FX0 + FX1) / 2, 14, tx.out, { "text-anchor": "middle", "font-size": 12 });
  const step = nHist > 10 ? 2 : 1;
  for (let w = 1; w <= nHist; w++) if ((w - 1) % step === 0 || w === nHist) txt(hx(w), T - 22, "W" + w, { "text-anchor": "middle" });
  cols.forEach((c, i) => txt(fx(i), T - 22, c === "Draft" ? tx.draft : c, { "text-anchor": i === cols.length - 1 ? "end" : "middle", "font-weight": c === "Draft" ? 600 : 400 }));
  for (let r = 1; r <= n; r++) {
    el("line", { x1: HX0, x2: HX1, y1: Y(r), y2: Y(r), stroke: GRID, "stroke-width": 1 });
    el("line", { x1: FX0, x2: FX1, y1: Y(r), y2: Y(r), stroke: GRID, "stroke-width": 1 });
  }
  const yd = (Y(nonPO) + Y(nonPO + 1)) / 2;
  el("line", { x1: HX0, x2: FX1, y1: yd, y2: yd, stroke: BASE, "stroke-width": 1, "stroke-dasharray": "2 3" });

  const cur = t => t.hist[t.hist.length - 1];
  const order = [...D.teams].sort((a, b) => cur(a) - cur(b));
  [order.filter(t => !DPT_SEL.has(t.id)), order.filter(t => DPT_SEL.has(t.id))].forEach((list, li) => list.forEach((t, k) => {
    const on = li === 1, c = on ? COL[t.id] : GRAY, y0 = cur(t);
    if (t.fixed) {
      el("line", { x1: FX0, x2: FX1, y1: Y(y0), y2: Y(t.q[t.q.length - 1][3]), stroke: c, "stroke-width": on ? 2 : 1, "stroke-opacity": on ? 1 : .7 });
      el("circle", { cx: FX1, cy: Y(t.q[t.q.length - 1][3]), r: on ? 4 : 3, fill: c });
    } else {
      el("path", { d: band(y0, t.q, 0, 6), fill: c, "fill-opacity": on ? .08 : .02 });
      el("path", { d: band(y0, t.q, 1, 5), fill: c, "fill-opacity": on ? .13 : .035 });
      el("path", { d: band(y0, t.q, 2, 4), fill: c, "fill-opacity": on ? .22 : .05 });
      const gid = `dpt${li}_${k}`, gr = el("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: FX0, x2: FX1, y1: 0, y2: 0 }, defs);
      el("stop", { offset: "0", "stop-color": c, "stop-opacity": on ? .9 : .45 }, gr);
      el("stop", { offset: "1", "stop-color": c, "stop-opacity": on ? .2 : .1 }, gr);
      edges(y0, t.q, 0, 6).forEach(p => el("path", { d: `M${p[0]}${curve(p)}`, fill: "none", stroke: `url(#${gid})`, "stroke-width": on ? 1.5 : 1, "stroke-dasharray": "4 3" }));
    }
    el("path", { d: "M" + t.hist.map((r, i) => `${hx(i + 1)},${Y(r)}`).join("L") + `L${NX0},${Y(y0)}`, fill: "none", stroke: c,
                 "stroke-width": on ? 2 : 1, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-opacity": on ? 1 : .7 });
    el("line", { x1: NX1, x2: FX0, y1: Y(y0), y2: Y(y0), stroke: c, "stroke-width": on ? 2 : 1, "stroke-opacity": on ? 1 : .7 });
  }));
  order.forEach(t => {
    const on = DPT_SEL.has(t.id), r = cur(t), g = el("g", { style: "cursor:pointer" });
    el("rect", { x: NX0, y: Y(r) - 11, width: NX1 - NX0, height: 22, rx: 4, fill: on ? COL[t.id] : "transparent", "fill-opacity": on ? .14 : 0 }, g);
    el("rect", { x: NX0 + 4, y: Y(r) - 4, width: 8, height: 8, rx: 2, fill: on ? COL[t.id] : GRAY }, g);
    const a = el("text", { x: NX0 + 34, y: Y(r) + 4, "text-anchor": "end", "font-size": 12, fill: MUT }, g); a.textContent = r + ".";
    const b = el("text", { x: NX0 + 40, y: Y(r) + 4, "font-size": 12, "font-weight": on ? 600 : 400, fill: on ? TXT : MUT }, g); b.textContent = t.short;
    const ti = el("title", {}, g); ti.textContent = t.name;
    g.onclick = () => { DPT_SEL.has(t.id) ? DPT_SEL.delete(t.id) : DPT_SEL.add(t.id); dptDraw(svg, D, tx); };
  });
}
