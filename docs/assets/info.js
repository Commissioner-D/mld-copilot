// Erklaerung der Auswertung (DE/EN). Parameter muessen zu worker/src/evaluate.js passen.
const EVAL = { w: 0.5, zTendency: 1.28, zClear: 1.96 };

// Noetiger Vorsprung (Stimmen Mehrheit minus Gegenseite) fuer eine Stufe bei gegebenem n_eff
function neededLead(z, nEff) { return nEff > 0 ? Math.ceil(z * Math.sqrt(nEff) + 1 - 1e-9) : Infinity; }

function leadLine(r) {
  const lead = Math.abs(r.plus - r.minus);
  const tend = neededLead(EVAL.zTendency, r.n_eff), clear = neededLead(EVAL.zClear, r.n_eff);
  return LANG === "de"
    ? `Vorsprung ${lead} ${lead === 1 ? "Stimme" : "Stimmen"} · Tendenz ab ${tend} · klares Urteil ab ${clear}`
    : `Lead ${lead} ${lead === 1 ? "vote" : "votes"} · leaning from ${tend} · clear from ${clear}`;
}

function exampleRows() {
  // 14 Stimmberechtigte: alle stimmen ab / die Haelfte schweigt
  const cases = [[14, 0], [10, 4], [7, 7]];
  return cases.map(([v, e]) => {
    const n = v + EVAL.w * e;
    return `<tr><td>${v}</td><td>${e}</td><td>${neededLead(EVAL.zTendency, n)}</td><td>${neededLead(EVAL.zClear, n)}</td></tr>`;
  }).join("");
}

