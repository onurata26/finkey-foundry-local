import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

import type { RagChunkInput, RagDocument, RagSearchResult } from "./types.ts";

export const MAX_RAG_DOCUMENTS = 50;
export const MAX_RAG_CHUNKS = 5_000;

type DocumentRow = {
  id: string;
  name: string;
  source_type: string;
  byte_size: number;
  chunk_count: number;
  embedding_model: string;
  created_at: string;
};

type ChunkRow = {
  id: string;
  chunk_index: number;
  document_id: string;
  document_name: string;
  text: string;
  embedding_json: string;
  embedding_norm: number;
  page_number: number | null;
  slide_number: number | null;
  sheet_name: string | null;
  heading: string | null;
};

export class RagStore {
  readonly db: DatabaseSync;

  constructor(databasePath = defaultDatabasePath()) {
    if (databasePath !== ":memory:") mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  listDocuments(): RagDocument[] {
    const rows = this.db.prepare(`
      SELECT id, name, source_type, byte_size, chunk_count, embedding_model, created_at
      FROM rag_documents
      ORDER BY created_at DESC
    `).all() as unknown as DocumentRow[];
    return rows.map(mapDocument);
  }

  getDocumentById(id: string): RagDocument | null {
    const row = this.db.prepare(`
      SELECT id, name, source_type, byte_size, chunk_count, embedding_model, created_at
      FROM rag_documents
      WHERE id = ?
    `).get(id) as DocumentRow | undefined;
    return row ? mapDocument(row) : null;
  }

  getDocumentByHash(sha256: string, embeddingModel?: string): RagDocument | null {
    const row = this.db.prepare(embeddingModel ? `
      SELECT id, name, source_type, byte_size, chunk_count, embedding_model, created_at
      FROM rag_documents
      WHERE sha256 = ? AND embedding_model = ?
    ` : `
      SELECT id, name, source_type, byte_size, chunk_count, embedding_model, created_at
      FROM rag_documents
      WHERE sha256 = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(...(embeddingModel ? [sha256, embeddingModel] : [sha256])) as DocumentRow | undefined;
    return row ? mapDocument(row) : null;
  }

  insertDocument(input: {
    name: string;
    sourceType: string;
    byteSize: number;
    sha256: string;
    embeddingModel: string;
    chunks: RagChunkInput[];
  }): RagDocument {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const usage = this.db.prepare(`
        SELECT COUNT(*) AS documents, COALESCE(SUM(chunk_count), 0) AS chunks
        FROM rag_documents
      `).get() as { documents: number; chunks: number };
      if (usage.documents >= MAX_RAG_DOCUMENTS) {
        throw new Error(`The local document limit (${MAX_RAG_DOCUMENTS}) has been reached.`);
      }
      if (usage.chunks + input.chunks.length > MAX_RAG_CHUNKS) {
        throw new Error(`The local chunk limit (${MAX_RAG_CHUNKS}) would be exceeded.`);
      }
      this.db.prepare(`
        INSERT INTO rag_documents (
          id, name, source_type, byte_size, sha256, chunk_count, embedding_model, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.name,
        input.sourceType,
        input.byteSize,
        input.sha256,
        input.chunks.length,
        input.embeddingModel,
        createdAt,
      );

      const insertChunk = this.db.prepare(`
        INSERT INTO rag_chunks (
          id, document_id, chunk_index, text, embedding_json, embedding_norm,
          page_number, slide_number, sheet_name, heading, start_index, end_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      input.chunks.forEach((chunk, index) => {
        insertChunk.run(
          randomUUID(),
          id,
          index,
          chunk.text,
          JSON.stringify(chunk.embedding),
          vectorNorm(chunk.embedding),
          chunk.pageNumber ?? null,
          chunk.slideNumber ?? null,
          chunk.sheetName ?? null,
          chunk.heading ?? null,
          chunk.startIndex ?? null,
          chunk.endIndex ?? null,
        );
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return {
      id,
      name: input.name,
      sourceType: input.sourceType,
      byteSize: input.byteSize,
      chunkCount: input.chunks.length,
      embeddingModel: input.embeddingModel,
      createdAt,
    };
  }

  deleteDocument(id: string): boolean {
    return Number(this.db.prepare("DELETE FROM rag_documents WHERE id = ?").run(id).changes) > 0;
  }

  search(
    queryEmbedding: number[],
    embeddingModel: string,
    limit = 5,
    documentId?: string,
    neighborRadius = 0,
  ): RagSearchResult[] {
    const queryNorm = vectorNorm(queryEmbedding);
    if (!queryNorm) return [];
    const rows = this.db.prepare(documentId ? `
      SELECT
        c.id,
        c.chunk_index,
        c.document_id,
        d.name AS document_name,
        c.text,
        c.embedding_json,
        c.embedding_norm,
        c.page_number,
        c.slide_number,
        c.sheet_name,
        c.heading
      FROM rag_chunks c
      JOIN rag_documents d ON d.id = c.document_id
      WHERE d.embedding_model = ? AND d.id = ?
    ` : `
      SELECT
        c.id,
        c.chunk_index,
        c.document_id,
        d.name AS document_name,
        c.text,
        c.embedding_json,
        c.embedding_norm,
        c.page_number,
        c.slide_number,
        c.sheet_name,
        c.heading
      FROM rag_chunks c
      JOIN rag_documents d ON d.id = c.document_id
      WHERE d.embedding_model = ?
    `).all(...(documentId ? [embeddingModel, documentId] : [embeddingModel])) as unknown as ChunkRow[];

    const allResults = rows
      .map((row) => {
        const embedding = parseEmbedding(row.embedding_json);
        return {
          chunkId: row.id,
          chunkIndex: row.chunk_index,
          documentId: row.document_id,
          documentName: row.document_name,
          text: row.text,
          score: cosineSimilarity(queryEmbedding, embedding, queryNorm, row.embedding_norm),
          ...(row.page_number == null ? {} : { pageNumber: row.page_number }),
          ...(row.slide_number == null ? {} : { slideNumber: row.slide_number }),
          ...(row.sheet_name ? { sheetName: row.sheet_name } : {}),
          ...(row.heading ? { heading: row.heading } : {}),
        } satisfies RagSearchResult;
      });
    const boundedLimit = Math.min(8, Math.max(1, limit));
    const usefulAnchors = allResults.filter((result) =>
      !isObviousBoilerplateAnchor(result, allResults));
    const ranked = (usefulAnchors.length ? usefulAnchors : allResults)
      .sort((left, right) => right.score - left.score);
    if (!documentId || neighborRadius < 1) {
      return takeUniqueResults(ranked, boundedLimit);
    }

    const selected: RagSearchResult[] = [];
    const usedChunkIds = new Set<string>();
    const usedTexts = new Set<string>();
    for (const result of ranked) {
      const neighbors = contiguousNeighborWindow(result, allResults, neighborRadius);
      if (neighbors.some((neighbor) => usedChunkIds.has(neighbor.chunkId))) continue;

      const expanded = neighbors.length > 1
        ? { ...result, text: mergeNeighborText(result, neighbors) }
        : result;
      const textKey = normalizedResultText(expanded);
      if (textKey && usedTexts.has(textKey)) continue;

      selected.push(expanded);
      neighbors.forEach((neighbor) => usedChunkIds.add(neighbor.chunkId));
      if (textKey) usedTexts.add(textKey);
      if (selected.length >= boundedLimit) break;
    }
    return selected;
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
        sha256 TEXT NOT NULL,
        chunk_count INTEGER NOT NULL CHECK (chunk_count >= 0),
        embedding_model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(sha256, embedding_model)
      );

      CREATE TABLE IF NOT EXISTS rag_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        embedding_norm REAL NOT NULL,
        page_number INTEGER,
        slide_number INTEGER,
        sheet_name TEXT,
        heading TEXT,
        start_index INTEGER,
        end_index INTEGER,
        UNIQUE(document_id, chunk_index)
      );
    `);
    this.migrateLegacyHashConstraint();
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS rag_chunks_document_idx ON rag_chunks(document_id);
      CREATE INDEX IF NOT EXISTS rag_documents_model_idx ON rag_documents(embedding_model);
    `);
  }

  private migrateLegacyHashConstraint(): void {
    const row = this.db.prepare(`
      SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'rag_documents'
    `).get() as { sql?: string } | undefined;
    if (!row?.sql || !/sha256\s+TEXT\s+NOT\s+NULL\s+UNIQUE/iu.test(row.sql)) return;

    this.db.exec("PRAGMA foreign_keys = OFF");
    try {
      this.db.exec(`
        BEGIN IMMEDIATE;
        DROP TABLE IF EXISTS rag_chunks_new;
        DROP TABLE IF EXISTS rag_documents_new;

        CREATE TABLE rag_documents_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
          sha256 TEXT NOT NULL,
          chunk_count INTEGER NOT NULL CHECK (chunk_count >= 0),
          embedding_model TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(sha256, embedding_model)
        );

        CREATE TABLE rag_chunks_new (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL REFERENCES rag_documents_new(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL,
          text TEXT NOT NULL,
          embedding_json TEXT NOT NULL,
          embedding_norm REAL NOT NULL,
          page_number INTEGER,
          slide_number INTEGER,
          sheet_name TEXT,
          heading TEXT,
          start_index INTEGER,
          end_index INTEGER,
          UNIQUE(document_id, chunk_index)
        );

        INSERT INTO rag_documents_new
          SELECT id, name, source_type, byte_size, sha256, chunk_count, embedding_model, created_at
          FROM rag_documents;
        INSERT INTO rag_chunks_new
          SELECT id, document_id, chunk_index, text, embedding_json, embedding_norm,
                 page_number, slide_number, sheet_name, heading, start_index, end_index
          FROM rag_chunks;

        DROP TABLE rag_chunks;
        DROP TABLE rag_documents;
        ALTER TABLE rag_documents_new RENAME TO rag_documents;
        ALTER TABLE rag_chunks_new RENAME TO rag_chunks;
        COMMIT;
      `);
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch { /* no active transaction */ }
      throw error;
    } finally {
      this.db.exec("PRAGMA foreign_keys = ON");
    }
  }
}

function mergeNeighborText(anchor: RagSearchResult, chunks: RagSearchResult[]): string {
  const heading = anchor.heading?.trim() ?? "";
  const anchorFirst = [anchor, ...chunks.filter((chunk) => chunk.chunkId !== anchor.chunkId)];
  const bodies = anchorFirst.map((chunk) => textWithoutRepeatedHeading(chunk))
    .filter((body) => body && !looksLikeExplicitHeaderOrFooter(body));
  return `${heading ? `${heading}\n` : ""}${bodies.join(" ")}`.trim();
}

function contiguousNeighborWindow(
  anchor: RagSearchResult,
  allResults: RagSearchResult[],
  radius: number,
): RagSearchResult[] {
  if (anchor.chunkIndex == null) return [anchor];
  const byIndex = new Map<number, RagSearchResult>();
  for (const result of allResults) {
    if (result.documentId === anchor.documentId && result.chunkIndex != null) {
      byIndex.set(result.chunkIndex, result);
    }
  }

  const neighbors = [anchor];
  for (const direction of [-1, 1]) {
    for (let distance = 1; distance <= radius; distance += 1) {
      const candidate = byIndex.get(anchor.chunkIndex + direction * distance);
      if (!candidate || !sameStructuralSection(anchor, candidate)) break;
      neighbors.push(candidate);
    }
  }
  return neighbors.sort((left, right) => Number(left.chunkIndex) - Number(right.chunkIndex));
}

function sameStructuralSection(left: RagSearchResult, right: RagSearchResult): boolean {
  return left.pageNumber === right.pageNumber
    && left.slideNumber === right.slideNumber
    && left.sheetName === right.sheetName
    && left.heading === right.heading;
}

function takeUniqueResults(results: RagSearchResult[], limit: number): RagSearchResult[] {
  const selected: RagSearchResult[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const key = `${result.documentId}:${normalizedResultText(result)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(result);
    if (selected.length >= limit) break;
  }
  return selected;
}

function isObviousBoilerplateAnchor(
  result: RagSearchResult,
  allResults: RagSearchResult[],
): boolean {
  const body = textWithoutRepeatedHeading(result);
  if (!body) return true;
  if (body.length <= 180 && looksLikeExplicitHeaderOrFooter(body)) return true;
  if (body.length > 120 || /[.!?]\s*$/u.test(body) || body.split(/\s+/u).length > 14) return false;

  const normalized = normalizedText(body);
  const locations = new Set(
    allResults
      .filter((candidate) =>
        candidate.documentId === result.documentId
        && normalizedText(textWithoutRepeatedHeading(candidate)) === normalized)
      .map(structuralLocationKey),
  );
  return locations.size > 1;
}

function textWithoutRepeatedHeading(result: RagSearchResult): string {
  const text = result.text.trim();
  const heading = result.heading?.trim();
  if (!heading) return text;
  const lines = text.split("\n");
  return lines[0]?.trim() === heading ? lines.slice(1).join("\n").trim() : text;
}

function looksLikeExplicitHeaderOrFooter(value: string): boolean {
  const lines = value.split(/\n+/u).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return true;
  return lines.every((line) => {
    const normalized = normalizedText(line);
    return /^(?:confidential|strictly confidential|private and confidential|internal use only)$/iu.test(normalized)
      || /^(?:copyright\s*)?©?\s*\d{4}\b.*\ball rights reserved\.?$/iu.test(normalized)
      || /^(?:.*?\s*[|·•]\s*)?(?:page|sayfa|slide)\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/iu.test(normalized)
      || /^(?:page|sayfa|slide)\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/iu.test(normalized);
  });
}

function structuralLocationKey(result: RagSearchResult): string {
  return `${result.pageNumber ?? ""}|${result.slideNumber ?? ""}|${result.sheetName ?? ""}`;
}

function normalizedResultText(result: RagSearchResult): string {
  return normalizedText(result.text);
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

const globalWithRagStore = globalThis as typeof globalThis & {
  __finkeyRagStore?: RagStore;
};

export function getRagStore(): RagStore {
  globalWithRagStore.__finkeyRagStore ??= new RagStore();
  return globalWithRagStore.__finkeyRagStore;
}

export function cosineSimilarity(
  left: number[],
  right: number[],
  leftNorm = vectorNorm(left),
  rightNorm = vectorNorm(right),
): number {
  if (!leftNorm || !rightNorm || left.length !== right.length) return 0;
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
  }
  return dot / (leftNorm * rightNorm);
}

export function vectorNorm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function parseEmbedding(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(Number.isFinite) ? parsed : [];
  } catch {
    return [];
  }
}

function mapDocument(row: DocumentRow): RagDocument {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    byteSize: row.byte_size,
    chunkCount: row.chunk_count,
    embeddingModel: row.embedding_model,
    createdAt: row.created_at,
  };
}

function defaultDatabasePath(): string {
  const configuredPath = process.env.FINKEY_RAG_DB?.trim();
  return configuredPath
    ? path.resolve(/* turbopackIgnore: true */ configuredPath)
    : path.join(/* turbopackIgnore: true */ process.cwd(), "data", "finkey-rag.sqlite");
}
