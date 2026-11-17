// 1X2 database → game chunks: every switch and threshold in one place.
// Run with: node --no-warnings data-pipeline/db/build.mjs

/* ---------- licence switches ----------
   Turn a source off and every chunk that depends on it is skipped (the game falls back to its older question bank for those modes).
   fpl            Fantasy Premier League (belongs to the Premier League): player-by-match appearances, season stats, the
                  2026-27 results that only FPL has. Switching it off drops: Ever Team-mates, Six Degrees, Flag XI, the top-scorer round.
   engsoccerdata  James Curley's results (GPL-2): most 1992-2025 Premier League scores and final tables. Every score and every
                  table from it was checked against openfootball + Wikipedia (0 mismatches over 13,166 matches) but check the licence
                  before a paid launch. Switching it off drops: Exact Score, Hidden Row, In Order (except 2022-23 and 2025-26). */
export const SOURCES = { fpl: true, engsoccerdata: true };

/* ---------- corrections to the database ----------
   points_deductions in football.db stops at 2014-15, so the standings miss the 2023-24 Premier League deductions (Everton −6 then −2, Nottingham
   Forest −4). Found by checking every table against the Wikipedia-verified ones in data-pipeline/. Anything added here is applied on top. */
export const EXTRA_DEDUCTIONS = [
  { season: "2023-24", club: "Everton", points: 8, note: "−6 (Nov 2023) and −2 (Apr 2024), profit and sustainability rules" },
  { season: "2023-24", club: "Nottingham Forest", points: 4, note: "−4 (Mar 2024), profit and sustainability rules" }
];

/* ---------- scope ---------- */
export const FIRST_PL = "1992-93"; // Exact Score, Hidden Row and In Order start here (the Premier League era; verified)
export const APP_FROM = "2016-17"; // appearances start here (FPL archive)

/* ---------- display names ----------
   Premier League clubs use the names the rest of the game uses (same as the question bank).
   Everything else: OVERRIDES first, then a generic tidy (see lib.mjs: tidyClub). Names the tidy can't make clean are not used. */
export const OVERRIDES = {
  "Real Madrid Club de Fútbol": "Real Madrid", "Juventus FC": "Juventus", "FC Barcelona": "Barcelona", "AFC Ajax": "Ajax", "AS Monaco FC": "Monaco",
  "Olympique de Marseille": "Marseille", "Olympique Lyonnais": "Lyon", "Paris Saint-Germain FC": "Paris Saint-Germain", "Inter Milan": "Inter Milan",
  "AC Milan": "AC Milan", "S.L. Benfica": "Benfica", "Sporting CP": "Sporting CP", "PSV Eindhoven": "PSV", "FC Porto": "Porto", "Feyenoord Rotterdam": "Feyenoord",
  "ACF Fiorentina": "Fiorentina", "R.S.C. Anderlecht": "Anderlecht", "R.C. Lens": "Lens", "Stade Rennais F.C.": "Rennes", "FC Bayern Munich": "Bayern Munich",
  "Borussia Dortmund": "Borussia Dortmund", "Atlético Madrid": "Atlético Madrid", "Club Atlético de Madrid": "Atlético Madrid", "Valencia CF": "Valencia",
  "Sevilla FC": "Sevilla", "Villarreal CF": "Villarreal", "Real Betis": "Real Betis", "Athletic Bilbao": "Athletic Bilbao", "Real Sociedad": "Real Sociedad",
  "SSC Napoli": "Napoli", "S.S. Lazio": "Lazio", "A.S. Roma": "Roma", "Udinese Calcio": "Udinese", "Parma Calcio 1913": "Parma", "Atalanta BC": "Atalanta",
  "Galatasaray S.K.": "Galatasaray", "Fenerbahçe S.K.": "Fenerbahçe", "Beşiktaş J.K.": "Beşiktaş", "Olympiacos F.C.": "Olympiacos", "Panathinaikos F.C.": "Panathinaikos",
  "Bayer 04 Leverkusen": "Bayer Leverkusen", "Borussia Mönchengladbach": "Gladbach", "FC Schalke 04": "Schalke", "VfB Stuttgart": "Stuttgart",
  "Hamburger SV": "Hamburg", "SV Werder Bremen": "Werder Bremen", "VfL Wolfsburg": "Wolfsburg", "Hertha BSC": "Hertha Berlin", "FC Basel": "Basel",
  "Club Brugge KV": "Club Brugge", "RSC Anderlecht": "Anderlecht", "Celtic F.C.": "Celtic", "Rangers F.C.": "Rangers", "Heart of Midlothian F.C.": "Hearts",
  "Hibernian F.C.": "Hibernian", "Aberdeen F.C.": "Aberdeen", "Dundee United F.C.": "Dundee United", "Dundee F.C.": "Dundee", "Motherwell F.C.": "Motherwell",
  "Kilmarnock F.C.": "Kilmarnock", "St Johnstone F.C.": "St Johnstone", "St. Mirren F.C.": "St Mirren", "Hamilton Academical F.C.": "Hamilton Academical",
  "Partick Thistle F.C.": "Partick Thistle", "Dunfermline Athletic F.C.": "Dunfermline", "Falkirk F.C.": "Falkirk", "Livingston F.C.": "Livingston",
  "Milton Keynes Dons F.C.": "MK Dons", "Boca Juniors": "Boca Juniors", "CA River Plate": "River Plate", "Flamengo": "Flamengo", "Santos FC": "Santos",
  "New York Red Bulls": "New York Red Bulls", "LA Galaxy": "LA Galaxy", "Los Angeles FC": "LAFC", "Inter Miami CF": "Inter Miami", "Wimbledon F.C.": "Wimbledon"
};

