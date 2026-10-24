# mld-copilot

Trade-Abstimmungen, Liga-Umfragen und mehr für die Major League Dynasty.

- **Seite:** https://commissioner-d.github.io/mld-copilot (GitHub Pages aus `docs/`)
- **Admin:** https://commissioner-d.github.io/mld-copilot/admin.html
- **Backend:** Cloudflare Worker + D1 (`worker/`), Deploy per GitHub Actions bei Änderungen in `worker/`

## Ablauf

- Der Worker prüft stündlich Fleaflicker auf Trades „Under Review“ und frisch abgeschlossene Trades
  und öffnet dafür eine Abstimmung (72 h, `TRADE_HOURS`). Admin kann jederzeit manuell prüfen.
- Jeder Manager bekommt einen persönlichen Link (`?k=…`). Der Token wird nur gehasht gespeichert.
- Stimmen sind endgültig. Ohne eigene Stimme sieht man nur die Restzeit, Beteiligte sehen den Stand sofort.

## Trade-Auswertung

Skala −3…+3 (negativ = Team A hat den besseren Deal). Gewichteter Vorzeichentest:

- n_eff = Plus + Minus + Fair + w · Enthaltungen (w = 0,5)
- z = (|Plus − Minus| − 1) / √n_eff
- |z| ≥ 1,96 → klarer Vorteil, |z| ≥ 1,28 → Tendenz, sonst kein klares Bild
- Stärke = Median der Stimmen in Mehrheitsrichtung

Parameter in `worker/src/evaluate.js`.

## Umfragen

Ja/Enthaltung/Nein, eine oder mehrere Optionen. Pro Umfrage einstellbar: anonym, Sichtbarkeit
(jederzeit / nach eigener Stimme / nach Ende), Mehrheit (einfach, 2/3, einstimmig, Basis Ja + Nein),
Quorum, Ende nach Zeit, wenn alle abgestimmt haben oder bei n Ja-/Nein-Stimmen.
Anonyme Stimmen werden ohne Verbindung zur Person gespeichert.

## Secrets (GitHub → Settings → Secrets → Actions)

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`: Deploy
- `COPILOT_ADMIN_KEY`: Passwort für die Admin-Seite

Liga: `LEAGUE_ID` in `worker/wrangler.toml` (Sandkiste 305982, MLD 294292).
Deploy-Status: Branch `status`, Datei `report.txt`.
