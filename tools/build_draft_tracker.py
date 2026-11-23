"""Draft-Pick-Tracker (Test): Verlauf und Prognose der Draft-Slots.

Regel 9.2.1: Teams ohne Playoffs nach umgekehrtem Optimum (PfO) der Regular Season,
Playoff-Teams nach Ausscheide-Runde, innerhalb der Runde nach PfO. Champion zieht zuletzt.

Ausgabe: docs/data/draft_tracker.json (wird von docs/assets/tracker.js gezeichnet).
Laeuft dienstags frueh per GitHub Actions (.github/workflows/draft-tracker.yml).
"""
import json, os, random, statistics as S, time, urllib.error, urllib.request
from collections import defaultdict
from datetime import datetime, timezone

LEAGUE_ID = 294292
REG_WEEKS = 14            # Regel 5: 14 Runden Regular Season
PO_WEEKS = (15, 16, 17)   # Wildcard, Halbfinale, Finale
N_SIM = 4000
QUANT = (.025, .1, .25, .5, .75, .9, .975)
FLEA = "https://www.fleaflicker.com/api"
UA = {"User-Agent": "mld-copilot/1.0"}
NOW = datetime.now(timezone.utc)
SEASON = NOW.year if NOW.month >= 8 else NOW.year - 1
OUT = "docs/data/draft_tracker.json"

SHORT = {"Vienna Seahawks": "Seahawks", "Graz Moeflers": "Moeflers", "Vienna BBB": "BBB",
         "New Fernitz Dudemeisters": "New Fernitz", "Gries Goats": "Gries", "Semmel Warriors": "Semmel",
         "Tegetthoff Admirals": "Tegetthoff", "Graz Trash Pandas": "Trash Pandas",
         "Pumpkin Seed Oilers": "Pumpkin", "Ragnitz Couchpotatos": "Ragnitz", "Romo's Call": "Romo",
         "Mühlviertl Raiders": "Mühlviertl", "Stehbuffet Seagulls": "Stehbuffet", "AlohaHe": "AlohaHe",
         "Purple Cobras": "Cobras", "Styrian Sombreros": "Sombreros"}


