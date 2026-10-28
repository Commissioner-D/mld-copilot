"""Werte fuer die Trade-Tragweite (Groesse eines Trades) berechnen -> data/values.json

Einheit: 1,0 = ein frueher 1st (Pick 1.01-1.04 im 16er-Draft). Misst NUR die Groesse,
nicht wer gewonnen hat.

Quellen
- Picks: MLD-Rookie-Drafts 2020-25 (480 Picks), heutiger Wert der gezogenen Spieler,
  Flop = 0 (wird gedroppt). Kurve a/(x+b)+c, Parameter unten (gefittet 2026-10-28).
- Offensive: DynastyProcess values.csv (1QB), umgerechnet auf frueher 1st = 1,0 und mit
  einem Faktor je Position an die MLD-Wertung angepasst (0,1 PPR statt voll PPR).
- IDP: Anker "bester LB = spaeter 1st" (Commish-Einschaetzung), Niveau der anderen Positionen
  und Abfall nach Rang aus der MLD-Wertung (Punkte ueber Ersatzmann, letzte volle Saison),
  Reihenfolge innerhalb der Position aus dem FantasyPros-Dynasty-Konsens.
"""
import csv, io, json, re, statistics as st, sys, urllib.request
from datetime import datetime, timezone

DP_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv"
FP_URL = "https://raw.githubusercontent.com/Commissioner-D/mld-trade-calculator/main/data/fantasypros_dynasty_rankings_{y}.json"
LEAGUE_URL = "https://raw.githubusercontent.com/Commissioner-D/mld-free-agents/data/data/league.json"
NFLV_URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{y}.csv"

TEAMS = 16
PICK_CURVE = (16.24, 3.935, -0.171)   # Wert(Pick) = a/(Pick+b)+c, Flop=0
EARLY_FIRST_DP = 4182                 # DynastyProcess "2027 Early 1st"
ANCHOR_SLOT = 14.5                    # "bester LB = spaeter 1st"
THRESHOLDS = [0.3, 1.0]               # klein < 0,3 <= mittel < 1,0 <= gross
# MLD-Startplaetze ueber die Liga (16 Teams), geteilte Slots als gemeinsame Pools
POOLS = {"LB": ("LB",), "DL": ("EDR", "IL"), "DB": ("S", "CB")}
POOL_START = {"LB": 40, "DL": 34, "DB": 34, "QB": 16, "RB": 38, "WR": 40, "TE": 18}
MLD_IDP = dict(solo=1.5, ast=.75, tfl=1, sack=2, sacky=.25, int=4, inty=.1, ff=3, fr=1, pd=1.5, saf=4)
POS_MAP = {"DE": "EDR", "OLB": "EDR", "DT": "IL", "NT": "IL", "LB": "LB", "ILB": "LB", "MLB": "LB",
           "CB": "CB", "S": "S", "FS": "S", "SS": "S", "SAF": "S", "DB": "S",
           "QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE"}


