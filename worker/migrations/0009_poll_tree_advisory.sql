-- Unteroptionen (Entscheidungsbaum) bei Einfachauswahl: JSON-Array parallel zu options,
-- pro Hauptoption null oder Liste von Unteroptionen.
ALTER TABLE polls ADD COLUMN suboptions TEXT;
-- Stimmungsbild: nicht bindend, kein "angenommen/abgelehnt"
ALTER TABLE polls ADD COLUMN advisory INTEGER NOT NULL DEFAULT 0;
