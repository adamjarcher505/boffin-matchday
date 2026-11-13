-- Local build database. Gitignored; rebuilt from the cache every run.
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE clubs (id TEXT PRIMARY KEY, name TEXT NOT NULL, q TEXT, bd TEXT, note TEXT);
CREATE TABLE club_aliases (alias TEXT NOT NULL, key TEXT NOT NULL, source TEXT, club_id TEXT NOT NULL REFERENCES clubs(id));
CREATE INDEX club_aliases_key ON club_aliases(key);
-- name changes over time; only ok=1 rows are used in questions until a second source confirms the rest
CREATE TABLE club_eras (club_id TEXT NOT NULL, name TEXT NOT NULL, from_date TEXT, to_date TEXT, ok INTEGER DEFAULT 0, src TEXT);
CREATE TABLE venues (club_id TEXT NOT NULL, venue_q TEXT, name TEXT, from_date TEXT, to_date TEXT, src TEXT);
CREATE TABLE seasons (id TEXT PRIMARY KEY, comp TEXT, start INTEGER, label TEXT, official_name TEXT, teams INTEGER, complete INTEGER, q TEXT, played INTEGER);
CREATE TABLE matches (id TEXT PRIMARY KEY, season_id TEXT, date TEXT, round TEXT, home_id TEXT, away_id TEXT, hg INTEGER, ag INTEGER, ht_h INTEGER, ht_a INTEGER,
  status TEXT DEFAULT 'ok',   -- ok | abd (abandoned) | awd (awarded) | ann/voi/exp (annulled, void, expunged): only 'ok' counts in tables
  src TEXT);
CREATE INDEX matches_season ON matches(season_id);
-- og=1: own goal, credited to club_id (the side that benefited) and never to the player as a goal
CREATE TABLE goals (match_id TEXT, club_id TEXT, player_name TEXT, player_key TEXT, minute INTEGER, extra INTEGER, pen INTEGER, og INTEGER, mismatch INTEGER);
CREATE TABLE deductions (season_id TEXT, club_id TEXT, points INTEGER, src TEXT);
CREATE TABLE standings (season_id TEXT, club_id TEXT, pos INTEGER, p INTEGER, w INTEGER, d INTEGER, l INTEGER, gf INTEGER, ga INTEGER, ded INTEGER, pts INTEGER, tie INTEGER);
CREATE TABLE honours (season_id TEXT, club_id TEXT, honour TEXT, src TEXT);
CREATE TABLE players (q TEXT PRIMARY KEY, name TEXT, key TEXT, dob TEXT, birth_year INTEGER, nat_q TEXT, nat TEXT, pos TEXT, bd_idx INTEGER, src TEXT);
CREATE INDEX players_key ON players(key);
CREATE TABLE spells (player_q TEXT, club_q TEXT, club_id TEXT, club_label TEXT, start TEXT, end_date TEXT, kind TEXT, src TEXT);
CREATE INDEX spells_player ON spells(player_q);
CREATE INDEX spells_club ON spells(club_id);
CREATE TABLE fpl_players (id INTEGER PRIMARY KEY, first TEXT, second TEXT, web TEXT, key TEXT, club_id TEXT, pos TEXT, minutes INTEGER, goals INTEGER, status TEXT, player_q TEXT);
-- second sources, used only to check facts (never shipped)
CREATE TABLE verify_wiki (season_id TEXT, club_id TEXT, pos INTEGER, w INTEGER, d INTEGER, l INTEGER, gf INTEGER, ga INTEGER, adj INTEGER, src TEXT);
CREATE TABLE verify_es (season_id TEXT, date TEXT, home_id TEXT, away_id TEXT, hg INTEGER, ag INTEGER);
CREATE INDEX verify_es_m ON verify_es(home_id, away_id, season_id);
CREATE TABLE bd_players (idx INTEGER PRIMARY KEY, name TEXT, key TEXT, birth_year INTEGER, nat TEXT, pos TEXT, fame REAL, spells TEXT);
CREATE INDEX bd_players_key ON bd_players(key);
CREATE TABLE verify_bd_table (season_id TEXT, pos INTEGER, club TEXT, pts INTEGER, gf INTEGER, ga INTEGER);
