import { warmFoundryModels } from "../app/lib/foundry-local.ts";

const lastProgress = new Map<string, number>();

console.log("Preparing Foundry Local models for Finkey…");

const models = await warmFoundryModels((model, progress) => {
  const rounded = Math.floor(progress);
  if (lastProgress.get(model) === rounded) return;
  lastProgress.set(model, rounded);
  process.stdout.write(`\r${model}: ${rounded.toString().padStart(3, " ")}%`);
  if (rounded >= 100) process.stdout.write("\n");
});

console.log(`Chat model ready: ${models.chatModel}`);
console.log(`Embedding model ready: ${models.embeddingModel}`);
console.log("Finkey can now run offline with the cached models.");