/* names the generic rules can't shorten (long, with founding years, or in another language); checked against the 900 clubs with 12+ players */
Object.assign(OVERRIDES, {
  "Inverness Caledonian Thistle F.C.": "Inverness CT", "Grasshopper Club Zürich": "Grasshoppers", "Bologna F.C. 1909": "Bologna", "Aarhus Gymnastikforening": "AGF",
  "Club Atlético River Plate": "River Plate", "Montpellier Hérault Sport Club": "Montpellier", "Hampton & Richmond Borough F.C.": "Hampton & Richmond",
  "Tooting & Mitcham United F.C.": "Tooting & Mitcham", "Unión Deportiva Almería": "Almería", "Helsingin Jalkapalloklubi": "HJK Helsinki", "Enfield 1893 F.C.": "Enfield",
  "Clube de Regatas do Flamengo": "Flamengo", "Ascoli Calcio 1898 FC": "Ascoli", "TSG 1899 Hoffenheim": "Hoffenheim", "Stocksbridge Park Steels F.C.": "Stocksbridge",
  "Maidstone United F.C. (1987)": "Maidstone United", "Lyn 1896 FK": "Lyn", "Athlitiki Enosi Larissa F.C.": "Larissa", "Sociedade Esportiva Palmeiras": "Palmeiras",
  "Fort Lauderdale Strikers": "Fort Lauderdale", "Associação Académica de Coimbra – O.A.F.": "Académica", "TSV 1860 München": "1860 Munich", "Como 1907": "Como",
  "Estudiantes de La Plata": "Estudiantes", "U.S. Salernitana 1919": "Salernitana", "İstanbul Başakşehir F.K.": "Başakşehir", "Delfino Pescara 1936": "Pescara",
  "AS Reggina 1914": "Reggina", "Íþróttabandalag Vestmannaeyja": "ÍBV", "Football Club Molenbeek Brussels Strombeek": "Molenbeek", "Club Athletico Paranaense": "Athletico Paranaense",
  "Íþróttabandalag Akraness": "ÍA", "U.S. Avellino 1912": "Avellino", "Sociedad Deportiva Huesca": "Huesca", "K.S.C. Lokeren Oost-Vlaanderen": "Lokeren",
  "Club Nacional de Football": "Nacional", "C.F. Estrela da Amadora": "Estrela da Amadora", "Maldon & Tiptree football club": "Maldon & Tiptree", "Darlington 1883": "Darlington",
  "A.C. Reggiana 1919": "Reggiana", "US Livorno 1915": "Livorno", "Knattspyrnufélagið Víkingur": "Víkingur", "Club Atlético Independiente": "Independiente",
  "Ashford Town (Middlesex) F.C.": "Ashford Town", "Club Deportivo Numancia de Soria": "Numancia", "Étoile Fréjus Saint-Raphaël": "Fréjus", "Knattspyrnufélagið Fram": "Fram",
  "Club Deportivo Universidad Católica": "Universidad Católica", "Club Atlético Rosario Central": "Rosario Central", "Club Social y Deportivo Colo-Colo": "Colo-Colo",
  "Fenerbahçe Istanbul": "Fenerbahçe", "Lille OSC": "Lille", "Club Brugge K.V.": "Club Brugge", "Cruzeiro E.C.": "Cruzeiro", "U.C. Sampdoria": "Sampdoria", "Genoa CFC": "Genoa",
  "Real Betis Balompié": "Real Betis", "Deportivo de A Coruña": "Deportivo La Coruña", "K.R.C. Genk": "Genk", "Red Bull New York": "New York Red Bulls", "N.E.C.": "NEC Nijmegen",
  "Club Atlético Osasuna": "Osasuna", "Club Atlético Peñarol": "Peñarol", "Stade Malherbe Caen": "Caen", "En Avant de Guingamp": "Guingamp", "Stade Brestois 29": "Brest",
  "Grenoble Foot 38": "Grenoble", "Clermont Foot 63": "Clermont", "Dijon FCO": "Dijon", "Angers SCO": "Angers", "ES Troyes AC": "Troyes", "ESTAC Troyes": "Troyes", "Nîmes Olympique": "Nîmes",
  "CS Sedan Ardennes": "Sedan", "SBV Vitesse": "Vitesse", "A.E.K.": "AEK Athens", "AEK Athens F.C.": "AEK Athens", "Legia Warsaw": "Legia Warsaw", "Tours FC.": "Tours", "Athletic Club": "Athletic Bilbao",
  "Grêmio FBPA": "Grêmio", "Clube Atlético Mineiro": "Atlético Mineiro", "CR Vasco da Gama": "Vasco da Gama", "Botafogo F.R.": "Botafogo", "Neuchâtel Xamax FCS": "Neuchâtel Xamax",
  "Aalborg Boldspilklub": "Aalborg", "Odense Boldklub": "Odense", "Vejle Boldklub": "Vejle", "Lyngby Boldklub": "Lyngby", "Akademisk Boldklub": "AB Copenhagen", "AaB Fodbold": "Aalborg",
  "Sint-Truidense V.V.": "Sint-Truiden", "S.V. Zulte Waregem": "Zulte Waregem", "K.V.C. Westerlo": "Westerlo", "K.V. Kortrijk": "Kortrijk", "Cercle Brugge K.S.V.": "Cercle Brugge",
  "K.S.K. Beveren": "Beveren", "Lierse S.K.": "Lierse", "R.A.A. Louviéroise": "La Louvière", "Al Sadd Sports Club": "Al Sadd", "Al-Sailiya Sports Club": "Al-Sailiya", "Al Hilal SFC": "Al Hilal",
  "PFC CSKA Sofia": "CSKA Sofia", "PFC CSKA Moscow": "CSKA Moscow", "PFC Levski Sofia": "Levski Sofia", "ŠK Slovan Bratislava": "Slovan Bratislava", "CFR Cluj": "CFR Cluj",
  "Real Madrid C": null, "Sporting CP B": null, "Atlético Madrid B": null, "Villarreal CF B": null, "Sevilla Atlético": null, "Runcorn F.C. Halton": "Runcorn Linnets"
});

