"""Build football.db for 1X2 from keyless open sources.

Sources (all in raw/):
  jalapic_engsoccerdata  - English league results 1888-2024/25, FA Cup, League Cup, European Cup, club data
  openfootball_football.json - 2025-26 PL results with scorers, lineups and subs; other leagues
  fpl_archive (vaastav)  - Fantasy Premier League per-player per-gameweek data 2016-17 onward
  fpl_live               - official FPL API snapshot for the current season (2026-27)
  wikidata               - PL clubs, grounds with coordinates, player careers, nationality, DOB
"""
import ast, csv, glob, json, os, re, sqlite3, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
DB = os.path.join(ROOT, "football.db")
csv.field_size_limit(10**9)
LOG = []

def log(msg):
    LOG.append(msg)

TRANS = str.maketrans({"ø": "o", "Ø": "O", "æ": "ae", "Æ": "AE", "ß": "ss", "đ": "d", "Đ": "D", "ł": "l", "Ł": "L", "ı": "i", "ð": "d", "þ": "th"})
def norm(s):
    s = (s or "").translate(TRANS)
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " and ").replace("'", "")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def club_key(s):
    s = norm(s)
    s = re.sub(r"\b(f c|fc|a f c|afc|football club)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()

# FPL / openfootball short names -> engsoccerdata canonical names
ALIASES = {
    "man city": "Manchester City", "man utd": "Manchester United", "spurs": "Tottenham Hotspur",
    "tottenham": "Tottenham Hotspur", "nottm forest": "Nottingham Forest", "nott m forest": "Nottingham Forest",
    "nottingham": "Nottingham Forest", "wolves": "Wolverhampton Wanderers", "wolverhampton": "Wolverhampton Wanderers",
    "sheffield utd": "Sheffield United", "sheffield wed": "Sheffield Wednesday", "newcastle": "Newcastle United",
    "brighton": "Brighton & Hove Albion", "brighton and hove albion": "Brighton & Hove Albion",
    "west ham": "West Ham United", "leicester": "Leicester City", "leeds": "Leeds United", "ipswich": "Ipswich Town",
    "luton": "Luton Town", "norwich": "Norwich City", "bournemouth": "AFC Bournemouth", "huddersfield": "Huddersfield Town",
    "cardiff": "Cardiff City", "swansea": "Swansea City", "stoke": "Stoke City", "hull": "Hull City",
    "west brom": "West Bromwich Albion", "coventry": "Coventry City", "birmingham": "Birmingham City",
    "blackburn": "Blackburn Rovers", "bolton": "Bolton Wanderers", "wigan": "Wigan Athletic", "derby": "Derby County",
    "qpr": "Queens Park Rangers", "charlton": "Charlton Athletic", "portsmouth": "Portsmouth", "reading": "Reading",
    "wimbledon": "Wimbledon", "oldham": "Oldham Athletic", "swindon": "Swindon Town", "barnsley": "Barnsley",
    "bradford": "Bradford City", "bradford city": "Bradford City", "blackpool": "Blackpool", "middlesbrough": "Middlesbrough",
    "sunderland": "Sunderland", "southampton": "Southampton", "watford": "Watford", "fulham": "Fulham", "everton": "Everton",
    "chelsea": "Chelsea", "arsenal": "Arsenal", "liverpool": "Liverpool", "burnley": "Burnley", "brentford": "Brentford",
    "crystal palace": "Crystal Palace", "aston villa": "Aston Villa", "stevenage": "Stevenage Borough",
}

def main():
    if os.path.exists(DB):
        os.remove(DB)
    con = sqlite3.connect(DB)
    con.executescript(open(os.path.join(ROOT, "scripts", "schema.sql")).read())
    cur = con.cursor()

    # ---------------- clubs ----------------
    clubs = {}          # canonical name -> club_id
    keymap = {}         # club_key -> club_id
    def add_club(name, **kw):
        k = club_key(name)
        if k in keymap:
            cid = keymap[k]
        elif club_key(ALIASES.get(norm(name), "")) in keymap:
            cid = keymap[club_key(ALIASES[norm(name)])]
        else:
            cur.execute("INSERT INTO clubs(name) VALUES (?)", (name,))
            cid = cur.lastrowid
            clubs[name] = cid
            keymap[k] = cid
        if kw:
            sets = ", ".join(f"{c}=COALESCE({c}, ?)" for c in kw)
            cur.execute(f"UPDATE clubs SET {sets} WHERE club_id=?", (*kw.values(), cid))
        return cid

    def find_club(name, create=True, source=""):
        if not name:
            return None
        k = club_key(name)
        if k in keymap:
            return keymap[k]
        a = ALIASES.get(norm(name)) or ALIASES.get(k)
        if a and club_key(a) in keymap:
            keymap[k] = keymap[club_key(a)]
            return keymap[k]
        if create:
            return add_club(name)
        log(f"unmatched club ({source}): {name}")
        return None

    esd = os.path.join(RAW, "jalapic_engsoccerdata", "data-raw")
    for r in csv.DictReader(open(os.path.join(esd, "england_club_data.csv"), encoding="utf-8", errors="replace")):
        if not r["team"]:
            continue
        na = lambda v: None if v in ("", "NA") else v
        add_club(r["team"], lat=na(r["lat"]) and float(r["lat"]), lon=na(r["lon"]) and float(r["lon"]),
                 founded=na(r["founded"]), ground=na(r["ground"]), short_name=na(r["short_name"]),
                 three_letter=na(r["three_letter_name"]), nicknames=na(r["nicknames"]),
                 colour1=na(r["col1"]), colour2=na(r["col2"]))

    # ---------------- competitions ----------------
    comp_ids = {}
    def comp(code, name, country="England", tier=None):
        if code not in comp_ids:
            cur.execute("INSERT INTO competitions(code,name,country,tier) VALUES (?,?,?,?)", (code, name, country, tier))
            comp_ids[code] = cur.lastrowid
        return comp_ids[code]

    def season_label(start_year):
        y = int(start_year)
        return f"{y}-{str(y+1)[-2:]}"

    def add_match(comp_code, season, date, home, away, hg, ag, source, **kw):
        h = find_club(home, source=source)
        a = find_club(away, source=source)
        cols = ["competition_id", "season", "date", "home_club_id", "away_club_id", "home_goals", "away_goals", "source"]
        vals = [comp_ids[comp_code], season, date, h, a, hg, ag, source]
        for k, v in kw.items():
            cols.append(k); vals.append(v)
        cur.execute(f"INSERT INTO matches({','.join(cols)}) VALUES ({','.join('?'*len(cols))})", vals)
        return cur.lastrowid

    def ival(v):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None

    # English league 1888 - 2024/25
    tier_names = {1: "First Division / Premier League", 2: "Second tier", 3: "Third tier", 4: "Fourth tier"}
    for t, n in tier_names.items():
        comp(f"ENG{t}", n, tier=t)
    for r in csv.DictReader(open(os.path.join(esd, "england.csv"), encoding="utf-8", errors="replace")):
        t = int(r["tier"])
        add_match(f"ENG{t}", season_label(r["Season"]), r["Date"], r["home"], r["visitor"],
                  ival(r["hgoal"]), ival(r["vgoal"]), "engsoccerdata", division=r["division"])
    comp("FAC", "FA Cup"); comp("LC", "League Cup"); comp("EC", "European Cup / Champions League", country="Europe")
    comp("PO", "Play-offs")
    for r in csv.DictReader(open(os.path.join(esd, "facup.csv"), encoding="utf-8", errors="replace")):
        add_match("FAC", season_label(r["Season"]), r["Date"], r["home"], r["visitor"], ival(r["hgoal"]), ival(r["vgoal"]),
                  "engsoccerdata", round=r["round"], venue=None if r["Venue"] == "NA" else r["Venue"],
                  attendance=ival((r["attendance"] or "").replace(",", "")))
    for r in csv.DictReader(open(os.path.join(esd, "leaguecup.csv"), encoding="utf-8", errors="replace")):
        add_match("LC", season_label(r["Season"]), r["Date"], r["home"], r["visitor"], ival(r["hgoal"]), ival(r["vgoal"]),
                  "engsoccerdata", round=r["round"])
    for r in csv.DictReader(open(os.path.join(esd, "englandplayoffs.csv"), encoding="utf-8", errors="replace")):
        add_match("PO", season_label(r["Season"]), r["Date"], r["home"], r["visitor"], ival(r["hgoal"]), ival(r["vgoal"]),
                  "engsoccerdata", round=r["round"])
    for r in csv.DictReader(open(os.path.join(esd, "champs.csv"), encoding="utf-8", errors="replace")):
        add_match("EC", season_label(r["Season"]), r["Date"], r["home"], r["visitor"], ival(r["hgoal"]), ival(r["vgoal"]),
                  "engsoccerdata", round=r["round"])
    for r in csv.DictReader(open(os.path.join(esd, "deductions.csv"), encoding="utf-8", errors="replace")):
        if r["country"] == "England":
            cur.execute("INSERT INTO points_deductions(season, club_id, tier, points) VALUES (?,?,?,?)",
                        (season_label(r["Season"]), find_club(r["team"]), ival(r["tier"]), ival(r["deduction"])))

    # openfootball: English leagues 2025-26 onward (engsoccerdata stops at 2024-25)
    of = os.path.join(RAW, "openfootball_football.json")
    of_full = {}
    for season_dir in sorted(glob.glob(os.path.join(of, "20??-??"))):
        season = os.path.basename(season_dir)
        for tier in (1, 2, 3, 4):
            if season < "2025-26" and cur.execute("SELECT 1 FROM matches WHERE competition_id=? AND season=? LIMIT 1",
                                                   (comp_ids[f"ENG{tier}"], season)).fetchone():
                continue
            f = os.path.join(season_dir, f"en.{tier}.json")
            full = os.path.join(season_dir, f"en.{tier}-full.json")
            if os.path.exists(full):
                f = full
            if not os.path.exists(f):
                continue
            for m in json.load(open(f))["matches"]:
                score = m.get("score") or {}
                if isinstance(score, list):
                    score = {"ft": score}
                m["score"] = score
                sc = score.get("ft")
                if not sc:
                    continue
                if season == "2026-27" and tier == 1:
                    continue  # current PL season comes from the official FPL feed below
                mid = add_match(f"ENG{tier}", season, m["date"], m["team1"], m["team2"], sc[0], sc[1], "openfootball",
                                round=m.get("round"), venue=m.get("ground"), attendance=m.get("attendance"),
                                ht_home=(m["score"].get("ht") or [None, None])[0], ht_away=(m["score"].get("ht") or [None, None])[1])
                if "lineup" in m or "goals1" in m:
                    of_full[mid] = m

    # ---------------- players ----------------
    players_by_fpl = {}   # FPL persistent code -> player_id
    players_by_qid = {}
    def add_player(name, **kw):
        cur.execute("INSERT INTO players(name, name_norm) VALUES (?,?)", (name, norm(name)))
        pid = cur.lastrowid
        if kw:
            sets = ", ".join(f"{c}=?" for c in kw)
            cur.execute(f"UPDATE players SET {sets} WHERE player_id=?", (*kw.values(), pid))
        return pid

    # FPL live (current season, has birth dates)
    live = os.path.join(RAW, "fpl_live")
    boot = json.load(open(os.path.join(live, "bootstrap.json")))
    pos_map = {t["id"]: t["singular_name"] for t in boot["element_types"]}
    live_team = {}
    for t in boot["teams"]:
        cid = find_club(t["name"], source="fpl")
        cur.execute("UPDATE clubs SET fpl_code=COALESCE(fpl_code, ?) WHERE club_id=?", (t["code"], cid))
        live_team[t["id"]] = cid
    live_el = {}
    for e in boot["elements"]:
        full = f'{e["first_name"]} {e["second_name"]}'.strip()
        pid = add_player(full, known_as=e["web_name"], fpl_code=e["code"], dob=e.get("birth_date"),
                         position=pos_map.get(e["element_type"]), opta_code=e.get("opta_code"))
        players_by_fpl[e["code"]] = pid
        live_el[e["id"]] = pid
        cur.execute("""INSERT INTO squads(season, club_id, player_id, squad_number, position, source)
                       VALUES ('2026-27',?,?,?,?, 'fpl')""", (live_team[e["team"]], pid, e.get("squad_number"), pos_map.get(e["element_type"])))

    stat_cols = ["minutes", "starts", "goals_scored", "assists", "clean_sheets", "goals_conceded", "own_goals",
                 "penalties_saved", "penalties_missed", "yellow_cards", "red_cards", "saves", "bonus", "total_points",
                 "expected_goals", "expected_assists"]

    def fnum(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    # Per-season totals back as far as FPL goes (history_past) for current players
    for el_id, pid in live_el.items():
        p = json.load(open(os.path.join(live, "players", f"{el_id}.json")))
        for h in p["history_past"]:
            season = h["season_name"].replace("/", "-")
            cur.execute(f"""INSERT OR IGNORE INTO player_season_stats(player_id, season, club_id, {','.join(stat_cols)}, source)
                            VALUES (?,?,NULL,{','.join('?'*len(stat_cols))}, 'fpl_history')""",
                        (pid, season, *[fnum(h.get(c)) for c in stat_cols]))

    # FPL archive 2016-17 .. 2025-26: player list, per-gameweek appearances, fixtures
    arch = os.path.join(RAW, "fpl_archive", "data")
    for sdir in sorted(glob.glob(os.path.join(arch, "20??-??"))):
        season = os.path.basename(sdir)
        if season == "2026-27":
            continue  # live feed is the source for the current season
        teams = {}
        tf = os.path.join(sdir, "teams.csv")
        if os.path.exists(tf):
            for t in csv.DictReader(open(tf, encoding="utf-8", errors="replace")):
                cid = find_club(t["name"], source="fpl_archive")
                cur.execute("UPDATE clubs SET fpl_code=COALESCE(fpl_code, ?) WHERE club_id=?", (ival(t["code"]), cid))
                teams[ival(t["id"])] = cid
        else:
            for t in csv.DictReader(open(os.path.join(arch, "master_team_list.csv"), encoding="utf-8", errors="replace")):
                if t["season"] == season:
                    teams[ival(t["team"])] = find_club(t["team_name"], source="fpl_archive")
        el = {}
        for r in csv.DictReader(open(os.path.join(sdir, "players_raw.csv"), encoding="utf-8", errors="replace")):
            code = ival(r["code"])
            pid = players_by_fpl.get(code)
            full = f'{r["first_name"]} {r["second_name"]}'.strip()
            if pid is None:
                pid = add_player(full, known_as=r.get("web_name"), fpl_code=code,
                                 position=pos_map.get(ival(r["element_type"])))
                players_by_fpl[code] = pid
            el[ival(r["id"])] = pid
            cid = teams.get(ival(r["team"]))
            cur.execute("""INSERT INTO squads(season, club_id, player_id, squad_number, position, source)
                           VALUES (?,?,?,?,?,'fpl_archive')""", (season, cid, pid, ival(r.get("squad_number")), pos_map.get(ival(r["element_type"]))))
            cur.execute(f"""INSERT OR REPLACE INTO player_season_stats(player_id, season, club_id, {','.join(stat_cols)}, source)
                            VALUES (?,?,?,{','.join('?'*len(stat_cols))}, 'fpl_archive')""",
                        (pid, season, cid, *[fnum(r.get(c)) for c in stat_cols]))
        # fixtures
        fx = {}
        ff = os.path.join(sdir, "fixtures.csv")
        if os.path.exists(ff):
            for r in csv.DictReader(open(ff, encoding="utf-8", errors="replace")):
                fx[ival(r["id"])] = r
        gw = os.path.join(sdir, "gws", "merged_gw.csv")
        if not fx and os.path.exists(gw):
            pteam = {ival(r["id"]): ival(r["team"]) for r in csv.DictReader(open(os.path.join(sdir, "players_raw.csv"), encoding="utf-8", errors="replace"))}
            votes = defaultdict(lambda: defaultdict(int))
            info = {}
            for r in csv.DictReader(open(gw, encoding="utf-8", errors="replace")):
                fid = ival(r["fixture"]); own = pteam.get(ival(r["element"])); opp = ival(r["opponent_team"])
                home = r["was_home"] in ("True", "true", "1")
                votes[fid][(own, opp) if home else (opp, own)] += 1
                info[fid] = r
            for fid, v in votes.items():
                (h, a), _ = max(v.items(), key=lambda kv: kv[1])
                fx[fid] = {"id": fid, "team_h": h, "team_a": a, "kickoff_time": info[fid]["kickoff_time"], "stats": None}
        # map FPL fixture -> our match row (engsoccerdata / openfootball) by date + teams
        fx_match = {}
        for fid, r in fx.items():
            h, a = teams.get(ival(r["team_h"])), teams.get(ival(r["team_a"]))
            row = cur.execute("""SELECT match_id FROM matches WHERE competition_id=? AND season=? AND home_club_id=? AND away_club_id=?""",
                              (comp_ids["ENG1"], season, h, a)).fetchone()
            if row:
                fx_match[fid] = row[0]
                cur.execute("UPDATE matches SET fpl_fixture_id=?, kickoff=? WHERE match_id=?", (fid, r["kickoff_time"], row[0]))
            else:
                log(f"FPL fixture not matched {season} {fid}")
            add_fixture_events(cur, fx_match.get(fid), r.get("stats"), el)
        gw = os.path.join(sdir, "gws", "merged_gw.csv")
        if os.path.exists(gw):
            for r in csv.DictReader(open(gw, encoding="utf-8", errors="replace")):
                pid = el.get(ival(r["element"]))
                fid = ival(r["fixture"])
                f = fx.get(fid)
                if pid is None or f is None:
                    continue
                home = r["was_home"] in ("True", "true", "1")
                cid = teams.get(ival(f["team_h"] if home else f["team_a"]))
                mins = ival(r["minutes"]) or 0
                cur.execute("""INSERT OR IGNORE INTO appearances(match_id, player_id, club_id, minutes, started, goals, assists,
                               yellow, red, own_goals, saves, fpl_points, source)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'fpl_archive')""",
                            (fx_match.get(fid), pid, cid, mins, ival(r.get("starts")) if r.get("starts") not in (None, "") else None,
                             ival(r["goals_scored"]), ival(r["assists"]), ival(r["yellow_cards"]), ival(r["red_cards"]),
                             ival(r["own_goals"]), ival(r["saves"]), ival(r["total_points"])))

    # current season from live feed: fixtures, results, events, appearances
    comp("ENG1", "First Division / Premier League", tier=1)
    live_fx = json.load(open(os.path.join(live, "fixtures.json")))
    live_fx_match = {}
    for f in live_fx:
        if f["team_h_score"] is None:
            mid = None
            cur.execute("""INSERT INTO fixtures_upcoming(season, kickoff, home_club_id, away_club_id, gameweek, fpl_fixture_id)
                           VALUES ('2026-27',?,?,?,?,?)""", (f["kickoff_time"], live_team[f["team_h"]], live_team[f["team_a"]], f["event"], f["id"]))
            continue
        cur.execute("""INSERT INTO matches(competition_id, season, date, kickoff, home_club_id, away_club_id, home_goals, away_goals,
                       round, fpl_fixture_id, source) VALUES (?,?,?,?,?,?,?,?,?,?, 'fpl')""",
                    (comp_ids["ENG1"], "2026-27", (f["kickoff_time"] or "")[:10], f["kickoff_time"], live_team[f["team_h"]],
                     live_team[f["team_a"]], f["team_h_score"], f["team_a_score"], f"Gameweek {f['event']}", f["id"]))
        live_fx_match[f["id"]] = cur.lastrowid
        add_fixture_events(cur, cur.lastrowid, f["stats"], live_el)
    for el_id, pid in live_el.items():
        p = json.load(open(os.path.join(live, "players", f"{el_id}.json")))
        for h in p["history"]:
            mid = live_fx_match.get(h["fixture"])
            f = next((x for x in live_fx if x["id"] == h["fixture"]), None)
            if not f:
                continue
            cid = live_team[f["team_h"] if h["was_home"] else f["team_a"]]
            cur.execute("""INSERT OR IGNORE INTO appearances(match_id, player_id, club_id, minutes, started, goals, assists,
                           yellow, red, own_goals, saves, fpl_points, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'fpl')""",
                        (mid, pid, cid, h["minutes"], h.get("starts"), h["goals_scored"], h["assists"], h["yellow_cards"],
                         h["red_cards"], h["own_goals"], h["saves"], h["total_points"]))

    # openfootball full 2025-26: lineups / subs / scorers with minutes -> link names to players in that season's squads
    for mid, m in of_full.items():
        h, a = cur.execute("SELECT home_club_id, away_club_id FROM matches WHERE match_id=?", (mid,)).fetchone()
        season = cur.execute("SELECT season FROM matches WHERE match_id=?", (mid,)).fetchone()[0]
        for side, cid, goals in (("1", h, m.get("goals1", [])), ("2", a, m.get("goals2", []))):
            for g in goals:
                pid = match_name(cur, g["name"], cid, season)
                cur.execute("""INSERT INTO match_events(match_id, club_id, player_id, player_name_raw, event, minute, detail, source)
                               VALUES (?,?,?,?, 'goal', ?, ?, 'openfootball')""",
                            (mid, cid, pid, g["name"], g.get("minute"), "own goal" if g.get("owngoal") else ("pen" if g.get("penalty") else None)))
        lineups = m.get("lineup")
        if isinstance(lineups, dict):
            lineups = [lineups]
        for idx, lu in enumerate(lineups or []):
            cid = h if idx == 0 else a
            for role in ("starter", "bench"):
                for p in lu.get(role, []):
                    pid = match_name(cur, p["name"], cid, season)
                    cur.execute("""INSERT INTO lineups(match_id, club_id, player_id, player_name_raw, role, captain, source)
                                   VALUES (?,?,?,?,?,?, 'openfootball')""", (mid, cid, pid, p["name"], role, 1 if p.get("captain") else 0))
            for s in lu.get("subs", []):
                cur.execute("""INSERT INTO match_events(match_id, club_id, player_id, player_name_raw, event, minute, detail, source)
                               VALUES (?,?,?,?, 'sub', ?, ?, 'openfootball')""",
                            (mid, cid, match_name(cur, s["on"], cid, season), s["on"], s.get("minute"), "on for " + s["off"]))

    # ---------------- Wikidata: clubs, grounds, careers ----------------
    wd = os.path.join(RAW, "wikidata")
    for b in json.load(open(os.path.join(wd, "clubs.json")))["results"]["bindings"]:
        name = b["clubLabel"]["value"]
        qid = b["club"]["value"].rsplit("/", 1)[1]
        cid = find_club(name, source="wikidata")
        lat = lon = None
        if "coord" in b:
            mm = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["coord"]["value"])
            if mm:
                lon, lat = float(mm.group(1)), float(mm.group(2))
        cur.execute("UPDATE clubs SET wikidata_qid=?, played_premier_league=1 WHERE club_id=?", (qid, cid))
        if "venue" in b:
            cur.execute("""INSERT OR IGNORE INTO venues(wikidata_qid, name, lat, lon) VALUES (?,?,?,?)""",
                        (b["venue"]["value"].rsplit("/", 1)[1], b["venueLabel"]["value"], lat, lon))
            vid = cur.execute("SELECT venue_id FROM venues WHERE wikidata_qid=?", (b["venue"]["value"].rsplit("/", 1)[1],)).fetchone()[0]
            cur.execute("INSERT OR IGNORE INTO club_venues(club_id, venue_id) VALUES (?,?)", (cid, vid))

    qid_club = {r[0]: r[1] for r in cur.execute("SELECT wikidata_qid, club_id FROM clubs WHERE wikidata_qid IS NOT NULL")}
    wd_players = {}
    spells = set()
    for f in glob.glob(os.path.join(wd, "careers", "*.json")):
        club_qid = os.path.basename(f)[:-5]
        cid = qid_club.get(club_qid)
        try:
            rows = json.load(open(f))["results"]["bindings"]
        except Exception:
            log(f"bad wikidata file {f}"); continue
        for b in rows:
            pq = b["player"]["value"].rsplit("/", 1)[1]
            d = wd_players.setdefault(pq, {"name": b.get("playerLabel", {}).get("value", pq), "dob": None, "nat": set(), "pos": set()})
            if "dob" in b: d["dob"] = b["dob"]["value"][:10]
            if "natLabel" in b: d["nat"].add(b["natLabel"]["value"])
            if "posLabel" in b: d["pos"].add(b["posLabel"]["value"])
            g = lambda k: b[k]["value"] if k in b else None
            spells.add((pq, cid, (g("start") or "")[:10] or None, (g("end") or "")[:10] or None,
                        ival(g("apps")), ival(g("goals"))))
    wd_files = os.path.join(wd, "all_spells")
    other_spells = []
    for f in glob.glob(os.path.join(wd_files, "*.json")):
        try:
            rows = json.load(open(f))["results"]["bindings"]
        except Exception:
            log(f"bad wikidata file {f}"); continue
        for b in rows:
            g = lambda k: b[k]["value"] if k in b else None
            other_spells.append((g("player").rsplit("/", 1)[1], g("club").rsplit("/", 1)[1], g("clubLabel"),
                                 (g("start") or "")[:10] or None, (g("end") or "")[:10] or None, ival(g("apps")), ival(g("goals")),
                                 g("countryLabel")))

    # crosswalk Wikidata <-> FPL: name + DOB first, then name + overlapping club spell
    by_name_dob = defaultdict(list)
    by_name = defaultdict(list)
    for pid, nm, kn, dob in cur.execute("SELECT player_id, name, known_as, dob FROM players").fetchall():
        by_name_dob[(norm(nm), dob)].append(pid)
        by_name[norm(nm)].append(pid)
        if kn:
            by_name[norm(kn)].append(pid)
    squad_clubs = defaultdict(set)
    for pid, cid in cur.execute("SELECT player_id, club_id FROM squads"):
        squad_clubs[pid].add(cid)
    wd_club_sets = defaultdict(set)
    for s in spells:
        wd_club_sets[s[0]].add(s[1])
    matched = 0
    by_dob = defaultdict(list)
    for pid, nm, kn, dob in cur.execute("SELECT player_id, name, known_as, dob FROM players WHERE dob IS NOT NULL").fetchall():
        by_dob[dob].append((pid, set(norm(nm).split()) | set(norm(kn or "").split())))
    by_token = defaultdict(set)
    tokens_of = {}
    for pid, nm, kn in cur.execute("SELECT player_id, name, known_as FROM players WHERE fpl_code IS NOT NULL").fetchall():
        t = set(norm(nm).split()) | set(norm(kn or "").split())
        tokens_of[pid] = t
        for x in t:
            if len(x) > 2:
                by_token[x].add(pid)
    taken = set()
    for pq, d in wd_players.items():
        pid = None
        wt = set(norm(d["name"]).split())
        cands = by_name_dob.get((norm(d["name"]), d["dob"])) if d["dob"] else None
        if cands and len(cands) == 1:
            pid = cands[0]
        if not pid and d["dob"]:
            c2 = [p for p, t in by_dob.get(d["dob"], []) if wt & t]
            if len(c2) == 1:
                pid = c2[0]
        if not pid:
            pool = set()
            for x in wt:
                pool |= by_token.get(x, set())
            c3 = [p for p in pool if squad_clubs[p] & wd_club_sets[pq] and len(wt & tokens_of[p]) >= min(2, len(wt))]
            if len(c3) == 1:
                pid = c3[0]
        if pid in taken:
            pid = None
        if pid:
            taken.add(pid)
        if pid:
            matched += 1
            cur.execute("""UPDATE players SET wikidata_qid=?, display_name=?, dob=COALESCE(dob, ?), nationality=?, position_detail=?
                           WHERE player_id=?""", (pq, d["name"] if not re.match(r"^Q\d+$", d["name"]) else None, d["dob"], "; ".join(sorted(d["nat"])) or None, "; ".join(sorted(d["pos"])) or None, pid))
        else:
            pid = add_player(d["name"], wikidata_qid=pq, dob=d["dob"], nationality="; ".join(sorted(d["nat"])) or None,
                             position_detail="; ".join(sorted(d["pos"])) or None)
        players_by_qid[pq] = pid
    log(f"wikidata players {len(wd_players)}, linked to FPL {matched}")
    for pq, cid, st, en, apps, goals in spells:
        cur.execute("""INSERT INTO player_clubs(player_id, club_id, club_name, start_date, end_date, apps, goals, source)
                       VALUES (?,?,(SELECT name FROM clubs WHERE club_id=?),?,?,?,?, 'wikidata')""",
                    (players_by_qid[pq], cid, cid, st, en, apps, goals))
    for pq, club_qid, club_label, st, en, apps, goals, country in other_spells:
        if pq not in players_by_qid or club_qid in qid_club:
            continue
        cur.execute("""INSERT INTO player_clubs(player_id, club_id, club_name, club_country, club_wikidata_qid, start_date, end_date, apps, goals, source)
                       VALUES (?,NULL,?,?,?,?,?,?,?, 'wikidata')""", (players_by_qid[pq], club_label, country, club_qid, st, en, apps, goals))

    cur.execute("""UPDATE players SET display_name = CASE
                     WHEN display_name IS NOT NULL THEN display_name
                     WHEN known_as IS NOT NULL AND length(name) - length(replace(name, ' ', '')) >= 2 AND known_as NOT LIKE '%.%' THEN known_as
                     ELSE name END""")
    con.commit()
    build_standings(con, comp_ids)
    con.commit()
    open(os.path.join(ROOT, "build_log.txt"), "w").write("\n".join(LOG))
    print("built", DB)


def add_fixture_events(cur, match_id, stats, el):
    if not stats:
        return
    if isinstance(stats, str):
        try:
            stats = ast.literal_eval(stats)
        except Exception:
            return
    kinds = {"goals_scored": "goal", "assists": "assist", "own_goals": "own goal", "yellow_cards": "yellow",
             "red_cards": "red", "penalties_saved": "pen saved", "penalties_missed": "pen missed", "saves": None, "bonus": None, "bps": None}
    for s in stats:
        ev = kinds.get(s.get("identifier"))
        if not ev:
            continue
        for side in ("h", "a"):
            for x in s.get(side, []):
                cur.execute("""INSERT INTO match_events(match_id, player_id, event, count, side, source)
                               VALUES (?,?,?,?,?, 'fpl')""", (match_id, el.get(x["element"]), ev, x["value"], side))


_name_cache = {}
def match_name(cur, raw, club_id, season):
    key = (club_id, season)
    if key not in _name_cache:
        rows = cur.execute("""SELECT DISTINCT p.player_id, p.name, p.known_as FROM players p WHERE p.player_id IN (
                                SELECT player_id FROM squads WHERE club_id=? AND season=?
                                UNION SELECT a.player_id FROM appearances a JOIN matches m USING(match_id)
                                      WHERE a.club_id=? AND m.season=?)""", (club_id, season, club_id, season)).fetchall()
        _name_cache[key] = rows
    n = norm(raw)
    toks = set(n.split())
    exact = {pid for pid, nm, kn in _name_cache[key] if n in (norm(nm), norm(kn or ""))}
    if len(exact) == 1:
        return exact.pop()
    scored = []
    for pid, nm, kn in _name_cache[key]:
        cand = set(norm(nm).split()) | set(norm(kn or "").split())
        ov = len(toks & cand)
        if ov:
            scored.append((ov + (1 if norm(kn or "") in toks else 0), pid))
    if scored:
        scored.sort(reverse=True)
        top = scored[0][0]
        best = {pid for sc, pid in scored if sc == top}
        if len(best) == 1:
            return best.pop()
    log(f"name not matched: {raw} (club {club_id}, {season})")
    return None


def build_standings(con, comp_ids):
    cur = con.cursor()
    league = [comp_ids[f"ENG{t}"] for t in (1, 2, 3, 4)]
    ded = defaultdict(int)
    for season, cid, pts in cur.execute("SELECT season, club_id, points FROM points_deductions"):
        ded[(season, cid)] += pts or 0
    rows = cur.execute(f"""SELECT competition_id, season, division, home_club_id, away_club_id, home_goals, away_goals FROM matches
                           WHERE competition_id IN ({','.join('?'*len(league))}) AND home_goals IS NOT NULL""", league).fetchall()
    table = defaultdict(lambda: defaultdict(lambda: [0]*7))  # P W D L GF GA Pts
    for comp_id, season, div, h, a, hg, ag in rows:
        y = int(season[:4])
        win = 3 if y >= 1981 else 2
        key = (comp_id, season, div or "")
        for c, gf, ga in ((h, hg, ag), (a, ag, hg)):
            t = table[key][c]
            t[0] += 1; t[4] += gf; t[5] += ga
            if gf > ga: t[1] += 1; t[6] += win
            elif gf == ga: t[2] += 1; t[6] += 1
            else: t[3] += 1
    for (comp_id, season, div), clubs in table.items():
        y = int(season[:4])
        ranked = sorted(clubs.items(), key=lambda kv: (-(kv[1][6] - ded[(season, kv[0])]),
                                                        -((kv[1][4] - kv[1][5]) if y >= 1976 else (kv[1][4] / max(kv[1][5], 1))),
                                                        -kv[1][4]))
        for pos, (cid, t) in enumerate(ranked, 1):
            cur.execute("""INSERT INTO standings(competition_id, season, division, position, club_id, played, won, drawn, lost,
                           goals_for, goals_against, points, points_deducted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (comp_id, season, div, pos, cid, *t[:6], t[6] - ded[(season, cid)], ded[(season, cid)]))


if __name__ == "__main__":
    main()
