"""Pull sample questions for each 1X2 game mode straight from football.db, to prove the data supports them."""
import random, sqlite3, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
c = sqlite3.connect(os.path.join(ROOT, "football.db"))
q = lambda sql, *a: c.execute(sql, a).fetchall()
random.seed(7)
out = []
def h(t): out.append(f"\n## {t}\n")
def line(t): out.append(f"- {t}")

PL = q("SELECT competition_id FROM competitions WHERE code='ENG1'")[0][0]
PL_ERA = "season >= '1992-93'"
SENIOR = "pc.club_name NOT LIKE '%national%' AND pc.club_name NOT LIKE '%under-%' AND pc.club_name NOT LIKE '%reserves%' AND pc.club_name NOT LIKE '% U2_%' AND pc.club_name NOT LIKE '% U1_%'"

h("Exact Score  (matches)")
for d, ht, at, hg, ag in q(f"""SELECT m.date, a.name, b.name, home_goals, away_goals FROM matches m
        JOIN clubs a ON a.club_id=home_club_id JOIN clubs b ON b.club_id=away_club_id
        WHERE competition_id={PL} AND {PL_ERA} AND (a.name='Arsenal' OR b.name='Arsenal') AND home_goals+away_goals>=6
        ORDER BY random() LIMIT 4"""):
    line(f"{ht} v {at}, {d}: what was the score?  **{hg}-{ag}**")

h("Hidden Row  (standings)")
for season in random.sample([r[0] for r in q(f"SELECT DISTINCT season FROM standings WHERE competition_id={PL} AND {PL_ERA}")], 3):
    rows = q("SELECT position, c.name, points FROM standings JOIN clubs c USING(club_id) WHERE competition_id=? AND season=? ORDER BY position LIMIT 6", PL, season)
    hide = random.choice(rows)
    shown = ", ".join(f"{p}. {n} {pts}" if (p, n, pts) != hide else f"{p}. ??? {pts}" for p, n, pts in rows)
    line(f"{season} top six: {shown}  **{hide[1]}**")

h("Put Them in Order  (standings)")
for season in random.sample([r[0] for r in q(f"SELECT DISTINCT season FROM standings WHERE competition_id={PL} AND {PL_ERA}")], 3):
    rows = q("SELECT c.name, position FROM standings JOIN clubs c USING(club_id) WHERE competition_id=? AND season=? ORDER BY random() LIMIT 4", PL, season)
    line(f"Order these by {season} finish: {', '.join(r[0] for r in rows)}  **{', '.join(r[0] for r in sorted(rows, key=lambda x: x[1]))}**")

h("Ever Team-mates  (appearances, 2016-17 onward: same match, same side, both played)")
for a, b, n in q("""SELECT pa.display_name, pb.display_name, COUNT(*) n FROM appearances x JOIN appearances y
        ON x.match_id=y.match_id AND x.club_id=y.club_id AND x.player_id<y.player_id AND x.minutes>0 AND y.minutes>0
        JOIN players pa ON pa.player_id=x.player_id JOIN players pb ON pb.player_id=y.player_id
        WHERE x.club_id=(SELECT club_id FROM clubs WHERE name='Arsenal')
        GROUP BY 1,2 HAVING n BETWEEN 1 AND 3 ORDER BY random() LIMIT 4"""):
    line(f"Did {a} and {b} ever play together for Arsenal in the PL?  **Yes, {n} game(s)**")

h("Grid  (Wikidata careers: played for both clubs)")
for x, y in [("Arsenal", "Chelsea"), ("Liverpool", "Everton"), ("Tottenham Hotspur", "Leeds United")]:
    names = q(f"""SELECT DISTINCT p.name FROM player_clubs a JOIN player_clubs b USING(player_id) JOIN players p USING(player_id)
        WHERE a.club_name=? AND b.club_name=? ORDER BY random() LIMIT 5""", x, y)
    total = q("""SELECT COUNT(DISTINCT a.player_id) FROM player_clubs a JOIN player_clubs b USING(player_id) WHERE a.club_name=? AND b.club_name=?""", x, y)[0][0]
    line(f"{x} + {y}: {total} valid answers, e.g. {', '.join(n[0] for n in names)}")

h("Who Bought Him  (Wikidata spells in date order)")
for name, prev, nxt, yr in q(f"""SELECT p.display_name, a.club_name, b.club_name, substr(b.start_date,1,4) FROM player_clubs a JOIN player_clubs b USING(player_id)
        JOIN players p USING(player_id)
        WHERE b.club_name='Arsenal' AND b.start_date >= '1995' AND a.end_date IS NOT NULL AND substr(a.end_date,1,4)=substr(b.start_date,1,4)
          AND a.club_name<>'Arsenal' AND {SENIOR.replace('pc.', 'a.')} ORDER BY random() LIMIT 4"""):
    line(f"{name} joined Arsenal in {yr}. Who did they come from?  **{prev}**")

