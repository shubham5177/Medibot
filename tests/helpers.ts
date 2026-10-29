import { readFileSync } from "node:fs";
import { buildDataset, parseDatasetText } from "../lib/dataset.ts";
import { buildIndex } from "../lib/matching.ts";

export const sample = parseDatasetText(readFileSync(new URL("../data/healthcare_dataset.json", import.meta.url), "utf8"), "json");
export const sampleIndex = buildIndex(sample.records);
export { buildDataset, buildIndex };