const INFO = {
  de: {
    short: `<ol>
      <li><b>Richtung zählt, nicht die Stärke:</b> Für das Urteil zählt nur, ob jemand Team A, Team B oder „fair“ sagt.</li>
      <li><b>Vorsprung:</b> Stimmen für die eine Seite minus Stimmen für die andere. Eine einzelne Stimme Vorsprung zählt nie, das kann Zufall sein.</li>
      <li><b>„Fair“ und Schweigen machen die Hürde höher:</b> Je mehr Leute „fair“ sagen oder nicht abstimmen, desto größer muss der Vorsprung sein. Schweigen zählt dabei halb so viel wie ein bewusstes „fair“.</li>
      <li><b>Urteil:</b> Reicht der Vorsprung, gibt es eine <i>Tendenz</i>, ist er sehr groß, einen <i>klaren Vorteil</i>. Sonst: <i>kein klares Bild</i>.</li>
      <li><b>Stärke:</b> die mittlere Stimme der Mehrheitsseite (leicht/deutlich/klar). Einzelne Ausreißer verschieben sie nicht.</li></ol>`,
    page: () => `<h2>So funktioniert der MLD-Copilot</h2>
      <h3>Trade-Abstimmungen</h3>
      <p>Jeder neue Trade wird automatisch zur Abstimmung gestellt (stündlicher Check). Die Frage lautet: <i>Wer hat aus Sicht seines eigenen Teams den besseren Deal gemacht?</i> Es gibt 7 Stufen von „Team A klar“ über „fair“ bis „Team B klar“.</p>
      <ul><li>Abstimmen dürfen alle außer den beiden beteiligten Teams. Die sehen den Stand sofort und dürfen kommentieren.</li>
      <li>Den Stand und die Kommentare siehst du erst, wenn du selbst abgestimmt hast. Vorher nur die Restzeit.</li>
      <li>Stimmen sind <b>endgültig</b>. Sonst könnte man den Zwischenstand ansehen und dann taktisch umschwenken.</li>
      <li>Die Abstimmung endet nach 24 Stunden oder sobald alle abgestimmt haben. Sie ist ein Meinungsbild, kein Veto.</li></ul>
      <h3>So wird ausgewertet</h3>${INFO.de.short}
      <p>Nötiger Vorsprung bei 14 Stimmberechtigten:</p>
      <table class="info-table"><tr><th>Stimmen</th><th>Nicht abgestimmt</th><th>Tendenz ab</th><th>Klares Urteil ab</th></tr>${exampleRows()}</table>
      <p class="meta">Beispiel: 11 sagen Team B, 3 sagen Team A, alle haben abgestimmt. Vorsprung 8: das reicht für eine Tendenz, aber nicht für ein klares Urteil.</p>
      <details><summary>Für Neugierige: die Formel</summary>
      <p>Gewichteter Vorzeichentest:</p>
      <p class="formula">n<sub>eff</sub> = Plus + Minus + Fair + ½ · Nicht-Abstimmende<br>z = (|Plus − Minus| − 1) / √n<sub>eff</sub></p>
      <p>Tendenz ab |z| ≥ ${EVAL.zTendency.toString().replace(".", ",")}, klares Urteil ab |z| ≥ ${EVAL.zClear.toString().replace(".", ",")}. Die Frage dahinter: Wie wahrscheinlich wäre so ein einseitiges Ergebnis, wenn alle nur eine Münze geworfen hätten? Ist es sehr unwahrscheinlich, steckt eine echte Meinung dahinter.</p></details>
      <h3>Tragweite</h3>
      <p>Jeder Trade bekommt eine <b>Tragweite</b>: ●○○ gering, ●●○ mittel oder ●●● hoch. Sie sagt nur, wie viel Wert insgesamt bewegt wird, <i>nicht</i>, wer gewonnen hat. Ein später 3rd gegen einen Ersatzspieler ist klein, zwei 1sts gegen einen Top-WR ist groß.</p>
      <ul><li>Gemessen wird die wertvollere Seite, in „frühen 1sts“. Ab etwa einem späten 1st ist die Tragweite mittel, ab etwa einem frühen 1st hoch.</li>
      <li><b>Picks:</b> nach dem, was aus MLD-Picks seit 2020 tatsächlich geworden ist. Für den nächsten Draft zählt die Prognose (früh/mittel/spät).</li>
      <li><b>Offensive:</b> Dynasty-Marktwerte (DynastyProcess), angepasst an unsere Wertung mit wenig PPR.</li>
      <li><b>IDP:</b> aus unserer Wertung berechnet (Punkte über dem Ersatzmann), Reihenfolge nach Dynasty-Konsens. Maßstab: der beste LB ist etwa einen späten 1st wert.</li>
      <li>Die Tragweite wird beim Trade festgehalten und ändert sich danach nicht mehr. Bei hoher Tragweite schaut der Commish genauer hin, wenn die Abstimmung klar ausfällt.</li></ul>
      <h3>Umfragen</h3>
      <ul><li>Umfragen startet nur der Commish: Ja / Enthaltung / Nein oder Auswahl aus Optionen.</li>
      <li>Pro Umfrage ist festgelegt, ob sie <b>anonym</b> ist und wann man das Ergebnis sieht: jederzeit, nach der eigenen Stimme oder erst am Ende.</li>
      <li><b>Anonym heißt wirklich anonym:</b> Gespeichert wird nur, <i>dass</i> du abgestimmt hast, getrennt davon <i>was</i>, ohne Verbindung. Auch der Commish kann das nicht zuordnen.</li>
      <li><b>Mehrheit</b> (einfach, 2/3 oder einstimmig) zählt nur Ja und Nein. Enthaltungen sind neutral. Ein Quorum legt fest, wie viele mindestens teilnehmen müssen.</li>
      <li>Eine Umfrage endet nach Ablauf der Zeit, wenn alle abgestimmt haben, oder sobald eine festgelegte Zahl an Ja- oder Nein-Stimmen erreicht ist.</li>
      <li>Auch hier gilt: Stimmen sind endgültig.</li></ul>
      <h3>Dein Link</h3>
      <p>Jeder Manager bekommt einen persönlichen Link. Nicht weitergeben, er ist deine Stimme. Verloren oder versehentlich geteilt? Der Commish stellt einen neuen aus, der alte ist dann ungültig.</p>`,
  },
  en: {
    short: `<ol>
      <li><b>Direction counts, not strength:</b> for the verdict, only Team A, Team B or "fair" matters.</li>
      <li><b>Lead:</b> votes for one side minus votes for the other. A lead of one vote never counts, that could be chance.</li>
      <li><b>"Fair" and silence raise the bar:</b> the more people say "fair" or don't vote, the bigger the lead must be. Not voting counts half as much as a deliberate "fair".</li>
      <li><b>Verdict:</b> a big enough lead gives a <i>leaning</i>, a very big one a <i>clear edge</i>. Otherwise: <i>no clear picture</i>.</li>
      <li><b>Strength:</b> the middle vote of the majority side (slight/solid/clear). Single outliers don't move it.</li></ol>`,
    page: () => `<h2>How MLD-Copilot works</h2>
      <h3>Trade votes</h3>
      <p>Every new trade is put to a vote automatically (hourly check). The question: <i>Who got the better deal from their own team's point of view?</i> There are 7 steps from "Team A clearly" via "fair" to "Team B clearly".</p>
      <ul><li>Everyone except the two teams involved can vote. They see the standing right away and can comment.</li>
      <li>You only see the standing and comments after you've voted. Before that, just the time left.</li>
      <li>Votes are <b>final</b>, otherwise you could peek at the standing and then switch tactically.</li>
      <li>Voting ends after 24 hours or once everyone has voted. It's a poll of opinion, not a veto.</li></ul>
      <h3>How it's evaluated</h3>${INFO.en.short}
      <p>Lead needed with 14 eligible voters:</p>
      <table class="info-table"><tr><th>Votes</th><th>Not voted</th><th>Leaning from</th><th>Clear from</th></tr>${exampleRows()}</table>
      <p class="meta">Example: 11 say Team B, 3 say Team A, everyone voted. A lead of 8 is enough for a leaning, not for a clear verdict.</p>
      <details><summary>For the curious: the formula</summary>
      <p>Weighted sign test:</p>
      <p class="formula">n<sub>eff</sub> = Plus + Minus + Fair + ½ · Not voted<br>z = (|Plus − Minus| − 1) / √n<sub>eff</sub></p>
      <p>Leaning from |z| ≥ ${EVAL.zTendency}, clear from |z| ≥ ${EVAL.zClear}. The idea: how likely would such a one-sided result be if everyone just flipped a coin? If very unlikely, there's a real opinion behind it.</p></details>
      <h3>Impact</h3>
      <p>Every trade gets an <b>impact</b>: ●○○ low, ●●○ medium or ●●● high. It only says how much value moves, <i>not</i> who won. A late 3rd for a backup is small, two 1sts for a top WR is big.</p>
      <ul><li>Measured is the more valuable side, in "early 1sts". From about a late 1st the impact is medium, from about an early 1st it's high.</li>
      <li><b>Picks:</b> based on what MLD picks since 2020 actually turned into. For the next draft the projection (early/mid/late) counts.</li>
      <li><b>Offense:</b> dynasty market values (DynastyProcess), adjusted to our low-PPR scoring.</li>
      <li><b>IDP:</b> computed from our scoring (points above replacement), ordered by dynasty consensus. Benchmark: the best LB is worth about a late 1st.</li>
      <li>The impact is fixed when the trade comes in. For high-impact trades the commish takes a closer look if the vote is clear.</li></ul>
      <h3>Polls</h3>
      <ul><li>Only the commish starts polls: Yes / Abstain / No, or picking from options.</li>
      <li>Each poll sets whether it's <b>anonymous</b> and when results are shown: always, after your vote, or at the end.</li>
      <li><b>Anonymous means anonymous:</b> only <i>that</i> you voted is stored, separately from <i>what</i>, with no link between them. Not even the commish can match them.</li>
      <li><b>Majority</b> (simple, 2/3 or unanimous) counts only yes and no. Abstentions are neutral. A quorum sets the minimum turnout.</li>
      <li>A poll ends when time runs out, when everyone has voted, or when a set number of yes or no votes is reached.</li>
      <li>Votes are final here too.</li></ul>
      <h3>Your link</h3>
      <p>Every manager gets a personal link. Don't share it, it's your vote. Lost it or shared it by accident? The commish issues a new one and the old one stops working.</p>`,
  },
};
