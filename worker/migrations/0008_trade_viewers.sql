-- Test-Trade: mehrere Manager koennen ihn sehen. trades.only_for ist jetzt nur noch die Markierung
-- "eingeschraenkt" (1), wer ihn sehen darf, steht in trade_viewers.
CREATE TABLE trade_viewers (
  trade_id    INTEGER NOT NULL,
  manager_id  INTEGER NOT NULL,
  PRIMARY KEY (trade_id, manager_id)
);
INSERT INTO trade_viewers (trade_id, manager_id) SELECT id, only_for FROM trades WHERE only_for IS NOT NULL;
UPDATE trades SET only_for = 1 WHERE only_for IS NOT NULL;
