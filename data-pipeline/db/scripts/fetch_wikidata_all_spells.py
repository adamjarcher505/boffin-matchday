import json, os, time, urllib.request, urllib.parse
ids = json.load(open("modern_players.json"))
Q = """SELECT ?player ?club ?clubLabel ?countryLabel ?start ?end ?apps ?goals WHERE {
  VALUES ?player { %s }
  ?player p:P54 ?st . ?st ps:P54 ?club .
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?st pq:P1350 ?apps } OPTIONAL { ?st pq:P1351 ?goals }
  OPTIONAL { ?club wdt:P17 ?country }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""
B = 150
for i in range(0, len(ids), B):
    dest = f"all_spells/{i:06d}.json"
    if os.path.exists(dest): continue
    q = Q % " ".join("wd:" + x for x in ids[i:i+B])
    for attempt in range(4):
        try:
            req = urllib.request.Request("https://query.wikidata.org/sparql", data=urllib.parse.urlencode({"query": q}).encode(),
                headers={"Accept": "application/sparql-results+json", "User-Agent": "1X2-data-builder/0.1 (football quiz research)",
                         "Content-Type": "application/x-www-form-urlencoded"})
            data = urllib.request.urlopen(req, timeout=120).read(); json.loads(data)
            open(dest, "wb").write(data); break
        except Exception as e:
            print(i, "retry", e, flush=True); time.sleep(10 * (attempt + 1))
    time.sleep(1.5)
print("done")
