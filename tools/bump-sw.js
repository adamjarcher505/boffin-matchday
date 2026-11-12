// Sets VERSION in sw.js from the contents of the shipped files, and checks the precache list is complete.
// Run from the project root before every deploy:  node tools/bump-sw.js        (add --check to only verify)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), read = f => fs.readFileSync(path.join(ROOT, f));
let sw = read("sw.js").toString();
const shell = JSON.parse("[" + sw.match(/const SHELL = \[([\s\S]*?)\];/)[1] + "]").filter(f => f !== "./");
const html = read("index.html").toString(), manifest = JSON.parse(read("manifest.webmanifest"));
const needed = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).concat([...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1])).filter(u => !/^https?:/.test(u)).concat(manifest.icons.map(i => i.src), ["index.html"]);
const missing = [...new Set(needed)].filter(f => !shell.includes(f)), gone = shell.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length || gone.length) { console.error("sw.js SHELL list is wrong.", missing.length ? "Not precached: " + missing.join(", ") : "", gone.length ? "Listed but missing on disk: " + gone.join(", ") : ""); process.exit(1); }
const h = crypto.createHash("sha256"); shell.slice().sort().forEach(f => { h.update(f); h.update(read(f)); });
const version = "boffin-" + h.digest("hex").slice(0, 10), cur = sw.match(/const VERSION = "([^"]+)";/)[1];
if (process.argv.includes("--check")) { if (cur !== version) { console.error(`sw.js VERSION is stale (${cur}, files hash to ${version}). Run: node tools/bump-sw.js`); process.exit(1); } console.log("sw.js VERSION is current:", cur); }
else if (cur === version) console.log("sw.js VERSION already current:", cur);
else { fs.writeFileSync(path.join(ROOT, "sw.js"), sw.replace(/const VERSION = "[^"]+";/, `const VERSION = "${version}";`)); console.log("sw.js VERSION", cur, "->", version); }
