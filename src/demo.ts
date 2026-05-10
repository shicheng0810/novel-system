import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildDemoReport } from "./index";

const sample = readFileSync(join(process.cwd(), "examples", "sample-world.md"), "utf8");

console.log(buildDemoReport(sample, { expandMetaphysics: true }));

