PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;

CREATE TABLE competitions (competition_id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, country TEXT, tier INTEGER);

CREATE TABLE clubs (
  club_id INTEGER PRIMARY KEY, name TEXT, short_name TEXT, three_letter TEXT, nicknames TEXT,
  founded TEXT, ground TEXT, lat REAL, lon REAL, colour1 TEXT, colour2 TEXT,
  fpl_code INTEGER, wikidata_qid TEXT, played_premier_league INTEGER DEFAULT 0
);

CREATE TABLE venues (venue_id INTEGER PRIMARY KEY, wikidata_qid TEXT UNIQUE, name TEXT, lat REAL, lon REAL);
CREATE TABLE club_venues (club_id INTEGER, venue_id INTEGER, PRIMARY KEY (club_id, venue_id));

CREATE TABLE matches (
  match_id INTEGER PRIMARY KEY, competition_id INTEGER, season TEXT, division TEXT, round TEXT,
  date TEXT, kickoff TEXT, home_club_id INTEGER, away_club_id INTEGER,
  home_goals INTEGER, away_goals INTEGER, ht_home INTEGER, ht_away INTEGER,
  venue TEXT, attendance INTEGER, fpl_fixture_id INTEGER, source TEXT
);
CREATE INDEX ix_matches ON matches(competition_id, season, home_club_id, away_club_id);

CREATE TABLE fixtures_upcoming (season TEXT, kickoff TEXT, home_club_id INTEGER, away_club_id INTEGER, gameweek INTEGER, fpl_fixture_id INTEGER);

CREATE TABLE points_deductions (season TEXT, club_id INTEGER, tier INTEGER, points INTEGER);

CREATE TABLE standings (
  competition_id INTEGER, season TEXT, division TEXT, position INTEGER, club_id INTEGER,
  played INTEGER, won INTEGER, drawn INTEGER, lost INTEGER, goals_for INTEGER, goals_against INTEGER,
  points INTEGER, points_deducted INTEGER
);

CREATE TABLE players (
  player_id INTEGER PRIMARY KEY, name TEXT, display_name TEXT, name_norm TEXT, known_as TEXT, dob TEXT, nationality TEXT,
  position TEXT, position_detail TEXT, fpl_code INTEGER, opta_code TEXT, wikidata_qid TEXT
);
CREATE INDEX ix_players_fpl ON players(fpl_code);

CREATE TABLE squads (season TEXT, club_id INTEGER, player_id INTEGER, squad_number INTEGER, position TEXT, source TEXT);
CREATE INDEX ix_squads ON squads(club_id, season);

CREATE TABLE player_clubs (
  player_id INTEGER, club_id INTEGER, club_name TEXT, club_country TEXT, club_wikidata_qid TEXT,
  start_date TEXT, end_date TEXT, apps INTEGER, goals INTEGER, source TEXT
);
CREATE INDEX ix_pc ON player_clubs(player_id);

CREATE TABLE player_season_stats (
  player_id INTEGER, season TEXT, club_id INTEGER,
  minutes REAL, starts REAL, goals_scored REAL, assists REAL, clean_sheets REAL, goals_conceded REAL, own_goals REAL,
  penalties_saved REAL, penalties_missed REAL, yellow_cards REAL, red_cards REAL, saves REAL, bonus REAL,
  total_points REAL, expected_goals REAL, expected_assists REAL, source TEXT,
  PRIMARY KEY (player_id, season)
);

CREATE TABLE appearances (
  match_id INTEGER, player_id INTEGER, club_id INTEGER, minutes INTEGER, started INTEGER,
  goals INTEGER, assists INTEGER, yellow INTEGER, red INTEGER, own_goals INTEGER, saves INTEGER, fpl_points INTEGER, source TEXT,
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX ix_app_player ON appearances(player_id);

CREATE TABLE lineups (match_id INTEGER, club_id INTEGER, player_id INTEGER, player_name_raw TEXT, role TEXT, captain INTEGER, source TEXT);

CREATE TABLE match_events (
  match_id INTEGER, club_id INTEGER, player_id INTEGER, player_name_raw TEXT, event TEXT, minute TEXT,
  count INTEGER, side TEXT, detail TEXT, source TEXT
);
CREATE INDEX ix_ev ON match_events(match_id);
