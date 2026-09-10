import { createHash } from "node:crypto";

import {
  parseOffice,
  type OfficeContentNode,
  type SupportedFileType,
} from "officeparser";

import {
  configuredEmbeddingModel,
  generateFoundryEmbeddings,
} from "../foundry-local.ts";
import { getRagStore } from "./store.ts";
import type { RagChunkInput, RagDocument } from "./types.ts";

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_EXTRACTED_CHARACTERS = 500_000;
export const MAX_DOCUMENT_CHUNKS = 512;
export const MAX_DOCUMENT_SENTENCES = 2_000;
const INDEXING_TIMEOUT_MS = 3 * 60_000;
const EMBEDDING_TIMEOUT_MS = 60_000;
const MAX_CHUNK_CHARACTERS = 1_800;
const SEMANTIC_SIMILARITY_THRESHOLD = 0.74;
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  "pdf", "pptx", "docx", "xlsx", "md", "csv", "html", "rtf", "epub",
] as const;

export type IndexedDocument = {
  document: RagDocument;
  duplicate: boolean;
};

export async function indexDocumentFile(file: File): Promise<IndexedDocument> {
  if (!file.name || file.size <= 0) throw new Error("Choose a non-empty document.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Documents must be 20 MB or smaller.");

  const fileType = extensionFor(file.name);
  if (!isSupportedFileType(fileType)) {
    throw new Error(`Unsupported document type. Use ${SUPPORTED_DOCUMENT_EXTENSIONS.join(", ")}.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const store = getRagStore();
  const embeddingModel = configuredEmbeddingModel();
  const existing = store.getDocumentByHash(sha256, embeddingModel);
  if (existing) return { document: existing, duplicate: true };

  const abortSignal = AbortSignal.timeout(INDEXING_TIMEOUT_MS);
  const ast = await parseOffice(bytes, {
    fileType,
    extractAttachments: false,
    includeRawContent: false,
    ignoreHeadersAndFooters: true,
    ignoreSlideMasters: true,
    abortSignal,
    decompressionLimits: {
      maxUncompressedBytes: 128 * 1024 * 1024,
      maxZipEntries: 4_000,
      maxTableCells: 100_000,
    },
  });
  hydrateContainerText(ast.content);
  const extracted = await ast.to("text", { abortSignal });
  const extractedText = normalizeChunkText(String(extracted.value));
  if (!extractedText || extractedText.length < 20) {
    throw new Error("No usable text was found. Scanned PDFs require OCR before indexing.");
  }
  if (extractedText.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error("The extracted document text is too large. Split the document into smaller files.");
  }

  const semanticChunks = await createSemanticChunks(ast.content, {
    abortSignal,
    embed: generateFoundryEmbeddings,
  });
  if (!semanticChunks.length) {
    throw new Error("No usable text was found. Scanned PDFs require OCR before indexing.");
  }
  if (semanticChunks.length > MAX_DOCUMENT_CHUNKS) {
    throw new Error("The document produced too many chunks. Split it into smaller files.");
  }

  const embeddings = await embedInBatches(
    semanticChunks.map((chunk) => chunk.text),
    16,
    generateFoundryEmbeddings,
    abortSignal,
  );
  const chunks: RagChunkInput[] = semanticChunks.map((chunk, index) => ({
    text: chunk.text,
    embedding: embeddings[index],
    ...(chunk.metadata.pageNumber == null ? {} : { pageNumber: chunk.metadata.pageNumber }),
    ...(chunk.metadata.slideNumber == null ? {} : { slideNumber: chunk.metadata.slideNumber }),
    ...(chunk.metadata.sheetName ? { sheetName: chunk.metadata.sheetName } : {}),
    ...(chunk.metadata.heading ? { heading: chunk.metadata.heading } : {}),
    ...(chunk.startIndex == null ? {} : { startIndex: chunk.startIndex }),
    ...(chunk.endIndex == null ? {} : { endIndex: chunk.endIndex }),
  }));

  const document = store.insertDocument({
    name: safeDisplayName(file.name),
    sourceType: fileType,
    byteSize: file.size,
    sha256,
    embeddingModel,
    chunks,
  });
  return { document, duplicate: false };
}

type StructuralMetadata = {
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  heading?: string;
};

type SemanticUnit = StructuralMetadata & { text: string };
type SemanticSentence = StructuralMetadata & {
  text: string;
  embeddingText: string;
  startIndex: number;
  endIndex: number;
};
type SemanticChunk = {
  text: string;
  metadata: StructuralMetadata;
  startIndex: number;
  endIndex: number;
};
type BatchEmbedder = (texts: string[]) => Promise<number[][]>;

export async function createSemanticChunks(
  nodes: OfficeContentNode[],
  options: { embed: BatchEmbedder; abortSignal?: AbortSignal },
): Promise<SemanticChunk[]> {
  hydrateContainerText(nodes);
  const units = coalesceSoftWrappedUnits(extractSemanticUnits(nodes));
  const sentences: SemanticSentence[] = [];
  let offset = 0;

  for (const unit of units) {
    throwIfAborted(options.abortSignal);
    for (const text of splitSemanticSentences(unit.text)) {
      const heading = unit.heading?.slice(0, 300);
      sentences.push({
        text,
        embeddingText: heading ? `${heading}\n${text}` : text,
        startIndex: offset,
        endIndex: offset + text.length,
        ...(unit.pageNumber == null ? {} : { pageNumber: unit.pageNumber }),
        ...(unit.slideNumber == null ? {} : { slideNumber: unit.slideNumber }),
        ...(unit.sheetName ? { sheetName: unit.sheetName } : {}),
        ...(heading ? { heading } : {}),
      });
      offset += text.length + 1;
    }
  }

  if (sentences.length > MAX_DOCUMENT_SENTENCES) {
    throw new Error("The document contains too many sentences. Split it into smaller files.");
  }
  if (!sentences.length) return [];

  const embeddings = await embedInBatches(
    sentences.map((sentence) => sentence.embeddingText),
    16,
    options.embed,
    options.abortSignal,
  );

  const chunks: SemanticChunk[] = [];
  let current: SemanticSentence[] = [];
  let currentLength = 0;
  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    const body = current.map((sentence) => sentence.text).join(" ");
    const text = normalizeChunkText(first.heading ? `${first.heading}\n${body}` : body);
    if (text.length >= 20) {
      chunks.push({
        text,
        metadata: sentenceMetadata(first),
        startIndex: first.startIndex,
        endIndex: last.endIndex,
      });
    }
    current = [];
    currentLength = 0;
  };

  for (let index = 0; index < sentences.length; index += 1) {
    throwIfAborted(options.abortSignal);
    const sentence = sentences[index];
    const previous = sentences[index - 1];
    const headingLength = sentence.heading?.length ?? 0;
    const nextLength = currentLength + sentence.text.length + (current.length ? 1 : headingLength + 1);
    const structuralBoundary = Boolean(previous && structuralKey(previous) !== structuralKey(sentence));
    const semanticBoundary = Boolean(
      previous
      && cosineSimilarity(embeddings[index - 1], embeddings[index]) < SEMANTIC_SIMILARITY_THRESHOLD,
    );
    if (current.length && (structuralBoundary || semanticBoundary || nextLength > MAX_CHUNK_CHARACTERS)) {
      flush();
    }
    current.push(sentence);
    currentLength += sentence.text.length + (current.length > 1 ? 1 : headingLength + 1);
  }
  flush();
  return chunks;
}

function hydrateContainerText(nodes: OfficeContentNode[]): void {
  const textContainers = new Set(["paragraph", "heading", "list", "cell", "code"]);
  for (const node of nodes) {
    if (node.children?.length) hydrateContainerText(node.children);
    if (node.notes?.length) hydrateContainerText(node.notes);
    if (!textContainers.has(node.type) || node.text?.trim()) continue;
    const derived = (node.children ?? [])
      .map((child) => child.text?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (derived) node.text = derived;
  }
}

async function embedInBatches(
  texts: string[],
  batchSize: number,
  embed: BatchEmbedder,
  abortSignal?: AbortSignal,
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let index = 0; index < texts.length; index += batchSize) {
    throwIfAborted(abortSignal);
    const batch = texts.slice(index, index + batchSize);
    embeddings.push(...await withTimeout(embed(batch), EMBEDDING_TIMEOUT_MS));
  }
  return embeddings;
}

function extractSemanticUnits(nodes: OfficeContentNode[]): SemanticUnit[] {
  const units: SemanticUnit[] = [];
  const atomicTypes = new Set(["paragraph", "list", "code", "cell"]);

  const walk = (items: OfficeContentNode[], inherited: StructuralMetadata): void => {
    let context = { ...inherited };
    for (const node of items) {
      if (node.type === "heading") {
        const heading = normalizeChunkText(node.text ?? textFromNode(node)).slice(0, 300);
        if (heading) context = { ...context, heading };
        continue;
      }
      if (node.type === "page" || node.type === "slide" || node.type === "sheet") {
        const metadata = node.metadata as Record<string, unknown> | undefined;
        const nested: StructuralMetadata = {
          ...context,
          ...(node.type === "page" && Number.isInteger(metadata?.pageNumber)
            ? { pageNumber: Number(metadata?.pageNumber) }
            : {}),
          ...(node.type === "slide" && Number.isInteger(metadata?.slideNumber)
            ? { slideNumber: Number(metadata?.slideNumber) }
            : {}),
          ...(node.type === "sheet" && typeof metadata?.sheetName === "string"
            ? { sheetName: metadata.sheetName }
            : {}),
        };
        if (node.children?.length) walk(node.children, nested);
        if (node.notes?.length) walk(node.notes, nested);
        continue;
      }
      if (node.type === "table") {
        pushUnit(units, textFromNode(node), context);
        continue;
      }
      if (atomicTypes.has(node.type)) {
        pushUnit(units, node.text ?? textFromNode(node), context);
        continue;
      }
      if (node.children?.length) walk(node.children, context);
      else if (node.text) pushUnit(units, node.text, context);
      if (node.notes?.length) walk(node.notes, context);
    }
  };

  walk(nodes, {});
  return units;
}

function pushUnit(units: SemanticUnit[], value: string, metadata: StructuralMetadata): void {
  const text = normalizeChunkText(value);
  if (text) units.push({ text, ...metadata });
}

function coalesceSoftWrappedUnits(units: SemanticUnit[]): SemanticUnit[] {
  const merged: SemanticUnit[] = [];
  for (const unit of units) {
    const previous = merged.at(-1);
    const looksSoftWrapped = previous
      && structuralKey(previous) === structuralKey(unit)
      && previous.text.length <= 240
      && unit.text.length <= 240
      && !/[.!?。！？]$/u.test(previous.text);
    if (looksSoftWrapped) {
      merged[merged.length - 1] = {
        ...previous,
        text: `${previous.text} ${unit.text}`,
      };
    } else {
      merged.push(unit);
    }
  }
  return merged;
}

function textFromNode(node: OfficeContentNode): string {
  if (!node.children?.length) return node.text ?? "";
  const separator = node.type === "table" ? "\n" : node.type === "row" ? " | " : " ";
  return node.children.map(textFromNode).filter(Boolean).join(separator);
}

function splitSemanticSentences(value: string): string[] {
  const pieces = normalizeChunkText(value)
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return pieces.flatMap((piece) => splitOversizedText(piece, MAX_CHUNK_CHARACTERS - 320));
}

function splitOversizedText(value: string, maxLength: number): string[] {
  if (value.length <= maxLength) return [value];
  const parts: string[] = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    const candidate = remaining.slice(0, maxLength);
    const whitespace = candidate.lastIndexOf(" ");
    const cut = whitespace > maxLength * 0.6 ? whitespace : maxLength;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function sentenceMetadata(sentence: SemanticSentence): StructuralMetadata {
  return {
    ...(sentence.pageNumber == null ? {} : { pageNumber: sentence.pageNumber }),
    ...(sentence.slideNumber == null ? {} : { slideNumber: sentence.slideNumber }),
    ...(sentence.sheetName ? { sheetName: sentence.sheetName } : {}),
    ...(sentence.heading ? { heading: sentence.heading } : {}),
  };
}

function structuralKey(value: StructuralMetadata): string {
  return `${value.pageNumber ?? ""}|${value.slideNumber ?? ""}|${value.sheetName ?? ""}|${value.heading ?? ""}`;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return -1;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : -1;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new Error("Document indexing timed out.");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Local embedding generation timed out.")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeChunkText(value: string): string {
  return value.replace(/\u0000/gu, "").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();
}

function safeDisplayName(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/gu, "").trim();
  return normalized.slice(0, 180) || "document";
}

function extensionFor(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

function isSupportedFileType(value: string): value is SupportedFileType {
  return (SUPPORTED_DOCUMENT_EXTENSIONS as readonly string[]).includes(value);
}
