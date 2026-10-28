-- Testphase (2. Mal): Stimme der Tegetthoff Admirals beim Trade 10523470 zuruecksetzen
DELETE FROM trade_votes
WHERE trade_id = 10523470
  AND manager_id IN (SELECT id FROM managers WHERE league_id = 294292 AND team_id = 1476731);