h("Flag XI  (nationality + appearances)")
for nat, n, eg in q("""SELECT nationality, COUNT(DISTINCT player_id) n, GROUP_CONCAT(DISTINCT name) FROM (
        SELECT p.player_id, p.display_name AS name, p.nationality FROM players p JOIN appearances a USING(player_id)
        WHERE a.club_id=(SELECT club_id FROM clubs WHERE name='Arsenal') AND a.minutes>0 AND p.nationality IS NOT NULL AND p.nationality NOT LIKE '%;%')
        GROUP BY 1 HAVING n>=3 ORDER BY random() LIMIT 4"""):
    line(f"Name an Arsenal PL player since 2016 from {nat}: {n} answers (e.g. {', '.join(eg.split(',')[:3])})")

h("Spot the Fake  (career clubs + one decoy)")
for pid, name in q(f"""SELECT p.player_id, p.display_name FROM players p JOIN player_clubs pc USING(player_id)
        WHERE p.fpl_code IS NOT NULL AND {SENIOR} GROUP BY 1 HAVING COUNT(DISTINCT pc.club_name) >= 4 ORDER BY random() LIMIT 3"""):
    real = [r[0] for r in q(f"SELECT DISTINCT club_name FROM player_clubs pc WHERE player_id=? AND {SENIOR} ORDER BY random() LIMIT 3", pid)]
    fake = q("SELECT name FROM clubs WHERE played_premier_league=1 AND name NOT IN (SELECT club_name FROM player_clubs WHERE player_id=? AND club_name IS NOT NULL) ORDER BY random() LIMIT 1", pid)[0][0]
    opts = real + [fake]; random.shuffle(opts)
    line(f"Which club did {name} NOT play for? {', '.join(opts)}  **{fake}**")

h("Six Degrees  (team-mate graph, 2016-17 onward)")
edges = {}
for a, b in q("""SELECT DISTINCT x.player_id, y.player_id FROM appearances x JOIN appearances y
        ON x.match_id=y.match_id AND x.club_id=y.club_id AND x.player_id<>y.player_id AND x.minutes>0 AND y.minutes>0"""):
    edges.setdefault(a, set()).add(b)
name = dict(q("SELECT player_id, display_name FROM players"))
def path(s, t):
    prev = {s: None}; frontier = [s]
    while frontier:
        nxt = []
        for u in frontier:
            for v in edges.get(u, ()):
                if v not in prev:
                    prev[v] = u
                    if v == t:
                        p = [t]
                        while prev[p[-1]] is not None: p.append(prev[p[-1]])
                        return p[::-1]
                    nxt.append(v)
        frontier = nxt
for a, b in [("Bukayo Saka", "Jamie Vardy"), ("Erling Haaland", "Harry Kane"), ("Mohamed Salah", "Wayne Rooney")]:
    ia = q("SELECT player_id FROM players WHERE name=?", a); ib = q("SELECT player_id FROM players WHERE name=?", b)
    if ia and ib:
        p = path(ia[0][0], ib[0][0])
        line(f"{a} → {b}: {' → '.join(name[x] for x in p) if p else 'no link found'}")
line(f"graph size: {len(edges)} players")

h("Pin the Ground  (stadium coordinates)")
for n, v, lat, lon in q("SELECT c.name, v.name, v.lat, v.lon FROM venues v JOIN club_venues USING(venue_id) JOIN clubs c USING(club_id) WHERE v.lat IS NOT NULL ORDER BY random() LIMIT 4"):
    line(f"Pin {v} ({n}): {lat:.4f}, {lon:.4f}")
line(f"plus {q('SELECT COUNT(*) FROM clubs WHERE lat IS NOT NULL')[0][0]} English clubs with town-level coordinates for a harder mode")

h("Chain Reaction  (top scorers by season, quick-fire)")
for season in ["2018-19", "2021-22", "2025-26"]:
    top = q("""SELECT p.display_name, SUM(goals) g FROM appearances a JOIN players p USING(player_id) JOIN matches m USING(match_id)
               WHERE m.season=? GROUP BY 1 ORDER BY g DESC LIMIT 3""", season)
    line(f"{season} top 3 PL scorers: " + ", ".join(f"{n} ({int(g)})" for n, g in top))

open(os.path.join(ROOT, "sample_questions.md"), "w").write("# Sample questions straight from football.db\n" + "\n".join(out) + "\n")
print("\n".join(out))