def api(path, retries=4):
    for i in range(retries):
        try:
            req = urllib.request.Request(f"{FLEA}/{path}", headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if i == retries - 1:
                raise
            time.sleep(20 * (i + 1) if e.code in (403, 429) else 3)
        except urllib.error.URLError:
            if i == retries - 1:
                raise
            time.sleep(3)


def val(x):
    return (x or {}).get("value") if isinstance(x, dict) else x


# ---------------------------------------------------------------- Daten holen
def fetch():
    st = api(f"FetchLeagueStandings?sport=NFL&league_id={LEAGUE_ID}&season={SEASON}")
    teams, div = {}, {}
    for d in st.get("divisions") or []:
        for t in d.get("teams") or []:
            teams[t["id"]] = t["name"]
            div[t["id"]] = d.get("name") or d.get("id")
    weeks = {}
    for w in range(1, max(PO_WEEKS) + 1):
        sb = api(f"FetchLeagueScoreboard?sport=NFL&league_id={LEAGUE_ID}&season={SEASON}&scoring_period={w}")
        games = []
        for g in sb.get("games") or []:
            games.append({"id": g["id"], "a": g["away"]["id"], "h": g["home"]["id"],
                          "sa": val((g.get("awayScore") or {}).get("score")),
                          "sh": val((g.get("homeScore") or {}).get("score")),
                          "final": bool(g.get("isFinalScore")),
                          "playoff": bool(g.get("isPlayoffs")) and not g.get("isConsolation")})
        weeks[w] = games
        time.sleep(0.4)
    # Optimum je Team und abgeschlossener Regular-Season-Woche (aus dem Boxscore)
    opt = defaultdict(dict)
    done = [w for w in range(1, REG_WEEKS + 1) if weeks[w] and all(g["final"] for g in weeks[w])]
    for w in done:
        for g in weeks[w]:
            bx = api(f"FetchLeagueBoxscore?sport=NFL&league_id={LEAGUE_ID}&fantasy_game_id={g['id']}&scoring_period={w}")
            for side, key in (("a", "pointsAway"), ("h", "pointsHome")):
                opt[g[side]][w] = val(val(((bx.get(key) or {}).get("total") or {}).get("optimum"))) or 0.0
            time.sleep(0.4)
    return teams, div, weeks, done, opt


# ---------------------------------------------------------------- Liga-Logik
class Season:
    def __init__(self, teams, div):
        self.teams, self.div = teams, div
        self.rec = {t: [0, 0, 0, 0, 0] for t in teams}   # S, N, U, Div-S, Div-N
        self.pf = defaultdict(float)
        self.h2h = defaultdict(int)                       # (t, o) -> Siege minus Niederlagen
        self.pfo = defaultdict(float)

    def copy(self):
        c = Season(self.teams, self.div)
        c.rec = {t: r[:] for t, r in self.rec.items()}
        c.pf, c.h2h, c.pfo = defaultdict(float, self.pf), defaultdict(int, self.h2h), defaultdict(float, self.pfo)
        return c

    def play(self, a, h, sa, sh):
        self.pf[a] += sa; self.pf[h] += sh
        for t, o, me, ot in ((a, h, sa, sh), (h, a, sh, sa)):
            r = self.rec[t]
            r[0 if me > ot else 1 if me < ot else 2] += 1
            if self.div[t] == self.div[o] and me != ot:
                r[3 if me > ot else 4] += 1
            if me != ot:
                self.h2h[(t, o)] += 1 if me > ot else -1

    def seeds(self):
        def pct(t):
            r = self.rec[t]; g = r[0] + r[1] + r[2]
            return (r[0] + .5 * r[2]) / g if g else 0

        def ordered(group):
            same_div = len({self.div[x] for x in group}) == 1
            def key(t):
                r = self.rec[t]; g = max(1, r[0] + r[1] + r[2])
                dv = r[3] / max(1, r[3] + r[4]) if same_div else 0
                return (pct(t), dv, sum(self.h2h[(t, o)] for o in group if o != t), self.pf[t] / g)
            return sorted(group, key=key, reverse=True)

        winners = ordered([ordered([t for t in self.teams if self.div[t] == d])[0] for d in set(self.div.values())])
        rest = ordered([t for t in self.teams if t not in winners])
        return winners + rest[:3]

    def slots(self, seeds, elim=None):
        out = {}
        non = sorted([t for t in self.teams if t not in seeds], key=lambda t: self.pfo[t])
        for i, t in enumerate(non):
            out[t] = i + 1
        n = len(non) + 1
        groups = [list(seeds)] if elim is None else \
            [[t for t in seeds if elim.get(t) == r] for r in ("wc", "semi", "final", "champ")]
        for grp in groups:
            for t in sorted(grp, key=lambda t: self.pfo[t]):
                out[t] = n; n += 1
        return out


def quant(a, p):
    a = sorted(a); return a[int(p * (len(a) - 1))]


def main():
    teams, div, weeks, done, opt = fetch()
    ids = sorted(teams)
    base = Season(ids, div)
    hist = {t: [] for t in ids}
    for w in done:
        for g in weeks[w]:
            base.play(g["a"], g["h"], g["sa"] or 0, g["sh"] or 0)
        for t in ids:
            base.pfo[t] += opt[t].get(w, 0)
        s = base.slots(base.seeds())
        for t in ids:
            hist[t].append(s[t])
    last = done[-1] if done else 0

    # Modell: Mischung aus Saisonschnitt und letzten 4 Wochen, Schwankung der Saison
    pts = defaultdict(list)
    for w in done:
        for g in weeks[w]:
            pts[g["a"]].append(g["sa"] or 0); pts[g["h"]].append(g["sh"] or 0)
    def model(series):
        if len(series) < 2:
            return 120.0, 30.0
        m = .5 * S.mean(series) + .5 * S.mean(series[-4:])
        return m, S.stdev(series)
    pm = {t: model(pts[t]) for t in ids}
    om = {t: model([opt[t][w] for w in done]) for t in ids}

    future = [w for w in range(last + 1, REG_WEEKS + 1)]
    cols = [f"W{w}" for w in future] + ["Draft"]
    # bekannte Playoff-Ergebnisse (nur wenn Regular Season fertig)
    po_known = {}
    if not future:
        for w, rnd in zip(PO_WEEKS, ("wc", "semi", "final")):
            for g in weeks.get(w) or []:
                if g["final"] and g["playoff"]:
                    po_known[(rnd, frozenset((g["a"], g["h"])))] = g["a"] if (g["sa"] or 0) > (g["sh"] or 0) else g["h"]

    rng = random.Random(42)
    sims = {t: [[] for _ in cols] for t in ids}
    po_count = defaultdict(int)
    for _ in range(N_SIM):
        s = base.copy()
        for i, w in enumerate(future):
            for g in weeks.get(w) or []:
                s.play(g["a"], g["h"], rng.gauss(*pm[g["a"]]), rng.gauss(*pm[g["h"]]))
            for t in ids:
                s.pfo[t] += rng.gauss(*om[t])
            sl = s.slots(s.seeds())
            for t in ids:
                sims[t][i].append(sl[t])
        seeds = s.seeds()
        for t in seeds:
            po_count[t] += 1
        elim = {t: "champ" for t in seeds}

        def game(rnd, a, b):
            k = (rnd, frozenset((a, b)))
            if k in po_known:
                return po_known[k]
            return a if rng.gauss(*pm[a]) > rng.gauss(*pm[b]) else b

        adv = [seeds[0]]
        for a, b in ((seeds[1], seeds[6]), (seeds[2], seeds[5]), (seeds[3], seeds[4])):
            w_ = game("wc", a, b); adv.append(w_); elim[b if w_ == a else a] = "wc"
        adv = [adv[0]] + sorted(adv[1:], key=seeds.index)
        fin = []
        for a, b in ((adv[0], adv[3]), (adv[1], adv[2])):
            w_ = game("semi", a, b); fin.append(w_); elim[b if w_ == a else a] = "semi"
        w_ = game("final", *fin); elim[fin[1] if w_ == fin[0] else fin[0]] = "final"
        for t, v in s.slots(seeds, elim).items():
            sims[t][-1].append(v)

    out = {"generated_utc": NOW.strftime("%Y-%m-%dT%H:%MZ"), "season": SEASON, "last_week": last,
           "reg_weeks": REG_WEEKS, "cols": cols, "quantiles": list(QUANT), "teams": []}
    for t in ids:
        q = [[quant(c, p) for p in QUANT] for c in sims[t]]
        fixed = all(len(set(c)) == 1 for c in sims[t])
        out["teams"].append({"id": t, "name": teams[t], "short": SHORT.get(teams[t], teams[t]),
                             "hist": hist[t], "q": q, "fixed": fixed,
                             "playoff_share": round(po_count[t] / N_SIM, 3)})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"Saison {SEASON}, letzte fertige Woche {last}, Spalten {cols}")


if __name__ == "__main__":
    main()
