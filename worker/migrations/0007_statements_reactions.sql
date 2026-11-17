-- Begruendung zur Stimme: erscheint als normaler Kommentar, mit der Stufe, zu der sie abgegeben wurde
-- (nur bei Trade-Stimmen gesetzt, sonst NULL)
ALTER TABLE comments ADD COLUMN vote_value INTEGER;

-- Anonyme, aenderbare Likes/Dislikes unter Kommentaren.
-- Der Schluessel ist SHA-256 aus persoenlichem Token + Kommentar-ID. Ohne den Token laesst er sich keiner Person
-- zuordnen, es gibt keine manager_id und keinen Zeitstempel. Pro Person und Kommentar hoechstens eine Zeile.
CREATE TABLE comment_reactions (
  key         TEXT PRIMARY KEY,
  comment_id  INTEGER NOT NULL,
  value       INTEGER NOT NULL CHECK (value IN (-1, 1))
);
CREATE INDEX idx_comment_reactions_comment ON comment_reactions (comment_id);

-- Test-Trade: nur fuer einen Manager sichtbar (managers.id), NULL = fuer alle. Gibt es bei Fleaflicker nicht.
ALTER TABLE trades ADD COLUMN only_for INTEGER;
