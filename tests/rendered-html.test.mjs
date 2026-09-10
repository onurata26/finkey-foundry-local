import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function render(t) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const port = 31_000 + (process.pid % 1_000);
  const server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  server.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  t.after(() => { if (!server.killed) server.kill("SIGTERM"); });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(`Next.js server exited early.\n${logs}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { accept: "text/html" },
      });
      if (response.ok) return response;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Next.js server did not become ready.\n${logs}`);
}

test("server-renders one coherent local document assistant", async (t) => {
  const response = await render(t);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Finkey Local/i);
  assert.match(html, /Belgelerini yükle\./i);
  assert.match(html, /Cevabı kaynağından al\./i);
  assert.match(html, /Dosyalar internete gönderilmez/i);
  assert.match(html, /Belgelerini ekle/i);
  assert.match(html, /Belgelerine sor/i);
  assert.match(html, /Teknik kısmı uygulama senin yerine halleder/i);
  assert.match(html, /Foundry Local \+ RAG/i);
  assert.doesNotMatch(html, /Financial clarity|Start with a business question|Keeya Europe/i);
  assert.doesNotMatch(html, /A precise answer|FINANCIAL ANSWER|Demo dataset/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the local RAG workspace and product assets", async () => {
  const [page, product, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DocumentWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/finkey-logo-transparent-96.png", import.meta.url)),
    access(new URL("../public/finkey-watercolor-hero-v2.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/favicon-transparent.png", import.meta.url)),
  ]);

  assert.match(page, /<DocumentWorkspace \/>/);
  assert.match(layout, /Finkey Local/);
  assert.match(layout, /<html lang="tr">/);
  assert.match(layout, /\/og\.png/);
  assert.match(packageJson, /"name": "finkey-financial-intelligence"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(product, /\/api\/documents/);
  assert.match(product, /\/api\/rag/);
  assert.match(product, /GroundedChart/);
  assert.match(product, /WatercolorHero/);
  assert.match(product, /source\.sourceNumber/);
  assert.doesNotMatch(product, /keeya-finance\.json|\/api\/finkey-ai/);

  await assert.rejects(access(new URL("../vite.config.ts", import.meta.url)));
  await assert.rejects(access(new URL("../worker/index.ts", import.meta.url)));
});
