import assert from "node:assert/strict";
import test from "node:test";

import { RagStore, cosineSimilarity } from "../app/lib/rag/store.ts";

test("cosine similarity ranks direction rather than vector magnitude", () => {
  assert.equal(cosineSimilarity([1, 0], [5, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 4]), 0);
  assert.equal(cosineSimilarity([1, 0], [-2, 0]), -1);
  assert.equal(cosineSimilarity([], []), 0);
});

test("SQLite RAG store persists document metadata, vectors and source locations", () => {
  const store = new RagStore(":memory:");
  try {
    const document = store.insertDocument({
      name: "finance-deck.pptx",
      sourceType: "pptx",
      byteSize: 1_024,
      sha256: "a".repeat(64),
      embeddingModel: "embedding-test",
      chunks: [
        {
          text: "Revenue increased in the enterprise segment.",
          embedding: [1, 0, 0],
          slideNumber: 4,
          heading: "Revenue",
        },
        {
          text: "Supplier concentration is the main documented risk.",
          embedding: [0, 1, 0],
          slideNumber: 8,
          heading: "Risks",
        },
      ],
    });

    assert.equal(store.listDocuments().length, 1);
    assert.equal(store.getDocumentByHash("a".repeat(64))?.id, document.id);
    assert.equal(document.chunkCount, 2);

    const results = store.search([0.1, 0.95, 0], "embedding-test", 2);
    assert.equal(results.length, 2);
    assert.match(results[0].text, /concentration/iu);
    assert.equal(results[0].slideNumber, 8);
    assert.equal(results[0].documentName, "finance-deck.pptx");
    assert.ok(results[0].score > results[1].score);

    assert.deepEqual(store.search([1, 0, 0], "different-model", 2), []);
    assert.equal(store.deleteDocument(document.id), true);
    assert.equal(store.listDocuments().length, 0);
    assert.equal(store.deleteDocument(document.id), false);
  } finally {
    store.close();
  }
});

test("SQLite RAG store scopes duplicate hashes to the embedding model", () => {
  const store = new RagStore(":memory:");
  try {
    const input = {
      name: "report.pdf",
      sourceType: "pdf",
      byteSize: 100,
      sha256: "b".repeat(64),
      embeddingModel: "embedding-test",
      chunks: [{ text: "A grounded fact.", embedding: [1, 1], pageNumber: 1 }],
    };
    store.insertDocument(input);
    assert.throws(() => store.insertDocument(input), /UNIQUE constraint failed/iu);
    const reindexed = store.insertDocument({ ...input, embeddingModel: "embedding-test-v2" });
    assert.equal(store.listDocuments().length, 2);
    assert.equal(
      store.getDocumentByHash(input.sha256, "embedding-test-v2")?.id,
      reindexed.id,
    );
  } finally {
    store.close();
  }
});

test("SQLite retrieval can be restricted to exactly one selected document", () => {
  const store = new RagStore(":memory:");
  try {
    const selected = store.insertDocument({
      name: "selected.md",
      sourceType: "md",
      byteSize: 100,
      sha256: "c".repeat(64),
      embeddingModel: "embedding-test",
      chunks: [{ text: "Selected document fact.", embedding: [1, 0] }],
    });
    const other = store.insertDocument({
      name: "other.md",
      sourceType: "md",
      byteSize: 100,
      sha256: "d".repeat(64),
      embeddingModel: "embedding-test",
      chunks: [{ text: "Other document fact.", embedding: [1, 0] }],
    });

    assert.equal(store.getDocumentById(selected.id)?.name, "selected.md");
    assert.equal(store.getDocumentById("missing"), null);
    assert.deepEqual(
      store.search([1, 0], "embedding-test", 5, selected.id).map((result) => result.documentId),
      [selected.id],
    );
    assert.deepEqual(
      store.search([1, 0], "embedding-test", 5, other.id).map((result) => result.documentId),
      [other.id],
    );
  } finally {
    store.close();
  }
});

