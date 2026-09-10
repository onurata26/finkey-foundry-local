import path from "node:path";

import {
  DeviceType,
  FoundryLocalManager,
  type ChatClient,
  type EmbeddingClient,
  type IModel,
} from "foundry-local-sdk";

export const FOUNDRY_CHAT_MODEL_DEFAULT = "qwen3.5-2b-text";
export const FOUNDRY_EMBEDDING_MODEL_DEFAULT = "qwen3-embedding-0.6b";

export type FoundryJsonRequest = {
  systemInstruction: string;
  input: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
};

export type FoundryJsonResponse = {
  text: string;
  model: string;
};

type FoundryRuntimeState = {
  managerPromise?: Promise<FoundryLocalManager>;
  chatPromise?: Promise<{ model: IModel; client: ChatClient }>;
  embeddingPromise?: Promise<{ model: IModel; client: EmbeddingClient }>;
  chatQueue: Promise<void>;
  embeddingQueue: Promise<void>;
};

const globalWithFoundry = globalThis as typeof globalThis & {
  __finkeyFoundryRuntime?: FoundryRuntimeState;
};

const runtime = globalWithFoundry.__finkeyFoundryRuntime ?? {
  chatQueue: Promise.resolve(),
  embeddingQueue: Promise.resolve(),
};

globalWithFoundry.__finkeyFoundryRuntime = runtime;

export async function completeFoundryJson(
  request: FoundryJsonRequest,
): Promise<FoundryJsonResponse> {
  return enqueue("chat", async () => {
    const { model, client } = await getChatRuntime();
    client.settings.temperature = 0;
    client.settings.topP = 1;
    client.settings.randomSeed = 7;
    client.settings.maxTokens = request.maxOutputTokens;
    client.settings.toolChoice = { type: "none" };
    client.settings.responseFormat = {
      type: "json_schema",
      jsonSchema: JSON.stringify(request.schema),
    };

    const response = await client.completeChat([
      { role: "system", content: request.systemInstruction },
      { role: "user", content: request.input },
    ]);
    const text = response?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Foundry Local returned an empty structured response.");
    }
    return { text: text.trim(), model: model.alias || model.id };
  });
}

export async function generateFoundryEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateFoundryEmbeddings([text]);
  if (!embedding) throw new Error("Foundry Local did not return an embedding.");
  return embedding;
}

export async function generateFoundryEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts.length || texts.some((text) => !text.trim())) {
    throw new Error("Embedding input must contain non-empty text.");
  }
  return enqueue("embedding", async () => {
    const { client } = await getEmbeddingRuntime();
    const response = texts.length === 1
      ? await client.generateEmbedding(texts[0])
      : await client.generateEmbeddings(texts);
    const data = Array.isArray(response?.data) ? response.data : [];
    const embeddings = data
      .slice()
      .sort((left: { index?: number }, right: { index?: number }) =>
        Number(left.index ?? 0) - Number(right.index ?? 0))
      .map((item: { embedding?: unknown }) => item.embedding)
      .filter((value: unknown): value is number[] =>
        Array.isArray(value) && value.length > 0 && value.every(Number.isFinite));
    if (embeddings.length !== texts.length) {
      throw new Error("Foundry Local returned an invalid embedding batch.");
    }
    return embeddings;
  });
}

export async function warmFoundryModels(
  onProgress?: (model: string, progress: number) => void,
): Promise<{ chatModel: string; embeddingModel: string }> {
  const manager = await getManager();
  const chatAlias = configuredChatModel();
  const embeddingAlias = configuredEmbeddingModel();
  const chatModel = await getCpuModel(manager, chatAlias);
  const embeddingModel = await getCpuModel(manager, embeddingAlias);

  await ensureDownloaded(chatModel, (progress) => onProgress?.(chatAlias, progress));
  await ensureDownloaded(embeddingModel, (progress) => onProgress?.(embeddingAlias, progress));

  return { chatModel: chatAlias, embeddingModel: embeddingAlias };
}

export function configuredChatModel(): string {
  return process.env.FOUNDRY_CHAT_MODEL?.trim() || FOUNDRY_CHAT_MODEL_DEFAULT;
}

export function configuredEmbeddingModel(): string {
  return process.env.FOUNDRY_EMBEDDING_MODEL?.trim() || FOUNDRY_EMBEDDING_MODEL_DEFAULT;
}

async function getManager(): Promise<FoundryLocalManager> {
  const configuredDataDir = process.env.FOUNDRY_APP_DATA_DIR?.trim();
  const appDataDir = configuredDataDir
    ? path.resolve(/* turbopackIgnore: true */ configuredDataDir)
    : path.join(/* turbopackIgnore: true */ process.cwd(), "data", "foundry");
  runtime.managerPromise ??= FoundryLocalManager.createAsync({
    appName: "finkey-local",
    appDataDir,
    modelCacheDir: path.join(appDataDir, "models"),
    logsDir: path.join(appDataDir, "logs"),
    logLevel: process.env.FOUNDRY_LOG_LEVEL === "debug" ? "debug" : "warn",
  }).catch((error) => {
    runtime.managerPromise = undefined;
    throw error;
  });
  return runtime.managerPromise;
}

async function getChatRuntime(): Promise<{ model: IModel; client: ChatClient }> {
  runtime.chatPromise ??= loadChatModel(configuredChatModel()).catch((error) => {
    runtime.chatPromise = undefined;
    throw error;
  });
  return await runtime.chatPromise;
}

async function getEmbeddingRuntime(): Promise<{ model: IModel; client: EmbeddingClient }> {
  runtime.embeddingPromise ??= loadEmbeddingModel(configuredEmbeddingModel()).catch((error) => {
    runtime.embeddingPromise = undefined;
    throw error;
  });
  return await runtime.embeddingPromise;
}

async function loadChatModel(alias: string): Promise<{ model: IModel; client: ChatClient }> {
  const manager = await getManager();
  const model = await getCpuModel(manager, alias);
  await ensureDownloaded(model);
  if (!(await model.isLoaded())) await model.load();
  return { model, client: model.createChatClient() };
}

async function loadEmbeddingModel(alias: string): Promise<{ model: IModel; client: EmbeddingClient }> {
  const manager = await getManager();
  const model = await getCpuModel(manager, alias);
  await ensureDownloaded(model);
  if (!(await model.isLoaded())) await model.load();
  return { model, client: model.createEmbeddingClient() };
}

async function getCpuModel(manager: FoundryLocalManager, alias: string): Promise<IModel> {
  const model = await manager.catalog.getModel(alias);
  const cpuVariant = model.variants.find(
    (variant) => variant.info.runtime?.deviceType === DeviceType.CPU,
  );
  if (!cpuVariant) {
    throw new Error(`Foundry Local model '${alias}' does not provide a CPU variant.`);
  }
  model.selectVariant(cpuVariant);
  return model;
}

async function ensureDownloaded(
  model: IModel,
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (model.isCached) return;
  await model.download((progress) => onProgress?.(progress));
}

function enqueue<T>(kind: "chat" | "embedding", task: () => Promise<T>): Promise<T> {
  const queueKey = kind === "chat" ? "chatQueue" : "embeddingQueue";
  const run = runtime[queueKey].then(task, task);
  runtime[queueKey] = run.then(() => undefined, () => undefined);
  return run;
}
