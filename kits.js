/* ============ kits.js: home shirts for the sticker clubs ============
   Each sticker shows the shirt the club wore while that player was there. Colours and designs come from the club's
   English Wikipedia article (the infobox kit and the "Colours" section), read 13/11/2026. Only home shirts; no badges,
   sponsors or maker's marks, so it's a drawing in the club's colours, not a copy of a real shirt.

   b: body colour, s: sleeve colour (if different), p: pattern, c: pattern colour, t: collar and cuff trim.
   Patterns: stripes (vertical), hoops (horizontal), halves, band (one broad centre stripe), hechter (centre stripe
   with thin white edges), pin2 (two thin centre stripes in c and c2), diag (diagonal split).
   e: other shirts by season [from, to, shirt, sig]. Seasons are the starting year (2005 = 2005/06).
   A "sig" shirt is a famous one-off: a player whose time at the club ended in it (or the season after) gets it,
   so Henry, Pires and Bergkamp wear the 2005/06 redcurrant but Fabregas and Van Persie wear red and white.

   Where the article gives the colours but not the layout, the layout is the club's well-known one and is marked
   "layout not in article" below. Adam can correct any of these; nothing else depends on them. */
window.BOFFIN_KITS = (() => {
  const W = "#f4f4f1", K = "#151515", R = "#d71920";
  return {
    "Arsenal": { b: "#e3101c", s: W, t: W, e: [[2005, 2005, { b: "#7b1f32", t: "#7b1f32" }, 1]] },   // red, white sleeves; 2005/06 redcurrant Highbury farewell
    "Chelsea": { b: "#1d3fa0", t: W },
    "Liverpool": { b: "#c8102e", t: W },
    "Manchester United": { b: "#da1a1a", t: W },
    "Manchester City": { b: "#8dc3ea", t: W },
    "Tottenham": { b: W, t: "#132257" },                                   // white shirts, navy shorts
    "Everton": { b: "#1b44a8", t: W },
    "Newcastle": { b: W, p: "stripes", c: K, t: K },
    "Aston Villa": { b: "#7a1c34", s: "#95bfe5", t: "#95bfe5" },
    "West Ham": { b: "#7e1823", s: "#95bfe5", t: "#95bfe5" },
    "Leicester": { b: "#1d4ba8", t: W },
    "Real Madrid": { b: W },
    "Barcelona": { b: "#004d98", p: "stripes", c: "#a50044" },
    "Atlético Madrid": { b: W, p: "stripes", c: "#d2122e", t: "#1d3fa0" },
    "Bayern Munich": { b: "#dc052d", t: W, e: [[1995, 1996, { b: "#dc052d", p: "stripes", c: "#0d3b8c", t: W }]] },   // red and blue stripes 1995-97
    "Dortmund": { b: "#fde100", t: K },
    "Juventus": { b: W, p: "stripes", c: K, t: K },
    "AC Milan": { b: K, p: "stripes", c: "#e2001a", t: K },
    "Inter": { b: K, p: "stripes", c: "#0068a8", t: K },
    "Roma": { b: "#8e1f2f", t: "#f0bc42" },                                // carmine red, golden yellow trim
    "Napoli": { b: "#2a8bd6", t: W },
    "PSG": { b: "#0b2a5b", p: "hechter", c: "#da291c" },                   // Hechter shirt, the club's traditional home design since 1973
    "Lyon": { b: W, p: "pin2", c: R, c2: "#1d3fa0", t: "#1d3fa0" },          // white with red and blue stripes
    "Marseille": { b: W, t: "#2faee0" },
    "Monaco": { b: W, p: "diag", c: "#e2001a", t: W },                      // red and white; layout not in article
    "Sevilla": { b: W, t: "#e20001" },
    "Valencia": { b: W, t: K },
    "Lazio": { b: "#87c4ef", t: W },
    "Leverkusen": { b: "#e32221", t: K },                                  // red and black
    "Southampton": { b: W, p: "stripes", c: R, t: K },                      // red and white; layout not in article
    "Crystal Palace": { b: "#1b458f", p: "stripes", c: "#c4122e" },          // red and blue stripes since 1973
    "Fulham": { b: W, t: K },
    "Sunderland": { b: W, p: "stripes", c: R, t: K },
    "Ajax": { b: W, p: "band", c: "#d2122e", t: W },                         // white with a broad red stripe
    "Porto": { b: W, p: "stripes", c: "#1a3b8f", t: "#1a3b8f" },
    "Benfica": { b: "#e2001a", t: W },
    "Sporting CP": { b: W, p: "hoops", c: "#008057", t: "#008057" },
    "Leeds": { b: W, t: "#1d428a" },
    "Wolves": { b: "#fdb913", t: K },
    "Fiorentina": { b: "#5b2b82", t: W },
    "Schalke": { b: "#004d9d", t: W },
    "Villarreal": { b: "#ffe24a" },
    "PSV": { b: R, p: "stripes", c: W },                                    // red and white stripes since 1989
    "Celtic": { b: W, p: "hoops", c: "#018749", t: W },
    "RB Leipzig": { b: W, t: "#dd0741" },
    "Atalanta": { b: K, p: "stripes", c: "#1e71b8", t: K },
    "Brighton": { b: W, p: "stripes", c: "#0057b8", t: "#0057b8" },
    "Stoke": { b: W, p: "stripes", c: R, t: R },
    "Middlesbrough": { b: "#e2001a", t: W },
    "Blackburn": { b: W, p: "halves", c: "#009ee0", t: "#009ee0" },
    "Bolton": { b: W, t: "#263c7e" },                                      // white, navy and red trim
    "Nott'm Forest": { b: "#dd0000", t: W },
    "Sheffield United": { b: W, p: "stripes", c: R, t: K },
    "Ipswich": { b: "#0044a9", t: W },
    "Hull": { b: "#f5a12d", p: "stripes", c: K, t: K },                      // black and amber, often striped
    "Coventry": { b: "#59b6e6" },
    "Burnley": { b: "#6c1d45", s: "#99d6ea", t: "#99d6ea" },                // claret and blue; layout not in article
    "Bournemouth": { b: R, p: "stripes", c: K, t: K, e: [[2004, 2005, { b: R, t: K }]] },   // red and black stripes since 1990; plain red 2004-06
    "Brentford": { b: W, p: "stripes", c: R, t: K },
    "Luton": { b: "#f78f1e", t: "#002d62" },                                // orange, navy and white (since 1973)
    "Birmingham": { b: "#1a3e9c", t: W },
    "Blackpool": { b: "#f68712", t: W },
    "Cardiff": { b: "#0070b5", t: W, e: [[2012, 2014, { b: "#d6001c", t: K }]] },   // red from 2012 until January 2015
    "Huddersfield": { b: W, p: "stripes", c: "#0e63ad", t: "#0e63ad" },
    "Norwich": { b: "#fff200", t: "#00a650" },
    "QPR": { b: W, p: "hoops", c: "#1d5ba4", t: "#1d5ba4" },                  // "the Hoops"
    "Reading": { b: W, p: "hoops", c: "#004494", t: "#004494" },
    "Swansea": { b: W, t: K },
    "Watford": { b: "#fbee23", t: K },
    "West Brom": { b: W, p: "stripes", c: "#122f67", t: "#122f67" },
    "Wigan": { b: W, p: "stripes", c: "#1d59af", t: "#1d59af" },
    "Barnsley FC": { b: "#e2001a", t: W },
    "Bradford": { b: "#f9b000", p: "stripes", c: "#8b1e3f", t: "#8b1e3f" },   // claret and amber stripes
    "Charlton": { b: "#d4021d", t: W },
    "Derby": { b: W, t: K },
    "Oldham Athletic": { b: "#004a9f", t: W },
    "Portsmouth": { b: "#1a2d8f", t: W },
    "Sheffield Wednesday": { b: W, p: "stripes", c: "#0e5daa", t: "#0e5daa" },
    "Swindon Town": { b: "#da291c", t: W }
  };
})();