def norm(n):
    if "," in n:
        l, f = n.split(",", 1); n = f.strip() + " " + l.strip()
    return re.sub(r"[^a-z]", "", re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", n.lower().replace(".", "")))


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "mld-copilot/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        b = r.read()
    return b if binary else b.decode("utf-8")


def pick_rel():
    a, b, c = PICK_CURVE
    v = lambda x: max(a / (x + b) + c, 0.0)
    e = st.mean(v(x) for x in range(1, 5))
    return lambda x: v(x) / e


def main():
    now = datetime.now(timezone.utc)
    rel = pick_rel()
    picks = {}
    for r in range(1, 6):
        slot = lambda s: rel((r - 1) * TEAMS + s)
        picks[r] = {"avg": st.mean(slot(s) for s in range(1, 17)),
                    "early": st.mean(slot(s) for s in range(1, 6)),
                    "mid": st.mean(slot(s) for s in range(6, 12)),
                    "late": st.mean(slot(s) for s in range(12, 17))}
    anchor = rel(ANCHOR_SLOT)

    league = json.loads(get(LEAGUE_URL))
    season = league.get("season") or now.year
    roster = {}                       # norm -> (MLD-Position, fl_id)
    for t in league.get("teams", []):
        for p in t.get("roster", []):
            roster[norm(p["name"])] = (p["pos"], p.get("fl_id"))
    mpos = lambda k, raw: (roster.get(k) or (None,))[0] or POS_MAP.get(raw)

    # --- Punkte je Spiel der letzten vollen Saison, MLD-Wertung und Standard (voll PPR)
    stats = None
    for y in (season - 1, season - 2):
        try:
            stats = list(csv.DictReader(io.StringIO(get(NFLV_URL.format(y=y))))); stat_season = y; break
        except Exception as e:
            print("nflverse", y, e, file=sys.stderr)
    f = lambda r, k: float(r.get(k) or 0)
    def idp_pts(r):
        s = MLD_IDP
        return (s["solo"] * f(r, "def_tackles_solo") + s["ast"] * f(r, "def_tackle_assists") + s["tfl"] * f(r, "def_tackles_for_loss")
                + s["sack"] * f(r, "def_sacks") + s["sacky"] * f(r, "def_sack_yards") + s["int"] * f(r, "def_interceptions")
                + s["inty"] * f(r, "def_interception_yards") + s["ff"] * f(r, "def_fumbles_forced") + s["fr"] * f(r, "fumble_recovery_opp")
                + s["pd"] * f(r, "def_pass_defended") + 6 * f(r, "def_tds") + s["saf"] * f(r, "def_safeties"))
    def off_pts(r, ppr):
        return (0.04 * f(r, "passing_yards") + 4 * f(r, "passing_tds") - 2 * f(r, "passing_interceptions") + 0.1 * f(r, "rushing_yards")
                + 6 * f(r, "rushing_tds") + ppr * f(r, "receptions") + 0.1 * f(r, "receiving_yards") + 6 * f(r, "receiving_tds")
                - f(r, "rushing_fumbles_lost") - f(r, "receiving_fumbles_lost"))
    ppg = {"mld": {}, "std": {}}
    for r in stats:
        g = f(r, "games")
        if g < 8:
            continue
        pos = mpos(norm(r["player_name"]), r["position"])
        if pos in ("QB", "RB", "WR", "TE"):
            ppg["mld"].setdefault(pos, []).append(off_pts(r, 0.1) / g)
            ppg["std"].setdefault(pos, []).append(off_pts(r, 1.0) / g)
        elif pos in ("LB", "EDR", "IL", "S", "CB"):
            ppg["mld"].setdefault(pos, []).append(idp_pts(r) / g)
    def replacement(d, pool):
        members = POOLS.get(pool, (pool,))
        allv = sorted((x for p in members for x in d.get(p, [])), reverse=True)
        return allv[POOL_START[pool]]
    def vorp_list(d, pos):
        pool = next((k for k, v in POOLS.items() if pos in v), pos)
        rep = replacement(d, pool)
        return [max(x - rep, 0) for x in sorted(d.get(pos, []), reverse=True)]
    top5 = lambda d, pos: st.mean(vorp_list(d, pos)[:5])
    # Offensiv-Faktor: Gewicht der Position bei uns vs. voll PPR, relativ zu WR
    off_factor = {p: round((top5(ppg["mld"], p) / top5(ppg["mld"], "WR")) / (top5(ppg["std"], p) / top5(ppg["std"], "WR")), 3)
                  for p in ("QB", "RB", "WR", "TE")}
    idp_top = {p: round(top5(ppg["mld"], p) / top5(ppg["mld"], "LB"), 3) for p in ("LB", "EDR", "IL", "S", "CB")}
    decay = {}
    for p in idp_top:
        v = vorp_list(ppg["mld"], p); top = st.mean(v[:3]) or 1
        decay[p] = [round(min(x / top, 1.2), 4) for x in v if x > 0]

    # --- Spielerwerte
    players = {}
    def put(k, pos, val, src):
        if val <= 0.001:
            val = 0.0
        key = f"{k}|{pos}"
        if key not in players or players[key]["v"] < val:
            players[key] = {"v": round(val, 3), "src": src}

    for r in csv.DictReader(io.StringIO(get(DP_URL))):
        if r["pos"] not in ("QB", "RB", "WR", "TE"):
            continue
        k = norm(r["player"])
        put(k, r["pos"], int(r["value_1qb"]) / EARLY_FIRST_DP * off_factor[r["pos"]], "dp")

    fp = None
    for y in (now.year, now.year - 1):
        try:
            fp = json.loads(get(FP_URL.format(y=y))); break
        except Exception as e:
            print("fp", y, e, file=sys.stderr)
    cnt = {}
    for x in sorted((x for x in fp or [] if x.get("position") in ("LB", "DL", "DB")), key=lambda x: x["rank_ecr"]):
        k = norm(x["name"])
        pos = (roster.get(k) or (None,))[0] or {"LB": "LB", "DL": "EDR", "DB": "S"}[x["position"]]
        if pos not in idp_top:
            continue
        cnt[pos] = cnt.get(pos, 0) + 1
        d = decay[pos]; i = cnt[pos] - 1
        put(k, pos, anchor * idp_top[pos] * (d[i] if i < len(d) else 0), "fp")

    for k, (pos, _) in roster.items():          # Kicker/Punter: bewusst 0, aber "bewertet"
        if pos in ("K", "P"):
            put(k, pos, 0, "k")

    out = {
        "generated_utc": now.strftime("%Y-%m-%d %H:%M"),
        "unit": "fruehe 1st (Pick 1.01-1.04) = 1,0",
        "thresholds": THRESHOLDS,
        "season": season,
        "params": {"anchor_best_lb": round(anchor, 3), "idp_top_rel_lb": idp_top, "off_factor": off_factor,
                   "stat_season": stat_season, "pick_curve": PICK_CURVE},
        "picks": {r: {k: round(v, 3) for k, v in d.items()} for r, d in picks.items()},
        "players": players,
    }
    with open("data/values.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(players)} Spieler, Anker {anchor:.2f}, IDP {idp_top}, Offensive {off_factor}")


if __name__ == "__main__":
    main()
