import { resolve } from "node:path";

import { writeReadingArtifacts } from "./reading-artifacts";

const queuePath = resolve(process.argv[2] ?? "corpus/derived/reading-queue.tsv");
const outputRoot = resolve(process.argv[3] ?? "corpus/derived/reading-artifacts");

const result = await writeReadingArtifacts({
  queuePath,
  outputRoot,
});

console.log(
  [
    `artifactCount=${result.artifactCount}`,
    `artifactRoot=${result.artifactRoot}`,
    `manifestPath=${result.manifestPath}`,
    `batchPath=${result.batchPath}`,
    `promptPath=${result.promptPath}`,
  ].join("\n"),
);