test("neighbor expansion stays inside page, slide, sheet and heading boundaries", () => {
  const boundaries = [
    {
      label: "page",
      before: { pageNumber: 1 },
      anchor: { pageNumber: 2 },
      after: { pageNumber: 3 },
    },
    {
      label: "slide",
      before: { slideNumber: 1 },
      anchor: { slideNumber: 2 },
      after: { slideNumber: 3 },
    },
    {
      label: "sheet",
      before: { sheetName: "Prior" },
      anchor: { sheetName: "Current" },
      after: { sheetName: "Next" },
    },
    {
      label: "heading",
      before: { heading: "Prior section" },
      anchor: { heading: "Current section" },
      after: { heading: "Next section" },
    },
  ] as const;

  const store = new RagStore(":memory:");
  try {
    boundaries.forEach((boundary, index) => {
      const document = store.insertDocument({
        name: `${boundary.label}.md`,
        sourceType: "md",
        byteSize: 100,
        sha256: String(index + 1).repeat(64),
        embeddingModel: "embedding-test",
        chunks: [
          {
            text: `Previous ${boundary.label} content must stay separate.`,
            embedding: [0.7, 0.7],
            ...boundary.before,
          },
          {
            text: `Target ${boundary.label} content is the ranked anchor.`,
            embedding: [1, 0],
            ...boundary.anchor,
          },
          {
            text: `Following ${boundary.label} content must stay separate.`,
            embedding: [0.8, 0.6],
            ...boundary.after,
          },
        ],
      });

      const [result] = store.search([1, 0], "embedding-test", 1, document.id, 2);
      assert.match(result.text, new RegExp(`Target ${boundary.label}`, "iu"));
      assert.doesNotMatch(result.text, new RegExp(`Previous ${boundary.label}`, "iu"));
      assert.doesNotMatch(result.text, new RegExp(`Following ${boundary.label}`, "iu"));
    });
  } finally {
    store.close();
  }
});

test("expanded retrieval puts the ranked anchor first and suppresses overlapping windows", () => {
  const store = new RagStore(":memory:");
  try {
    const document = store.insertDocument({
      name: "windowed.md",
      sourceType: "md",
      byteSize: 100,
      sha256: "e".repeat(64),
      embeddingModel: "embedding-test",
      chunks: [
        { text: "Marker zero is supporting context.", embedding: [0.4, 0.6], heading: "Results" },
        { text: "Marker one is supporting context.", embedding: [0.5, 0.5], heading: "Results" },
        { text: "Marker two precedes the best match.", embedding: [0.8, 0.2], heading: "Results" },
        { text: "Marker three is the ranked anchor.", embedding: [1, 0], heading: "Results" },
        { text: "Marker four follows the best match.", embedding: [0.9, 0.1], heading: "Results" },
        { text: "Marker five is distant context.", embedding: [0.6, 0.4], heading: "Results" },
        { text: "Marker six is another match.", embedding: [0.7, 0.3], heading: "Results" },
      ],
    });

    const results = store.search([1, 0], "embedding-test", 3, document.id, 1);
    assert.ok(results[0].text.indexOf("Marker three") < results[0].text.indexOf("Marker two"));
    const combined = results.map((result) => result.text).join("\n");
    for (const marker of ["zero", "one", "two", "three", "four", "five", "six"]) {
      assert.equal(combined.match(new RegExp(`Marker ${marker}`, "gu"))?.length, 1);
    }
  } finally {
    store.close();
  }
});

test("retrieval ignores obvious repeated headers and page footers as anchors", () => {
  const store = new RagStore(":memory:");
  try {
    const document = store.insertDocument({
      name: "boilerplate.pdf",
      sourceType: "pdf",
      byteSize: 100,
      sha256: "f".repeat(64),
      embeddingModel: "embedding-test",
      chunks: [
        {
          text: "QUARTERLY RESULTS - INTERNAL REVIEW",
          embedding: [1, 0],
          pageNumber: 1,
        },
        {
          text: "Revenue grew because subscriptions expanded.",
          embedding: [0.9, 0.2],
          pageNumber: 1,
          heading: "Findings",
        },
        {
          text: "Findings\nFY2025 Review | Page 1",
          embedding: [0.99, 0.01],
          pageNumber: 1,
          heading: "Findings",
        },
        {
          text: "QUARTERLY RESULTS - INTERNAL REVIEW",
          embedding: [0.98, 0.02],
          pageNumber: 2,
        },
        {
          text: "Operating margin improved after costs declined.",
          embedding: [0.85, 0.25],
          pageNumber: 2,
          heading: "Findings",
        },
      ],
    });

    const results = store.search([1, 0], "embedding-test", 8, document.id);
    assert.equal(results.length, 2);
    assert.ok(results.every((result) => !/internal review|page 1/iu.test(result.text)));
    assert.match(results.map((result) => result.text).join(" "), /subscriptions.*costs/iu);
  } finally {
    store.close();
  }
});
