import json, os, sys, time, urllib.request, urllib.parse
clubs = {}
for b in json.load(open("clubs.json"))["results"]["bindings"]:
    clubs[b["club"]["value"].rsplit("/",1)[1]] = b["clubLabel"]["value"]
Q = """SELECT ?player ?playerLabel ?dob ?nat ?natLabel ?pos ?posLabel ?start ?end ?apps ?goals WHERE {
  ?player p:P54 ?st . ?st ps:P54 wd:%s .
  ?player wdt:P31 wd:Q5 .
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?st pq:P1350 ?apps } OPTIONAL { ?st pq:P1351 ?goals }
  OPTIONAL { ?player wdt:P569 ?dob }
  OPTIONAL { ?player wdt:P1532 ?nat }
  OPTIONAL { ?player wdt:P413 ?pos }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""
for qid, name in clubs.items():
    dest = f"careers/{qid}.json"
    if os.path.exists(dest): continue
    for attempt in range(4):
        try:
            url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": Q % qid})
            req = urllib.request.Request(url, headers={"Accept": "application/sparql-results+json", "User-Agent": "1X2-data-builder/0.1 (football quiz research)"})
            data = urllib.request.urlopen(req, timeout=120).read()
            json.loads(data); open(dest, "wb").write(data)
            print(name, "ok", flush=True); break
        except Exception as e:
            print(name, "retry", e, flush=True); time.sleep(10 * (attempt + 1))
    time.sleep(2)