/* a club counts as "well-known" for decoys and answers if at least this many different players in the database have been there */
export const KNOWN_CLUB_MIN_PLAYERS = 40;

/* ---------- people ---------- */
// single-word display names that really are the player's name (everything else single-word is a web name like "Silva" and gets fixed or dropped)
export const MONONYMS = new Set(["Alisson", "Fabinho", "Casemiro", "Rodri", "Ederson", "Pedro", "Willian", "Fred", "Jorginho", "Richarlison", "Raphinha", "Gabriel", "Marquinhos", "Danilo", "Bernardo", "Kepa", "Joelinton", "Oscar", "Anderson", "Hulk", "Kaká", "Ronaldinho", "Rivaldo", "Cafu", "Juninho", "Edu", "Diego", "Thiago", "Lucas", "Savinho", "Martinelli", "Antony", "Rodrygo", "Vinícius", "Reinier", "Rayan", "Talles", "Dudu", "Nuno"]);

/* ---------- difficulty ----------
   1 = everyone knows him, 4 = deep cut. Players: the game's own fame score (data.js, 0-6.5) where we can link them, otherwise estimated from
   Premier League games since 2016. Matches: how big the clubs are, how recent, derby, how many goals. */
export const PLAYER_TIERS = [5.4, 4.6, 3.8]; // fame >= each → d1, d2, d3; below → d4
export const MIN_FAME_THIN = 2.4; // below this, "thin data": never asked about

/* ---------- output ---------- */
export const OUT_DIR = "data/x";
