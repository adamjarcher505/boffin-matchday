# Data sources

## data.js (unchanged this run)
Imported with the game from the claude.ai artifact on 11/11/2026. The build process and sources aren't recorded in the
repo. CLAUDE.md notes that squad records from 2022–23 onwards came from Fantasy Premier League data. Nothing was added
to or edited in data.js on 11 or 12/11/2026.

Known data quirks found while building stickers (listed so nobody "fixes" them from memory):
- Club trails miss some moves, e.g. Lacazette's 2022 return to Lyon, Cazorla's 2018 move to Villarreal. So stickers show
  the year a player joined, never a departure year.
- Fame scores lean towards players with 2010s records (Henry 4.9, Sterling 6.2), which affects sticker page order.
- Position labels come straight from the data (e.g. Xhaka is listed as a defender).
- 2,438 players have no nationality on file; those can't be offered as stickers.

## Derby names (theme of the day)
Checked on 12/11/2026 against each derby's own Wikipedia article (the European rivalries list page links out without
naming them):

| Theme | Clubs | Source |
|---|---|---|
| North London derby | Arsenal v Tottenham | https://en.wikipedia.org/wiki/North_London_derby |
| Merseyside derby | Liverpool v Everton | https://en.wikipedia.org/wiki/Merseyside_derby |
| Manchester derby | Manchester United v Manchester City | https://en.wikipedia.org/wiki/Manchester_derby |
| Tyne–Wear derby | Newcastle v Sunderland | https://en.wikipedia.org/wiki/Tyne%E2%80%93Wear_derby |
| Northwest derby | Liverpool v Manchester United | https://en.wikipedia.org/wiki/Liverpool_F.C.%E2%80%93Manchester_United_F.C._rivalry |
| Second City derby | Aston Villa v Birmingham | https://en.wikipedia.org/wiki/Second_City_derby |
| M23 derby (dropped: too few questions) | Brighton v Crystal Palace | https://en.wikipedia.org/wiki/Brighton_%26_Hove_Albion_F.C.%E2%80%93Crystal_Palace_F.C._rivalry |
| El Clásico | Real Madrid v Barcelona | https://en.wikipedia.org/wiki/El_Cl%C3%A1sico |
| Derby della Madonnina (dropped: too few questions) | AC Milan v Inter | https://en.wikipedia.org/wiki/Derby_della_Madonnina |
| Der Klassiker (dropped: too few questions) | Bayern Munich v Dortmund | https://en.wikipedia.org/wiki/Der_Klassiker |

Not used: "East Midlands derby" (covers Derby, Forest and Leicester) and "West London derby" (covers Brentford,
Chelsea, Fulham and QPR). Neither is a two-club name.

Other theme facts: "Invincibles" refers to Arsenal's unbeaten 2003–04 Premier League season (dropped anyway, too few
questions match it).

Wikipedia text is CC BY-SA 4.0. The game uses only the derby names and pairings, which are facts.
