import assert from "node:assert/strict";
import test from "node:test";

import { DELETE as deleteDocument } from "../app/api/documents/[id]/route.ts";
import { POST as uploadDocument } from "../app/api/documents/route.ts";
import { POST as askDocuments } from "../app/api/rag/route.ts";

test("RAG endpoints reject malformed and cross-origin Origin headers", async () => {
  const malformed = await askDocuments(new Request("http://127.0.0.1:3000/api/rag", {
    method: "POST",
    headers: { origin: "://bad", "content-type": "application/json" },
    body: JSON.stringify({ question: "test" }),
  }));
  assert.equal(malformed.status, 403);

  const crossOriginDelete = await deleteDocument(
    new Request("http://127.0.0.1:3000/api/documents/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: { origin: "http://example.test" },
    }),
    { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
  );
  assert.equal(crossOriginDelete.status, 403);
});

test("RAG endpoints treat localhost loopback aliases as the same local origin", async () => {
  const response = await askDocuments(new Request("http://localhost:3000/api/rag", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(response.status, 400);
});

test("RAG question endpoint bounds and validates JSON before inference", async () => {
  const invalidJson = await askDocuments(new Request("http://127.0.0.1:3000/api/rag", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(invalidJson.status, 400);

  const missingDocument = await askDocuments(new Request("http://127.0.0.1:3000/api/rag", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ question: "test" }),
  }));
  assert.equal(missingDocument.status, 400);

  const oversized = await askDocuments(new Request("http://127.0.0.1:3000/api/rag", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ question: "x".repeat(9_000) }),
  }));
  assert.equal(oversized.status, 413);
});

test("document upload requires bounded multipart requests", async () => {
  const response = await uploadDocument(new Request("http://127.0.0.1:3000/api/documents", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:3000",
      "content-type": "multipart/form-data; boundary=test",
    },
    body: "--test--\r\n",
  }));
  assert.equal(response.status, 411);
});
