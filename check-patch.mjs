import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const profile = "C:/Users/23528/.dsh/profiles/desktop";
const require = createRequire(profile + "/");
const yaml = require("js-yaml");

const file = profile + "/cordis.patch.yml";
let doc;
try {
	doc = yaml.load(readFileSync(file, "utf8"));
} catch (error) {
	console.log("YAML BROKEN:", error.message);
	process.exit(1);
}
if (!Array.isArray(doc)) {
	console.log("NOT A LIST:", typeof doc);
	process.exit(1);
}
console.log("YAML OK — rows:", doc.length);
const bad = doc.filter((row) => row === null || typeof row !== "object");
if (bad.length > 0) console.log("!! NON-OBJECT ROWS:", JSON.stringify(bad));
for (const [index, row] of doc.entries()) {
	if (row.insert !== void 0) console.log(`insert @${index}:`, JSON.stringify(row.insert));
	else if (row.id === void 0) console.log(`!! row ${index} has no id and no insert:`, JSON.stringify(row));
}
const polish = doc.find((row) => JSON.stringify(row).includes("prompt-polish"));
console.log("prompt-polish row:", JSON.stringify(polish));
