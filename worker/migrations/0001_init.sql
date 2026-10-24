-- MLD-Copilot: Grundschema

CREATE TABLE managers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id   INTEGER NOT NULL,
  team_id     INTEGER NOT NULL,          -- Fleaflicker-Team-ID
  team_name   TEXT NOT NULL,
  owner_name  TEXT,
  token_hash  TEXT UNIQUE,               -- SHA-256 des persoenlichen Tokens
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  UNIQUE (league_id, team_id)
);

CREATE TABLE trades (
  id          INTEGER PRIMARY KEY,       -- Fleaflicker-Trade-ID
  league_id   INTEGER NOT NULL,
  status      TEXT,
  description TEXT,
  sides       TEXT NOT NULL,             -- JSON: [{team_id, team_name, players[], picks[]}, ...]
  team_a      INTEGER NOT NULL,
  team_b      INTEGER NOT NULL,
  opened_at   INTEGER NOT NULL,
  closes_at   INTEGER NOT NULL,
  closed_at   INTEGER,
  hidden      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE trade_votes (
  trade_id    INTEGER NOT NULL,
  manager_id  INTEGER NOT NULL,
  value       INTEGER NOT NULL CHECK (value BETWEEN -3 AND 3),   -- negativ = Team A bevorzugt
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (trade_id, manager_id)
);

CREATE TABLE polls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id     INTEGER NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  kind          TEXT NOT NULL,            -- yesno | single | multi
  options       TEXT,                     -- JSON-Array (single/multi)
  anonymous     INTEGER NOT NULL DEFAULT 0,
  visibility    TEXT NOT NULL,            -- live | after_vote | after_close
  threshold     TEXT,                     -- simple | two_thirds | unanimous (nur yesno)
  quorum        INTEGER,
  end_all_voted INTEGER NOT NULL DEFAULT 1,
  end_yes       INTEGER,
  end_no        INTEGER,
  trade_id      INTEGER,
  opened_at     INTEGER NOT NULL,
  closes_at     INTEGER,
  closed_at     INTEGER
);

-- Wer hat abgestimmt (ohne Inhalt)
CREATE TABLE poll_ballots (
  poll_id     INTEGER NOT NULL,
  manager_id  INTEGER NOT NULL,
  PRIMARY KEY (poll_id, manager_id)
);

-- Was wurde abgestimmt. Bei anonymen Umfragen ohne manager_id und ohne Zeitstempel,
-- zufaellige ID: keine Verbindung zum Stimmzettel herstellbar.
CREATE TABLE poll_votes (
  id          TEXT PRIMARY KEY,
  poll_id     INTEGER NOT NULL,
  manager_id  INTEGER,
  choice      TEXT NOT NULL               -- JSON
);

CREATE TABLE comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target      TEXT NOT NULL,              -- trade | poll
  target_id   INTEGER NOT NULL,
  manager_id  INTEGER,                    -- NULL bei anonymen Umfragen
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_comments_target ON comments (target, target_id);
CREATE INDEX idx_poll_votes_poll ON poll_votes (poll_id);

CREATE TABLE meta (
  k TEXT PRIMARY KEY,
  v TEXT
);
