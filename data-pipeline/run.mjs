// The whole pipeline in order: fetch -> build -> generate. Usage: node --no-warnings run.mjs [--fresh]
import { execFileSync } from "node:child_process";
import { fetchPaid } from "./sources/paid-api.mjs";
const step = (f, ...a) => { console.log("\n== " + f); execFileSync(process.execPath, ["--no-warnings", f, ...a], { stdio: "inherit", cwd: new URL(".", import.meta.url).pathname }); };
step("fetch.mjs", ...process.argv.slice(2));
console.log("\n== paid API:", JSON.stringify(await fetchPaid()));
step("build.mjs");
step("generate.mjs");
