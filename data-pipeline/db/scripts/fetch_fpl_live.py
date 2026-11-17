import json, os, sys, time, urllib.request
OUT = sys.argv[1]
B = "https://fantasy.premierleague.com/api/"
def get(path, dest):
    if os.path.exists(dest):
        return json.load(open(dest))
    for attempt in range(4):
        try:
            req = urllib.request.Request(B + path, headers={"User-Agent": "1X2-data-builder"})
            data = json.load(urllib.request.urlopen(req, timeout=30))
            json.dump(data, open(dest, "w"))
            time.sleep(0.35)
            return data
        except Exception as e:
            time.sleep(2 + attempt * 3)
    print("FAILED", path); return None
boot = get("bootstrap-static/", f"{OUT}/bootstrap.json")
get("fixtures/", f"{OUT}/fixtures.json")
ids = [e["id"] for e in boot["elements"]]
print("players", len(ids))
for i, pid in enumerate(ids):
    get(f"element-summary/{pid}/", f"{OUT}/players/{pid}.json")
    if i % 100 == 0: print(i, flush=True)
print("done")
