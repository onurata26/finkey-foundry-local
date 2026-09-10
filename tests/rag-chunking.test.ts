import assert from "node:assert/strict";
import test from "node:test";

import { parseOffice, type OfficeContentNode } from "officeparser";

import { createSemanticChunks } from "../app/lib/rag/ingest.ts";

test("semantic chunking retains paragraph bodies and heading metadata", async () => {
  const markdown = new TextEncoder().encode(`# Risk report

Finkey's primary documented operational risk is supplier concentration.

# Mitigation

The mitigation is a quarterly supplier review with tested alternatives.

# Local architecture

Document retrieval and inference run on the user's device.`);
  const ast = await parseOffice(markdown, { fileType: "md" });
  const chunks = await createSemanticChunks(ast.content, {
    embed: async (texts) => texts.map((text) => {
      if (/risk|supplier concentration/iu.test(text)) return [1, 0, 0];
      if (/mitigation|quarterly/iu.test(text)) return [0, 1, 0];
      return [0, 0, 1];
    }),
  });

  assert.ok(chunks.some((chunk) => /supplier concentration/iu.test(chunk.text)));
  assert.ok(chunks.some((chunk) => /quarterly supplier review/iu.test(chunk.text)));
  assert.ok(chunks.some((chunk) => /user's device/iu.test(chunk.text)));
  assert.ok(chunks.every((chunk) => chunk.text.split(/\s+/u).length > 2));
  assert.ok(chunks.some((chunk) => chunk.metadata.heading === "Risk report"));
});

test("semantic chunking never merges different slides", async () => {
  const nodes: OfficeContentNode[] = [
    {
      type: "slide",
      metadata: { slideNumber: 1 },
      children: [{
        type: "paragraph",
        children: [{ type: "text", text: "The first slide contains a documented operational fact." }],
      }],
    },
    {
      type: "slide",
      metadata: { slideNumber: 2 },
      children: [{
        type: "paragraph",
        children: [{ type: "text", text: "The second slide contains another documented operational fact." }],
      }],
    },
  ];
  const chunks = await createSemanticChunks(nodes, {
    embed: async (texts) => texts.map(() => [1, 0]),
  });

  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks.map((chunk) => chunk.metadata.slideNumber), [1, 2]);
});

test("semantic chunking rejoins soft-wrapped PDF lines before embedding", async () => {
  const nodes: OfficeContentNode[] = [{
    type: "page",
    metadata: { pageNumber: 1 },
    children: [
      { type: "paragraph", text: "My technical journey started in AI, but I never wanted to limit myself to a" },
      { type: "paragraph", text: "single area." },
      { type: "paragraph", text: "That led me toward networking and distributed systems." },
    ],
  }];
  const embeddedTexts: string[] = [];
  const chunks = await createSemanticChunks(nodes, {
    embed: async (texts) => {
      embeddedTexts.push(...texts);
      return texts.map(() => [1, 0]);
    },
  });

  assert.ok(embeddedTexts.some((text) => /to a single area\./u.test(text)));
  assert.ok(chunks.some((chunk) => /to a single area\./u.test(chunk.text)));
  assert.ok(chunks.every((chunk) => !/to a$/u.test(chunk.text)));
});
