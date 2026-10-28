-- Testphase: offene Trades von 72 h auf 24 h Abstimmungszeit kuerzen
UPDATE trades SET closes_at = opened_at + 86400000
WHERE closed_at IS NULL AND closes_at - opened_at > 86400000;
