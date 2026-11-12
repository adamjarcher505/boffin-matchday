// scratch query helper: node tests/q.js "<expression>"  (prints the result of evaluating it inside the game)
const { load } = require("./harness.js"); const g = load();
const r = g.run(process.argv[2]); console.log(typeof r === "string" ? r : JSON.stringify(r, null, 1));
