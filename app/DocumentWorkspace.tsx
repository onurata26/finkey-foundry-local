"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Check,
  Clipboard,
  Database,
  FileCheck2,
  FileText,
  HardDrive,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import WatercolorHero from "./components/WatercolorHero";
import type { RagAnswer, RagChart, RagDocument } from "./lib/rag/types";

type BusyState = "upload" | "ask" | "delete" | null;

const SUGGESTED_QUESTIONS = [
  "Bu belgenin ana konusu ve önemli sonuçları neler?",
  "Belgede belirtilen en önemli riskler hangileri?",
  "Yıllara göre sayısal değişimi karşılaştır ve uygunsa grafikle göster.",
];

export default function DocumentWorkspace() {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { documents?: RagDocument[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Belge kitaplığı okunamadı.");
        if (active) {
          const nextDocuments = payload.documents ?? [];
          setDocuments(nextDocuments);
          setSelectedDocumentId((current) =>
            nextDocuments.some((document) => document.id === current)
              ? current
              : nextDocuments[0]?.id ?? "");
        }
      })
      .catch((error: unknown) => {
        if (active) setStatus(readError(error, "Belge kitaplığı okunamadı."));
      })
      .finally(() => {
        if (active) setDocumentsLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || busy) {
      if (!file) setStatus("Önce bir belge seç.");
      return;
    }

    setBusy("upload");
    setAnswer(null);
    setStatus("Belge bu cihazda okunuyor, anlamlı parçalara ayrılıyor ve indeksleniyor…");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const payload = await response.json() as {
        document?: RagDocument;
        duplicate?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.document) {
        throw new Error(payload.error ?? "Belge indekslenemedi.");
      }
      setDocuments((current) => {
        const others = current.filter((item) => item.id !== payload.document?.id);
        return payload.document ? [payload.document, ...others] : current;
      });
      setSelectedDocumentId(payload.document.id);
      setStatus(payload.duplicate
        ? "Bu belge daha önce eklenmişti; mevcut yerel indeks kullanılıyor."
        : `${payload.document.name} hazır. Artık belge hakkında soru sorabilirsin.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      window.requestAnimationFrame(() => questionRef.current?.focus());
    } catch (error) {
      setStatus(readError(error, "Belge indekslenemedi."));
    } finally {
      setBusy(null);
    }
  }

  async function removeDocument(document: RagDocument) {
    if (busy) return;
    setBusy("delete");
    setStatus(`${document.name} yerel kitaplıktan kaldırılıyor…`);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      const noLongerPresent = response.status === 404;
      if ((!response.ok || !payload.ok) && !noLongerPresent) {
        throw new Error(payload.error ?? "Belge kaldırılamadı.");
      }
      setDocuments((current) => {
        const nextDocuments = current.filter((item) => item.id !== document.id);
        setSelectedDocumentId((selected) =>
          selected === document.id ? nextDocuments[0]?.id ?? "" : selected);
        return nextDocuments;
      });
      setAnswer(null);
      setStatus(noLongerPresent
        ? `${document.name} yerel indekste artık bulunmuyor.`
        : `${document.name} yalnızca bu cihazdaki indeksten kaldırıldı.`);
    } catch (error) {
      setStatus(readError(error, "Belge kaldırılamadı."));
    } finally {
      setBusy(null);
    }
  }

  async function askDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    const selectedDocument = documents.find((document) => document.id === selectedDocumentId);
    if (!cleanQuestion || !selectedDocument || busy) {
      if (!selectedDocument) setStatus("Önce cevap alınacak belgeyi seç.");
      return;
    }

    setBusy("ask");
    setAnswer(null);
    setCopied(false);
    setStatus(`${selectedDocument.name} içinde en alakalı bölümler bulunuyor ve Foundry Local cevabı hazırlıyor…`);
    try {
      const response = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, documentId: selectedDocument.id }),
      });
      const payload = await response.json() as (Partial<RagAnswer> & { error?: string });
      if (
        !response.ok
        || typeof payload.answer !== "string"
        || typeof payload.model !== "string"
        || !Array.isArray(payload.sources)
      ) {
        throw new Error(payload.error ?? "Yerel cevap üretilemedi.");
      }
      const nextAnswer: RagAnswer = {
        answer: payload.answer,
        model: payload.model,
        chart: payload.chart ?? null,
        sources: payload.sources,
      };
      setAnswer(nextAnswer);
      setStatus(nextAnswer.sources.length
        ? "Cevap yalnızca gösterilen kaynaklara dayanıyor."
        : "Bu soruyu yanıtlayacak kadar alakalı bilgi bulunamadı.");
      window.requestAnimationFrame(() => answerRef.current?.focus({ preventScroll: false }));
    } catch (error) {
      setStatus(readError(error, "Yerel cevap üretilemedi."));
    } finally {
      setBusy(null);
    }
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function copyAnswer() {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer.answer);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setStatus("Kopyalama kullanılamadı; cevap metnini seçerek kopyalayabilirsin.");
    }
  }

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const canAsk = selectedDocument !== null && question.trim().length > 0 && busy === null;

  return (
    <div className="rag-app">
      <a className="rag-skip-link" href="#workspace">Belge çalışma alanına geç</a>

      <header className="rag-header">
        <a className="rag-brand" href="#top" aria-label="Finkey Local ana sayfa">
          <span className="rag-brand-mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/finkey-logo-transparent-96.png" alt="" width="30" height="36" />
          </span>
          <span>
            <strong>Finkey</strong>
            <small>LOCAL</small>
          </span>
        </a>
        <nav aria-label="Ana menü">
          <a href="#documents">Belgeler</a>
          <a href="#question">Soru sor</a>
          <a href="#how-it-works">Nasıl çalışır?</a>
        </nav>
        <span className="rag-device-badge"><LockKeyhole size={15} /> Bu cihazda çalışır</span>
      </header>

      <main id="top">
        <section className="rag-hero" aria-labelledby="rag-title">
          <WatercolorHero className="rag-hero-watercolor" />
          <div className="rag-hero-scrim" aria-hidden="true" />
          <div className="rag-hero-copy">
            <span className="rag-eyebrow"><Sparkles size={15} /> FOUNDRY LOCAL + RAG</span>
            <h1 id="rag-title">Belgelerini yükle.<br />Cevabı kaynağından al.</h1>
            <p>
              PDF, PowerPoint, Word veya tablo dosyanı ekle. Finkey en alakalı bölümleri
              bulur, yerel yapay zekâyla cevaplar ve kullanılan kaynakları gösterir.
            </p>
            <div className="rag-hero-trust">
              <span><ShieldCheck size={17} /> Dosyalar internete gönderilmez</span>
              <span><HardDrive size={17} /> Bilgiler yalnız bu cihazda saklanır</span>
            </div>
          </div>
          <div className="rag-flow-card" aria-label="Yerel belge soru cevap akışı">
            <div><span>1</span><FileText size={20} /><strong>Belgeyi ekle</strong></div>
            <div><span>2</span><MessageSquareText size={20} /><strong>Sorunu sor</strong></div>
            <div><span>3</span><FileCheck2 size={20} /><strong>Kaynağı gör</strong></div>
          </div>
        </section>

        <section className="rag-workspace" id="workspace" aria-label="Yerel belge çalışma alanı">
          <aside className="rag-documents-panel" id="documents">
            <div className="rag-panel-heading">
              <span className="rag-step">1</span>
              <div><h2>Belgelerini ekle</h2><p>Dosyanı ekle, sonra cevap almak istediğin tek belgeyi seç.</p></div>
            </div>

            <form className="rag-upload" onSubmit={uploadDocument}>
              <label htmlFor="local-document-file"><Upload size={20} /><strong>Bir dosya seç</strong><span>PDF, PPTX, DOCX, XLSX, MD, CSV ve daha fazlası · En fazla 20 MB</span></label>
              <input
                ref={fileInputRef}
                id="local-document-file"
                type="file"
                name="file"
                accept=".pdf,.pptx,.docx,.xlsx,.md,.csv,.html,.rtf,.epub"
                disabled={busy !== null}
              />
              <button type="submit" disabled={busy !== null}>
                {busy === "upload" ? <LoaderCircle className="rag-spin" size={17} /> : <Upload size={17} />}
                {busy === "upload" ? "Hazırlanıyor…" : "Belgeyi hazırla"}
              </button>
            </form>

            <div className="rag-library-heading">
              <span><Database size={16} /> Cevaplanacak belgeyi seç</span>
              <small>{documents.length} belge</small>
            </div>
            <div className="rag-library" aria-live="polite">
              {documentsLoading ? (
                <div className="rag-library-empty"><LoaderCircle className="rag-spin" size={19} /> Belge kitaplığı okunuyor…</div>
              ) : documents.length === 0 ? (
                <div className="rag-library-empty"><FileText size={20} /><strong>Henüz belge yok</strong><span>Başlamak için yukarıdan bir dosya seç.</span></div>
              ) : (
                <ul>
                  {documents.map((document) => (
                    <li key={document.id} className={document.id === selectedDocumentId ? "rag-document-selected" : undefined}>
                      <label className="rag-document-choice">
                        <input
                          type="radio"
                          name="answer-document"
                          value={document.id}
                          checked={document.id === selectedDocumentId}
                          onChange={() => {
                            setSelectedDocumentId(document.id);
                            setAnswer(null);
                            setStatus(`${document.name} cevaplanacak belge olarak seçildi.`);
                          }}
                          disabled={busy !== null}
                        />
                        <span className="rag-file-icon"><FileText size={18} /></span>
                        <div><strong>{document.name}</strong><span>{document.sourceType.toUpperCase()} · {document.chunkCount} anlam parçası · {formatFileSize(document.byteSize)}</span></div>
                      </label>
                      <button className="rag-document-delete" type="button" onClick={() => void removeDocument(document)} disabled={busy !== null} aria-label={`${document.name} belgesini kaldır`}><Trash2 size={16} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="rag-question-panel" id="question" aria-labelledby="question-title">
            <div className="rag-panel-heading">
              <span className="rag-step">2</span>
              <div><h2 id="question-title">Seçili belgene sor</h2><p>{selectedDocument ? `Yalnızca ${selectedDocument.name} içinde aranır.` : "Önce soldan bir belge seç."}</p></div>
            </div>

            <form className="rag-question-form" onSubmit={askDocuments}>
              <label htmlFor="document-question" className="sr-only">Belgelere sorulacak soru</label>
              <textarea
                ref={questionRef}
                id="document-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                rows={4}
                maxLength={2_000}
                placeholder={selectedDocument ? "Örneğin: Bu belgenin ana konusunu ve önemli noktalarını açıkla." : "Soru sorabilmek için önce bir belge seç."}
                disabled={!selectedDocument || busy !== null}
              />
              <div className="rag-question-actions">
                <span>Enter ile gönder · Shift + Enter ile yeni satır</span>
                <button type="submit" disabled={!canAsk}>
                  {busy === "ask" ? <LoaderCircle className="rag-spin" size={18} /> : <Send size={18} />}
                  {busy === "ask" ? "Cevaplanıyor…" : "Sor"}
                </button>
              </div>
            </form>

            {!answer && selectedDocument && (
              <div className="rag-suggestions" aria-label="Örnek sorular">
                <span>Örnek sorular</span>
                <div>{SUGGESTED_QUESTIONS.map((item) => <button type="button" key={item} onClick={() => { setQuestion(item); questionRef.current?.focus(); }} disabled={busy !== null}>{item}</button>)}</div>
              </div>
            )}

            {status && <p className="rag-status" role="status">{busy && <LoaderCircle className="rag-spin" size={15} />}{status}</p>}

            {answer && (
              <article className="rag-answer" ref={answerRef} tabIndex={-1} aria-labelledby="answer-title">
                <div className="rag-answer-heading">
                  <div><span className="rag-answer-icon"><Sparkles size={18} /></span><div><small>YEREL CEVAP</small><h3 id="answer-title">Belgene dayalı yanıt</h3></div></div>
                  <button type="button" onClick={() => void copyAnswer()}><span className="sr-only">Cevabı kopyala</span>{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? "Kopyalandı" : "Kopyala"}</button>
                </div>
                <p className="rag-answer-copy">{answer.answer}</p>
                {answer.chart && <GroundedChart chart={answer.chart} />}
                <div className="rag-sources">
                  <div className="rag-sources-heading"><strong>Kullanılan kaynaklar</strong><span>{answer.sources.length} doğrulanmış kaynak bölümü</span></div>
                  {answer.sources.length === 0 ? (
                    <p className="rag-no-source">Bu soruya yeterince yakın bir kaynak bölümü bulunamadı.</p>
                  ) : (
                    <ol>
                      {answer.sources.map((source, index) => (
                        <li key={`${source.documentId}-${source.sourceNumber}-${index}`}>
                          <div className="rag-source-meta">
                            <span>Kaynak {source.sourceNumber}</span>
                            <strong>{source.documentName}</strong>
                            {source.location && <small>{translateLocation(source.location)}</small>}
                          </div>
                          <blockquote>{source.excerpt}</blockquote>
                          <span className="rag-source-score">Eşleşme %{Math.round(source.score * 100)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <footer><ShieldCheck size={15} /><span>Model: {answer.model} · Cevap ve grafik değerleri gösterilen alıntılarla kontrol edildi.</span></footer>
              </article>
            )}
          </section>
        </section>

        <section className="rag-method" id="how-it-works" aria-labelledby="method-title">
          <div className="rag-method-intro"><span className="rag-eyebrow">NASIL ÇALIŞIR?</span><h2 id="method-title">Teknik kısmı uygulama senin yerine halleder.</h2><p>Sen yalnızca belgeyi seçip sorunu yazarsın.</p></div>
          <div className="rag-method-grid">
            <article><span>01</span><FileText size={22} /><h3>Belge okunur</h3><p>Metin; sayfa, slayt, başlık ve tablo sınırları korunarak çıkarılır.</p></article>
            <article><span>02</span><Database size={22} /><h3>Yerel hafızaya alınır</h3><p>Anlamlı parçalar ve arama vektörleri cihazdaki tek bir veritabanı dosyasında tutulur.</p></article>
            <article><span>03</span><Sparkles size={22} /><h3>Kaynaklı cevap verilir</h3><p>Soruna en yakın parçalar bulunur; Foundry Local yalnızca bu kaynaklarla cevap oluşturur.</p></article>
          </div>
          <details className="rag-technical-details">
            <summary>Teknik ayrıntıları göster</summary>
            <p>Belgeler semantic chunk’lara ayrılır, Foundry Local embedding’leri SQLite içinde saklanır ve soru sırasında cosine similarity ile sıralanır. SQLite burada ayrıca kurman gereken bir sunucu değil; uygulamanın yönettiği yerel bir dosyadır. Model ağırlıkları ise Foundry Local önbelleğinde ayrı tutulur.</p>
          </details>
        </section>
      </main>

      <footer className="rag-footer"><span>Finkey Local</span><p>Yerel belge zekâsı · Bulut yapay zekâ API’si yok · API anahtarı yok</p></footer>
    </div>
  );
}

function GroundedChart({ chart }: { chart: RagChart }) {
  const common = {
    data: chart.points,
    margin: { top: 24, right: 16, bottom: 8, left: 8 },
  };
  const axis = <>
    <CartesianGrid stroke="#e7e9ee" strokeDasharray="3 5" vertical={false} />
    <XAxis dataKey="label" tick={{ fill: "#59606c", fontSize: 11 }} axisLine={false} tickLine={false} />
    <YAxis tickFormatter={formatCompactNumber} tick={{ fill: "#7b818c", fontSize: 10 }} axisLine={false} tickLine={false} width={56} />
    <Tooltip formatter={(value) => formatCompactNumber(Number(value))} />
  </>;

  return (
    <section className="rag-chart" aria-labelledby="rag-chart-title">
      <div className="rag-chart-heading"><div><span><BarChart3 size={16} /> DOĞRULANMIŞ GRAFİK</span><h4 id="rag-chart-title">{chart.title}</h4><p>{chart.unit} · yalnızca kaynakta açıkça geçen değerler</p></div><small>{chart.type === "line" ? "Trend" : "Karşılaştırma"}</small></div>
      <div className="rag-chart-canvas" role="img" aria-label={`${chart.title}. ${chart.points.length} doğrulanmış değer.`}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "line" ? (
            <LineChart {...common}>
              {axis}
              <Line type="monotone" dataKey="value" stroke="#4c5cf0" strokeWidth={3} dot={{ r: 4, fill: "#4c5cf0" }} activeDot={{ r: 6 }} isAnimationActive={false}>
                <LabelList dataKey="displayValue" position="top" fill="#30343b" fontSize={10} />
              </Line>
            </LineChart>
          ) : (
            <BarChart {...common}>
              {axis}
              <Bar dataKey="value" fill="#4c5cf0" radius={[8, 8, 2, 2]} isAnimationActive={false}>
                <LabelList dataKey="displayValue" position="top" fill="#30343b" fontSize={10} />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="rag-chart-table">
        <summary>Grafik değerlerini ve kaynaklarını göster</summary>
        <table><thead><tr><th>Etiket</th><th>Kaynak değeri</th><th>Kaynak</th></tr></thead><tbody>{chart.points.map((point) => <tr key={point.label}><td>{point.label}</td><td>{point.displayValue}</td><td>Kaynak {point.sourceNumber}</td></tr>)}</tbody></table>
      </details>
    </section>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function translateLocation(location: string): string {
  return location
    .replace(/^page\s+/iu, "Sayfa ")
    .replace(/^slide\s+/iu, "Slayt ")
    .replace(/^sheet\s+/iu, "Sayfa: ")
    .replace(/^section\s+/iu, "Bölüm: ");
}

function readError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
