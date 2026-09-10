"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleAlert,
  Clipboard,
  Database,
  FileText,
  LineChart as LineChartIcon,
  Menu,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AnalysisResult,
  ChartSeries,
  FinanceDataset,
  analyzePlan,
  buildFactStore,
  formatCurrency,
  formatNumber,
  formatPercent,
  interpretQuestionRules,
  materializeAiPlan,
} from "./lib/analytics";
import {
  FinkeyAiEnhancement,
  FinkeyAiRequest,
  FinkeyAiResponse,
  buildCompactAiEvidence,
} from "./lib/finkey-ai-contract";
import WatercolorHero from "./components/WatercolorHero";

const INITIAL_QUESTION = "How did net revenue and operating result evolve from 2021 to 2024?";

const PIE_COLORS = ["#3155f5", "#18212f", "#6f8f83", "#a97c61", "#8e7aa8", "#8f9aaa"];
const AI_INTERPRET_TIMEOUT_MS = 180_000;
const AI_EXPLAIN_TIMEOUT_MS = 240_000;
type AiEvidenceRef = FinkeyAiEnhancement["evidenceRefs"][number];

type AiEnhancementState =
  | { status: "idle" }
  | { status: "interpreting" }
  | { status: "explaining" }
  | { status: "ready"; enhancement: FinkeyAiEnhancement; model: string }
  | { status: "fallback"; message: string; retryable: boolean };

type KnowledgeDocument = {
  id: string;
  name: string;
  sourceType: string;
  byteSize: number;
  chunkCount: number;
  createdAt: string;
};

type KnowledgeAnswer = {
  answer: string;
  model: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    score: number;
    excerpt: string;
    location: string;
  }>;
};

const AI_EVIDENCE_LABELS: Record<AiEvidenceRef, string> = {
  chart: "Exact chart data",
  method: "Calculation method",
  evidence: "Evidence rows",
};

export default function KeeyaIntelligence() {
  const [dataset, setDataset] = useState<FinanceDataset | null>(null);
  const [factStore, setFactStore] = useState<ReturnType<typeof buildFactStore> | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [question, setQuestion] = useState(INITIAL_QUESTION);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [aiState, setAiState] = useState<AiEnhancementState>({ status: "idle" });
  const [aiRetryCoolingDown, setAiRetryCoolingDown] = useState(false);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedKnowledgeDocumentId, setSelectedKnowledgeDocumentId] = useState("");
  const [knowledgeQuestion, setKnowledgeQuestion] = useState("");
  const [knowledgeAnswer, setKnowledgeAnswer] = useState<KnowledgeAnswer | null>(null);
  const [knowledgeBusy, setKnowledgeBusy] = useState<"upload" | "ask" | "delete" | null>(null);
  const [knowledgeMessage, setKnowledgeMessage] = useState("");
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const aiRequestControllerRef = useRef<AbortController | null>(null);
  const aiRequestSequenceRef = useRef(0);
  const aiRetryAvailableAtRef = useRef(0);
  const aiRetryCooldownTimerRef = useRef<number | null>(null);
  const prefersReducedMotionRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      prefersReducedMotionRef.current = mediaQuery.matches;
      setPrefersReducedMotion(mediaQuery.matches);
    };
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { documents?: KnowledgeDocument[] };
        if (active && response.ok) {
          const documents = payload.documents ?? [];
          setKnowledgeDocuments(documents);
          setSelectedKnowledgeDocumentId(documents[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (active) setKnowledgeMessage("The local document library could not be read.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    aiRequestSequenceRef.current += 1;
    aiRequestControllerRef.current?.abort();
    if (aiRetryCooldownTimerRef.current != null) {
      window.clearTimeout(aiRetryCooldownTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const input = questionInputRef.current;
    if (!input) return;

    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  }, [question]);

  useEffect(() => {
    if (!mobileMenu) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenu(false);
        window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenu]);

  const clearAiRetryCooldown = useCallback(() => {
    aiRetryAvailableAtRef.current = 0;
    setAiRetryCoolingDown(false);
    if (aiRetryCooldownTimerRef.current != null) {
      window.clearTimeout(aiRetryCooldownTimerRef.current);
      aiRetryCooldownTimerRef.current = null;
    }
  }, []);

  const startAiRetryCooldown = useCallback((seconds: number) => {
    const durationSeconds = Math.min(300, Math.max(5, Math.ceil(seconds)));
    aiRetryAvailableAtRef.current = Date.now() + durationSeconds * 1_000;
    setAiRetryCoolingDown(true);
    if (aiRetryCooldownTimerRef.current != null) {
      window.clearTimeout(aiRetryCooldownTimerRef.current);
    }
    aiRetryCooldownTimerRef.current = window.setTimeout(() => {
      aiRetryAvailableAtRef.current = 0;
      aiRetryCooldownTimerRef.current = null;
      setAiRetryCoolingDown(false);
    }, durationSeconds * 1_000);
  }, []);

  const requestAiPhase = useCallback(async (
    body: FinkeyAiRequest,
    sequence: number,
    timeoutMs: number,
  ): Promise<FinkeyAiResponse> => {
    if (sequence !== aiRequestSequenceRef.current) {
      const canceled = new Error("AI request canceled.");
      canceled.name = "AbortError";
      throw canceled;
    }

    aiRequestControllerRef.current?.abort();
    const controller = new AbortController();
    aiRequestControllerRef.current = controller;
    let didTimeout = false;
    const timeout = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch("/api/finkey-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as FinkeyAiResponse | null;
      if (!payload || !response.ok || !payload.ok) {
        const message = payload && !payload.ok
          ? payload.error.message
          : `Foundry Local request failed (${response.status}).`;
        const retryable = payload && !payload.ok
          ? payload.error.retryable
          : response.status === 429 || response.status >= 500;
        throw new AiPhaseError(
          message,
          response.status,
          retryable,
          parseRetryAfterSeconds(response.headers.get("retry-after"), response.status === 429 ? 30 : 15),
        );
      }
      return payload;
    } catch (error) {
      if (isAbortError(error) && didTimeout) {
        throw new AiPhaseError("Optional Foundry Local context timed out.", 408, true, 0);
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      if (aiRequestControllerRef.current === controller) {
        aiRequestControllerRef.current = null;
      }
    }
  }, []);

  const requestExplanation = useCallback(async (
    cleanQuestion: string,
    nextAnalysis: AnalysisResult,
    sequence: number,
  ) => {
    if (sequence !== aiRequestSequenceRef.current || nextAnalysis.plan.unsupportedMetric) return;
    setAiState({ status: "explaining" });

    try {
      let response: FinkeyAiResponse | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await requestAiPhase({
            mode: "explain",
            question: cleanQuestion,
            evidence: buildCompactAiEvidence(nextAnalysis),
          }, sequence, AI_EXPLAIN_TIMEOUT_MS);
          break;
        } catch (error) {
          const shouldRetryInvalidOutput = attempt === 0
            && error instanceof AiPhaseError
            && error.status === 502;
          if (!shouldRetryInvalidOutput) throw error;
        }
      }
      if (sequence !== aiRequestSequenceRef.current) return;
      if (!response || !response.ok || response.mode !== "explain") {
        throw new Error("Foundry Local returned an unexpected explanation response.");
      }
      setAiState({
        status: "ready",
        enhancement: response.enhancement,
        model: response.model,
      });
      clearAiRetryCooldown();
      setStatusMessage("Foundry Local context was added to the calculated financial answer.");
    } catch (error) {
      if (sequence !== aiRequestSequenceRef.current || isAbortError(error)) return;
      const failure = describeAiFailure(error);
      if (failure.cooldownSeconds > 0) startAiRetryCooldown(failure.cooldownSeconds);
      // Foundry Local context is progressive enhancement. An inference failure
      // must never make a complete calculated answer look broken.
      setAiState({
        status: "fallback",
        message: failure.message,
        retryable: failure.retryable,
      });
      setStatusMessage(`${nextAnalysis.headline}. ${nextAnalysis.summary}`);
    }
  }, [clearAiRetryCooldown, requestAiPhase, startAiRetryCooldown]);

  const resolveQuestion = useCallback(async (
    nextQuestion: string,
    sourceDataset: FinanceDataset,
    sourceFacts: ReturnType<typeof buildFactStore>,
    options: { scroll: boolean; preserveAnswer: boolean; useAi?: boolean },
  ) => {
    const clean = nextQuestion.trim();
    if (!clean) return;

    const sequence = aiRequestSequenceRef.current + 1;
    aiRequestSequenceRef.current = sequence;
    aiRequestControllerRef.current?.abort();
    setQuestion(clean);
    setCopied(false);
    setStatusMessage("Running the Finkey calculation for your question.");
    if (!options.preserveAnswer) {
      setIsAnalyzing(true);
      setShowMethod(false);
      setShowDetails(false);
    }

    if (options.scroll) {
      window.requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: prefersReducedMotionRef.current ? "auto" : "smooth",
          block: "start",
        });
      });
    }

    const rulesPlan = interpretQuestionRules(clean, sourceDataset);
    const hardUnsupported = Boolean(
      rulesPlan.unsupportedMetric && rulesPlan.unsupportedMetric !== "The requested question",
    );
    const rulesCanAnswer = !rulesPlan.unsupportedMetric;
    let selectedPlan = rulesPlan;
    let aiInterpretationFailed = false;
    let aiInterpreted = false;
    let aiInterpretationFailure: ReturnType<typeof describeAiFailure> | null = null;

    // Questions covered by the deterministic grammar calculate immediately.
    // Foundry Local interpretation is reserved for questions the local grammar cannot
    // classify; a successful local calculation can then receive an explanation.
    if (hardUnsupported || options.useAi === false || rulesCanAnswer) {
      setAiState({ status: "idle" });
    } else if (Date.now() < aiRetryAvailableAtRef.current) {
      aiInterpretationFailed = true;
      aiInterpretationFailure = {
        message: "The local model is busy. The calculated answer remains unchanged.",
        retryable: true,
        cooldownSeconds: Math.max(1, Math.ceil((aiRetryAvailableAtRef.current - Date.now()) / 1_000)),
      };
    } else {
      setAiState({ status: "interpreting" });
      try {
        const response = await requestAiPhase({
          mode: "interpret",
          question: clean,
          catalog: {
            dateStart: sourceDataset.meta.dateStart,
            dateEnd: sourceDataset.meta.dateEnd,
            currency: sourceDataset.meta.currency,
            simulated: sourceDataset.meta.simulated,
          },
        }, sequence, AI_INTERPRET_TIMEOUT_MS);
        if (sequence !== aiRequestSequenceRef.current) return;
        if (!response.ok || response.mode !== "interpret") {
          throw new Error("Foundry Local returned an unexpected interpretation response.");
        }
        selectedPlan = materializeAiPlan(response.plan, clean, sourceDataset);
        aiInterpreted = true;
      } catch (error) {
        if (sequence !== aiRequestSequenceRef.current || isAbortError(error)) return;
        const failure = describeAiFailure(error);
        if (failure.cooldownSeconds > 0) startAiRetryCooldown(failure.cooldownSeconds);
        selectedPlan = rulesPlan;
        aiInterpretationFailed = true;
        aiInterpretationFailure = failure;
      }
    }

    let nextAnalysis: AnalysisResult;
    try {
      nextAnalysis = analyzePlan(clean, selectedPlan, sourceDataset, sourceFacts);
    } catch {
      if (!aiInterpreted) {
        if (sequence === aiRequestSequenceRef.current) {
          setAiState({ status: "idle" });
          setStatusMessage("Finkey could not calculate this answer. Please try a more specific question.");
          if (!options.preserveAnswer) setIsAnalyzing(false);
        }
        return;
      }
      aiInterpretationFailed = true;
      aiInterpretationFailure = {
        message: "Foundry Local interpretation could not be applied safely. The existing calculated answer remains unchanged.",
        retryable: true,
        cooldownSeconds: 0,
      };
      nextAnalysis = analyzePlan(clean, rulesPlan, sourceDataset, sourceFacts);
    }

    if (sequence !== aiRequestSequenceRef.current) return;
    setAnalysis(nextAnalysis);
    if (!options.preserveAnswer) setIsAnalyzing(false);
    setStatusMessage(`${nextAnalysis.headline}. ${nextAnalysis.summary}`);

    if (options.scroll) {
      window.setTimeout(() => {
        resultHeadingRef.current?.focus({ preventScroll: true });
      }, 90);
    }

    if (options.useAi === false || hardUnsupported) {
      setAiState({ status: "idle" });
      return;
    }

    if (aiInterpretationFailed || nextAnalysis.plan.unsupportedMetric) {
      if (aiInterpretationFailure) {
        setAiState({
          status: "fallback",
          message: aiInterpretationFailure.message,
          retryable: aiInterpretationFailure.retryable,
        });
      } else {
        setAiState({ status: "idle" });
      }
      return;
    }

    void requestExplanation(clean, nextAnalysis, sequence);
  }, [requestAiPhase, requestExplanation, startAiRetryCooldown]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      try {
        const response = await fetch("/data/keeya-finance.json", {
          signal: controller.signal,
          cache: "force-cache",
        });
        if (!response.ok) throw new Error(`Data request failed (${response.status})`);
        const payload = (await response.json()) as FinanceDataset;
        const preparedStore = buildFactStore(payload);
        setDataset(payload);
        setFactStore(preparedStore);
        await resolveQuestion(INITIAL_QUESTION, payload, preparedStore, {
          scroll: false,
          preserveAnswer: false,
          useAi: true,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setLoadError("The financial dataset could not be loaded. Please refresh and try again.");
        }
      }
    }
    loadData();
    return () => controller.abort();
  }, [resolveQuestion]);

  async function runQuestion(nextQuestion: string, scroll = true, preserveAnswer = false) {
    const clean = nextQuestion.trim();
    if (!clean || !dataset || !factStore) return;
    await resolveQuestion(clean, dataset, factStore, { scroll, preserveAnswer });
  }

  function retryLocalAi() {
    if (!analysis || aiRetryCoolingDown || Date.now() < aiRetryAvailableAtRef.current) return;
    if (analysis.plan.unsupportedMetric) {
      if (!dataset || !factStore) return;
      void resolveQuestion(analysis.question, dataset, factStore, {
        scroll: false,
        preserveAnswer: true,
        useAi: true,
      });
      return;
    }
    const sequence = aiRequestSequenceRef.current + 1;
    aiRequestSequenceRef.current = sequence;
    aiRequestControllerRef.current?.abort();
    void requestExplanation(analysis.question, analysis, sequence);
  }

  async function uploadKnowledgeDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = documentInputRef.current?.files?.[0];
    if (!file || knowledgeBusy) return;
    setKnowledgeBusy("upload");
    setKnowledgeMessage("Parsing, semantically chunking and embedding the document locally…");
    setKnowledgeAnswer(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const payload = await response.json() as {
        ok?: boolean;
        document?: KnowledgeDocument;
        duplicate?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.document) {
        throw new Error(payload.error || "The document could not be indexed.");
      }
      setKnowledgeDocuments((current) => [
        payload.document!,
        ...current.filter((item) => item.id !== payload.document!.id),
      ]);
      setSelectedKnowledgeDocumentId(payload.document.id);
      setKnowledgeMessage(payload.duplicate
        ? `${payload.document.name} was already indexed.`
        : `${payload.document.name} was indexed into ${payload.document.chunkCount} semantic chunks.`);
      if (documentInputRef.current) documentInputRef.current.value = "";
    } catch (error) {
      setKnowledgeMessage(error instanceof Error ? error.message : "The document could not be indexed.");
    } finally {
      setKnowledgeBusy(null);
    }
  }

  async function askKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = knowledgeQuestion.trim();
    const selectedDocument = knowledgeDocuments.find((document) => document.id === selectedKnowledgeDocumentId);
    if (!clean || !selectedDocument || knowledgeBusy) return;
    setKnowledgeBusy("ask");
    setKnowledgeMessage("Finding the closest chunks and asking the local model…");
    setKnowledgeAnswer(null);
    try {
      const response = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, documentId: selectedDocument.id }),
      });
      const payload = await response.json() as {
        ok?: boolean;
        answer?: string;
        model?: string;
        sources?: KnowledgeAnswer["sources"];
        error?: string;
      };
      if (!response.ok || !payload.answer || !payload.model || !payload.sources) {
        throw new Error(payload.error || "The local document answer could not be generated.");
      }
      setKnowledgeAnswer({ answer: payload.answer, model: payload.model, sources: payload.sources });
      setKnowledgeMessage(`Answered locally from ${payload.sources.length} retrieved source chunks.`);
    } catch (error) {
      setKnowledgeMessage(error instanceof Error ? error.message : "The question could not be answered.");
    } finally {
      setKnowledgeBusy(null);
    }
  }

  async function deleteKnowledgeDocument(document: KnowledgeDocument) {
    if (knowledgeBusy) return;
    setKnowledgeBusy("delete");
    setKnowledgeMessage(`Removing ${document.name} from the local index…`);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("The document could not be removed.");
      setKnowledgeDocuments((current) => {
        const remaining = current.filter((item) => item.id !== document.id);
        setSelectedKnowledgeDocumentId((selected) =>
          selected === document.id ? remaining[0]?.id ?? "" : selected);
        return remaining;
      });
      setKnowledgeAnswer(null);
      setKnowledgeMessage(`${document.name} was removed from the local index.`);
    } catch (error) {
      setKnowledgeMessage(error instanceof Error ? error.message : "The document could not be removed.");
    } finally {
      setKnowledgeBusy(null);
    }
  }

  function openAiEvidence(reference: AiEvidenceRef) {
    const targetId = reference === "chart"
      ? "chart-data"
      : reference === "method"
        ? "method"
        : "evidence-rows";
    if (reference === "method") setShowMethod(true);
    if (reference === "evidence") setShowDetails(true);

    window.setTimeout(() => {
      const target = document.getElementById(targetId);
      if (reference === "chart" && target instanceof HTMLDetailsElement) {
        target.open = true;
      }
      target?.scrollIntoView({
        behavior: prefersReducedMotionRef.current ? "auto" : "smooth",
        block: "center",
      });
    }, 20);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runQuestion(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runQuestion(question);
    }
  }

  async function copyAnswer() {
    if (!analysis) return;
    const aiContext = aiState.status === "ready"
      ? `\n\nFoundry Local summary: ${aiState.enhancement.executiveSummary}\nKey points:\n${aiState.enhancement.drivers.map((driver) => `- ${driver}`).join("\n")}\nKeep in mind:\n${aiState.enhancement.caveats.map((caveat) => `- ${caveat}`).join("\n")}`
      : "";
    const text = `${analysis.headline}\n${analysis.summary}${aiContext}\n\nHow calculated: ${analysis.method}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatusMessage("Answer copied to the clipboard.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setStatusMessage("Copy is unavailable in this browser. You can still select the answer text manually.");
    }
  }

  function downloadEvidence() {
    if (!analysis) return;
    const headers = [
      "Display label",
      "Raw label",
      ...analysis.chartSeries.map(csvSeriesHeader),
    ];
    const rows = analysis.chartData.map((item) =>
      [
        item.label,
        item.rawLabel ?? item.label,
        ...analysis.chartSeries.map((series) => normalizeCsvValue(item[series.key], series)),
      ].map(escapeCsvCell).join(","),
    );
    const blob = new Blob(
      [`\uFEFF${[headers.map(escapeCsvCell).join(","), ...rows].join("\r\n")}`],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "finkey-answer-evidence.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const displayChartSubtitle = analysis
    ? analysis.chartSubtitle.replace(/\s*·\s*[\d,.]+\s+source rows/i, "")
    : "";
  const visibleFollowUps = analysis
    ? aiState.status === "ready"
      ? aiState.enhancement.followUps.length > 0
        ? aiState.enhancement.followUps
        : analysis.followUps
      : analysis.followUps
    : [];

  return (
    <div className="keeya-app ui-v2">
      <a className="skip-link" href="#answer">Skip to financial answer</a>

      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#ask" aria-label="Finkey home">
            <span className="brand-mark" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo" src="/finkey-logo-transparent-96.png" alt="" width="81" height="96" />
            </span>
            <span className="brand-name">Finkey</span>
            <span className="brand-sub">
              <span>financial</span>
              <span>intelligence</span>
            </span>
          </a>

          <nav id="primary-navigation" className={mobileMenu ? "nav-links is-open" : "nav-links"} aria-label="Primary navigation">
            <a href="#ask-panel" onClick={() => setMobileMenu(false)}>Ask Finkey</a>
            <a href="#knowledge" onClick={() => setMobileMenu(false)}>Documents</a>
            <a href="#answer" onClick={() => setMobileMenu(false)}>Answer</a>
            <a href="#method" onClick={() => { setMobileMenu(false); setShowMethod(true); }}>Method</a>
          </nav>

          <div className="topbar-actions">
            <button
              ref={mobileMenuButtonRef}
              className="icon-button mobile-menu-button"
              type="button"
              aria-label={mobileMenu ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenu}
              aria-controls="primary-navigation"
              onClick={() => setMobileMenu((value) => !value)}
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="ask" aria-labelledby="hero-title">
          <div className="hero-stage">
            <WatercolorHero className="hero-watercolor" />
            <div className="hero-scrim" aria-hidden="true" />

            <div className="hero-editorial">
              <div className="hero-copy reveal-up">
                <h1 id="hero-title">
                  Financial clarity,
                  <span>at the speed of</span>
                  <span>a question.</span>
                </h1>
                <p>
                  Ask in plain language. Finkey calculates the answer from your source data,
                  shows the drivers and leaves every number open to inspection.
                </p>
                <div className="hero-actions">
                  <a className="hero-primary" href="#ask-panel">
                    Ask Finkey <ArrowRight size={18} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ask-section" id="ask-panel" aria-labelledby="ask-title">
          <div className="ask-layout">
            <div className="ask-intro">
              <span className="section-kicker">ASK FINKEY</span>
              <h2 id="ask-title">Start with a business question.</h2>
              <p>Revenue, profitability, cash flow, customers and geographies—calculated first, then explained.</p>
            </div>

            <div className="composer-wrap reveal-up delay-two">
              <form className="question-composer" onSubmit={handleSubmit}>
                <div className="composer-heading">
                  <label htmlFor="business-question">
                    <Sparkles size={17} /> Ask Finkey
                  </label>
                  <span>Keeya Europe · 2021–2024</span>
                </div>
                <div className="composer-row">
                  <span className="composer-search" aria-hidden="true"><Search size={19} /></span>
                  <textarea
                    ref={questionInputRef}
                    id="business-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="e.g. Which countries generated the most revenue in 2024?"
                    aria-describedby="composer-help"
                    disabled={!dataset || isAnalyzing}
                  />
                  <button
                    className="ask-button"
                    type="submit"
                    aria-label={isAnalyzing ? "Analyzing question" : "Ask"}
                    disabled={!dataset || isAnalyzing || !question.trim()}
                  >
                    {isAnalyzing ? <span className="button-spinner" aria-hidden="true" /> : <Send size={18} />}
                    <span>{isAnalyzing ? "Working" : "Ask"}</span>
                  </button>
                </div>
                <div className="composer-foot" id="composer-help">
                  <span>Press Enter to ask · Shift + Enter for a new line</span>
                  <span>AI never changes calculated values</span>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="knowledge-section" id="knowledge" aria-labelledby="knowledge-title">
          <div className="knowledge-shell">
            <div className="knowledge-intro">
              <span className="section-kicker">LOCAL DOCUMENT INTELLIGENCE</span>
              <h2 id="knowledge-title">Ask your files. Keep them on this device.</h2>
              <p>
                PDF, PowerPoint and Word files are parsed locally, split with semantic embeddings
                and stored in SQLite. Foundry Local answers from the closest source chunks.
              </p>
              <div className="knowledge-privacy"><ShieldCheck size={17} /> No cloud API or API key</div>
            </div>

            <div className="knowledge-workspace">
              <form className="document-upload" onSubmit={uploadKnowledgeDocument}>
                <div className="knowledge-card-heading">
                  <span><Upload size={17} /> Index a document</span>
                  <small>PDF · PPTX · DOCX · XLSX · MD · CSV</small>
                </div>
                <div className="document-upload-row">
                  <input
                    ref={documentInputRef}
                    type="file"
                    name="file"
                    accept=".pdf,.pptx,.docx,.xlsx,.md,.csv,.html,.rtf,.epub"
                    disabled={knowledgeBusy !== null}
                    aria-label="Choose a document to index"
                  />
                  <button type="submit" disabled={knowledgeBusy !== null}>
                    {knowledgeBusy === "upload" ? <span className="button-spinner" aria-hidden="true" /> : <Upload size={16} />}
                    {knowledgeBusy === "upload" ? "Indexing" : "Index locally"}
                  </button>
                </div>
                <p className="document-upload-note">
                  First use may download the configured Foundry chat and embedding models. Indexed files are limited to 20 MB.
                </p>
              </form>

              <div className="document-library" aria-label="Indexed documents">
                <div className="knowledge-card-heading">
                  <span><Database size={17} /> Select one document</span>
                  <small>{knowledgeDocuments.length} document{knowledgeDocuments.length === 1 ? "" : "s"}</small>
                </div>
                {knowledgeDocuments.length === 0 ? (
                  <div className="document-empty"><FileText size={20} /><span>Upload a document to create the local knowledge index.</span></div>
                ) : (
                  <ul>
                    {knowledgeDocuments.map((document) => (
                      <li key={document.id} className={document.id === selectedKnowledgeDocumentId ? "knowledge-document-selected" : undefined}>
                        <label className="knowledge-document-choice">
                          <input type="radio" name="knowledge-document" checked={document.id === selectedKnowledgeDocumentId} onChange={() => { setSelectedKnowledgeDocumentId(document.id); setKnowledgeAnswer(null); }} disabled={knowledgeBusy !== null} />
                          <FileText size={18} aria-hidden="true" />
                          <div>
                            <strong>{document.name}</strong>
                            <span>{document.sourceType.toUpperCase()} · {document.chunkCount} semantic chunks · {formatFileSize(document.byteSize)}</span>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => void deleteKnowledgeDocument(document)}
                          disabled={knowledgeBusy !== null}
                          aria-label={`Remove ${document.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form className="knowledge-question" onSubmit={askKnowledge}>
                <label htmlFor="knowledge-question"><Sparkles size={17} /> Ask the selected document</label>
                <div>
                  <textarea
                    id="knowledge-question"
                    rows={2}
                    value={knowledgeQuestion}
                    onChange={(event) => setKnowledgeQuestion(event.target.value)}
                    placeholder="e.g. What does the report say about the main financial risk?"
                    disabled={!selectedKnowledgeDocumentId || knowledgeBusy !== null}
                  />
                  <button
                    type="submit"
                    disabled={!selectedKnowledgeDocumentId || !knowledgeQuestion.trim() || knowledgeBusy !== null}
                  >
                    {knowledgeBusy === "ask" ? <span className="button-spinner" aria-hidden="true" /> : <Send size={17} />}
                    {knowledgeBusy === "ask" ? "Searching" : "Ask documents"}
                  </button>
                </div>
              </form>

              {knowledgeMessage && <p className="knowledge-status" role="status">{knowledgeMessage}</p>}

              {knowledgeAnswer && (
                <article className="knowledge-answer" aria-label="Document answer">
                  <div className="knowledge-answer-heading">
                    <span><Sparkles size={17} /> Foundry Local answer</span>
                    <small>{knowledgeAnswer.model}</small>
                  </div>
                  <p className="knowledge-answer-copy">{knowledgeAnswer.answer}</p>
                  <div className="knowledge-sources">
                    <strong>Retrieved sources</strong>
                    <ol>
                      {knowledgeAnswer.sources.map((source, index) => (
                        <li key={`${source.documentId}-${index}`}>
                          <div>
                            <span>Source {index + 1}</span>
                            <strong>{source.documentName}{source.location ? ` · ${source.location}` : ""}</strong>
                            <small>{Math.round(source.score * 100)}% cosine similarity</small>
                          </div>
                          <p>{source.excerpt}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </article>
              )}
            </div>
          </div>
        </section>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
        <section className="answer-section" id="answer" ref={resultRef} aria-busy={isAnalyzing} tabIndex={-1}>
          <div className="section-heading">
            <div>
              <span className="section-kicker">FINANCIAL ANSWER</span>
              <h2>A precise answer, <span className="keep-together">ready to use.</span></h2>
            </div>
          </div>

          {loadError ? (
            <div className="error-state" role="alert">
              <CircleAlert size={24} />
              <div><strong>Data unavailable</strong><p>{loadError}</p></div>
            </div>
          ) : !analysis || isAnalyzing ? (
            <AnswerSkeleton aiStatus={aiState.status} />
          ) : (
            <div className="workspace-grid">
              <article className="answer-card" lang={analysis.plan.language === "tr" ? "tr" : "en"}>
                <div className="answer-topline">
                  <div className="answer-badges">
                    <span className="answer-badge"><Sparkles size={14} /> Answer</span>
                    <AiStateBadge state={aiState} />
                    <span className="basis-badge">{analysis.plan.basis} basis</span>
                    <span className="basis-badge">{analysis.plan.periodLabel}</span>
                  </div>
                  <div className="answer-actions">
                    <button type="button" onClick={copyAnswer} aria-label="Copy answer">
                      {copied ? <Check size={17} /> : <Clipboard size={17} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <button type="button" onClick={downloadEvidence} aria-label="Download chart data as CSV">
                      <ArrowDownToLine size={17} />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                <div className="answer-narrative">
                  <span className="interpreted-as">Interpreted as · {analysis.plan.interpretedAs}</span>
                  <h3 ref={resultHeadingRef} tabIndex={-1}>{analysis.headline}</h3>
                  <p>{analysis.summary}</p>
                  <AiContextStrip
                    state={aiState}
                    onRetry={retryLocalAi}
                    retryCoolingDown={aiRetryCoolingDown}
                    onOpenEvidence={openAiEvidence}
                  />
                </div>

                <div className="kpi-grid">
                  {analysis.kpis.map((item) => (
                    <div className={`kpi-card tone-${item.tone ?? "neutral"}`} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <small>{item.note}</small>
                    </div>
                  ))}
                </div>

                <div className="analysis-grid">
                  <div className="chart-card">
                    <div className="card-heading">
                      <div>
                        <span className="card-kicker"><LineChartIcon size={15} /> VISUAL ANSWER</span>
                        <h4>{analysis.chartTitle}</h4>
                        <p>{displayChartSubtitle}</p>
                      </div>
                      <span className="chart-type">{analysis.chartType}</span>
                    </div>
                    <ChartView
                      analysis={{ ...analysis, chartSubtitle: displayChartSubtitle }}
                      reducedMotion={prefersReducedMotion}
                    />
                    <AccessibleChartTable analysis={analysis} />
                  </div>
                </div>

                {analysis.warnings.length > 0 && (
                  <div className="warning-strip">
                    <CircleAlert size={18} />
                    <div>
                      <strong>Read this with context</strong>
                      {analysis.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="disclosure-row" id="method">
                  <button type="button" aria-expanded={showMethod} onClick={() => setShowMethod((value) => !value)}>
                    <span><ShieldCheck size={17} /> How this was calculated</span>
                    <ChevronDown className={showMethod ? "rotate" : ""} size={18} />
                  </button>
                  {showMethod && (
                    <div className="disclosure-panel">
                      <p>{analysis.method}</p>
                      {aiState.status !== "idle" && (
                        <div className="ai-method-note">
                          <Sparkles size={17} aria-hidden="true" />
                          <div>
                            <strong>AI role</strong>
                            <p>Foundry Local only interprets language and drafts grounded commentary. Every filter, aggregation, KPI and chart value stays deterministic.</p>
                          </div>
                        </div>
                      )}
                      <dl>
                        <div><dt>Fact view</dt><dd>{analysis.evidence.factView}</dd></div>
                        <div><dt>Rows considered</dt><dd>{analysis.evidence.sourceRows.toLocaleString("en-GB")}</dd></div>
                        <div><dt>Coverage</dt><dd>{analysis.evidence.dateRange}</dd></div>
                        <div><dt>Currency</dt><dd>{analysis.evidence.currency}</dd></div>
                      </dl>
                      {analysis.warnings.map((warning) => <p className="method-warning" key={warning}>{warning}</p>)}
                    </div>
                  )}
                </div>

                <div className="details-block" id="evidence-rows">
                  <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}>
                    <span><Database size={17} /> Evidence rows <em>{analysis.details.length}</em></span>
                    <ChevronDown className={showDetails ? "rotate" : ""} size={18} />
                  </button>
                  {showDetails && <EvidenceTable analysis={analysis} />}
                </div>

                <div className="follow-up-block">
                  <span>Keep exploring</span>
                  <div>
                    {visibleFollowUps.map((followUp) => (
                      <button type="button" key={followUp} onClick={() => void runQuestion(followUp)}>
                        {followUp}<ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          )}
        </section>

        <section className="principles-section" aria-labelledby="principles-title">
          <div className="principles-copy">
            <span className="section-kicker">BUILT FOR TRUST</span>
            <h2 id="principles-title">A strong answer is more than a number.</h2>
            <p>Finkey separates language understanding from financial calculation, so every response stays explainable and reproducible.</p>
          </div>
          <div className="principle-grid">
            <div><span>01</span><ShieldCheck size={21} /><strong>Safe aggregation</strong><p>Split bank transactions count once; business events are deduplicated by event ID.</p></div>
            <div><span>02</span><BarChart3 size={21} /><strong>Honest visuals</strong><p>The chart changes with the analytical relationship—not with a decorative template.</p></div>
            <div><span>03</span><Database size={21} /><strong>Traceable method</strong><p>Every answer exposes its filters, aggregation and supporting evidence on demand.</p></div>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#ask" aria-label="Finkey home">
          <span className="brand-mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/finkey-logo-transparent-96.png" alt="" width="81" height="96" />
          </span>
          <span className="brand-name">Finkey</span>
          <span className="brand-sub">
            <span>financial</span>
            <span>intelligence</span>
          </span>
        </a>
        <p>Evidence-first financial intelligence for business decisions.</p>
        <span>Demo dataset · Generated operating simulation</span>
      </footer>
    </div>
  );
}

class AiPhaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "AiPhaseError";
  }
}

function parseRetryAfterSeconds(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(300, Math.max(5, Math.ceil(seconds)));
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return fallback;
  return Math.min(300, Math.max(5, Math.ceil((timestamp - Date.now()) / 1_000)));
}

function describeAiFailure(error: unknown): {
  message: string;
  retryable: boolean;
  cooldownSeconds: number;
} {
  if (error instanceof AiPhaseError) {
    return {
      message: error.message,
      retryable: error.retryable,
      cooldownSeconds: error.status === 429 || error.status === 503
        ? error.retryAfterSeconds
        : 0,
    };
  }
  return {
    message: "Foundry Local context could not be added this time. Run npm run foundry:setup and retry; the calculated answer remains complete.",
    retryable: true,
    cooldownSeconds: 0,
  };
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "name" in error
    && (error as { name?: unknown }).name === "AbortError";
}

function AiStateBadge({ state }: { state: AiEnhancementState }) {
  if (state.status === "idle") return null;

  if (state.status === "interpreting" || state.status === "explaining") {
    return (
      <span
        className="ai-state-badge is-loading"
        title="Foundry Local is adding context; financial calculations remain deterministic"
      >
        <span className="ai-mini-spinner" aria-hidden="true" />
        Local AI grounding
      </span>
    );
  }

  if (state.status === "ready") {
    return (
      <span
        className="ai-state-badge is-ready"
        title="Foundry Local context grounded in the Finkey calculation"
      >
        <Sparkles size={13} aria-hidden="true" />
        Locally grounded
      </span>
    );
  }

  return null;
}

function AiContextStrip({
  state,
  onRetry,
  retryCoolingDown,
  onOpenEvidence,
}: {
  state: AiEnhancementState;
  onRetry: () => void;
  retryCoolingDown: boolean;
  onOpenEvidence: (reference: AiEvidenceRef) => void;
}) {
  if (state.status === "idle") return null;

  if (state.status === "interpreting") {
    return (
      <div className="ai-context-strip is-loading" role="status" aria-live="polite" aria-busy="true">
        <span className="ai-context-icon"><span className="ai-mini-spinner" aria-hidden="true" /></span>
        <div className="ai-context-content">
          <div className="ai-context-heading"><strong>Interpreting with Foundry Local</strong><span>Calculated values stay unchanged</span></div>
          <p className="ai-context-copy">Reading the intent of your question before adding grounded context.</p>
        </div>
      </div>
    );
  }

  if (state.status === "explaining") {
    return (
      <div className="ai-context-strip is-loading" role="status" aria-live="polite" aria-busy="true">
        <span className="ai-context-icon"><span className="ai-mini-spinner" aria-hidden="true" /></span>
        <div className="ai-context-content">
          <div className="ai-context-heading"><strong>Answer ready</strong><span>Adding grounded context</span></div>
          <p className="ai-context-copy">The on-device model is drafting context from the verified calculation below.</p>
        </div>
      </div>
    );
  }

  if (state.status === "fallback") {
    return (
      <div className="ai-context-strip is-fallback" role="status" aria-live="polite" aria-atomic="true">
        <span className="ai-context-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
        <div className="ai-context-content">
          <div className="ai-context-heading"><strong>Answer ready</strong><span>Optional AI context unavailable</span></div>
          <p className="ai-context-copy">{state.message}</p>
        </div>
        {state.retryable && (
          <button
            className="ai-retry-button"
            type="button"
            onClick={onRetry}
            disabled={retryCoolingDown}
            title={retryCoolingDown ? "The local model asked Finkey to wait briefly before retrying." : undefined}
            style={retryCoolingDown ? { cursor: "not-allowed", opacity: 0.55 } : undefined}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {retryCoolingDown ? "Retry available shortly" : "Retry optional context"}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="ai-context-strip is-ready" aria-labelledby="local-ai-summary-title">
      <span className="ai-context-icon"><Sparkles size={18} aria-hidden="true" /></span>
      <div className="ai-context-content">
        <div className="ai-context-heading">
          <strong id="local-ai-summary-title">Foundry Local summary</strong>
          <span>What the answer means, grounded in the calculation</span>
        </div>
        <div className="ai-summary-grid">
          <div className="ai-summary-main">
            <span className="ai-summary-label">In brief</span>
            <p className="ai-context-copy">{state.enhancement.executiveSummary}</p>
          </div>
          <div className="ai-summary-points">
            <span className="ai-summary-label">Key points</span>
            <ul>
              {state.enhancement.drivers.map((driver, index) => (
                <li key={driver}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <p>{driver}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {state.enhancement.caveats.length > 0 && (
          <div className="ai-context-caveat">
            <CircleAlert size={14} aria-hidden="true" />
            <div>
              <strong>Keep in mind</strong>
              <ul>
                {state.enhancement.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
              </ul>
            </div>
          </div>
        )}
        {state.enhancement.evidenceRefs.length > 0 && (
          <div className="ai-evidence-row" aria-label="Evidence used for Foundry Local context">
            <span className="ai-evidence-label">Trace context</span>
            {state.enhancement.evidenceRefs.map((reference) => (
              <button
                className="ai-evidence-chip"
                type="button"
                key={reference}
                onClick={() => onOpenEvidence(reference)}
              >
                {AI_EVIDENCE_LABELS[reference]} <ArrowRight size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AnswerSkeleton({ aiStatus }: { aiStatus: AiEnhancementState["status"] }) {
  const status = aiStatus === "interpreting"
    ? "Preparing the Finkey answer…"
    : "Calculating the answer…";

  return (
    <div className="workspace-grid skeleton-workspace" role="status" aria-label="Preparing the financial answer">
      <div className="answer-card">
        <div className="skeleton-status"><span className="ai-mini-spinner" aria-hidden="true" />{status}</div>
        <div className="skeleton-line short shimmer" />
        <div className="skeleton-line title shimmer" />
        <div className="skeleton-line shimmer" />
        <div className="skeleton-kpis">
          {[0, 1, 2, 3].map((item) => <div className="shimmer" key={item} />)}
        </div>
        <div className="skeleton-chart shimmer" />
        <span className="sr-only">{status}</span>
      </div>
    </div>
  );
}

type NumericDomain = [number, number];

function finiteSeriesValues(
  data: AnalysisResult["chartData"],
  series: ChartSeries[],
): number[] {
  return data.flatMap((row) =>
    series.flatMap((item) => {
      const value = Number(row[item.key]);
      if (!Number.isFinite(value)) return [];
      if (item.format === "currency") return [Math.round(value * 100) / 100];
      if (item.format === "percent") return [Math.round(value * 10_000) / 10_000];
      return [Math.round(value * 1_000_000) / 1_000_000];
    }),
  );
}

function zeroBasedDomain(
  data: AnalysisResult["chartData"],
  series: ChartSeries[],
): NumericDomain {
  const values = finiteSeriesValues(data, series);
  if (values.length === 0) return [0, 1];

  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  if (minimum === 0 && maximum === 0) return [0, 1];
  if (minimum === 0) return [0, maximum * 1.08];
  if (maximum === 0) return [minimum * 1.08, 0];

  const padding = (maximum - minimum) * 0.06;
  return [minimum - padding, maximum + padding];
}

function containsNegativeValue(
  data: AnalysisResult["chartData"],
  series: ChartSeries[],
): boolean {
  return finiteSeriesValues(data, series).some((value) => value < 0);
}

const ZERO_REFERENCE_PROPS = {
  ifOverflow: "visible",
  stroke: "#747d8c",
  strokeDasharray: "4 4",
  strokeWidth: 1.25,
} as const;

function ChartView({
  analysis,
  reducedMotion,
}: {
  analysis: AnalysisResult;
  reducedMotion: boolean;
}) {
  const isTemporal = ["month", "quarter", "year"].includes(analysis.plan.dimension);
  const categoryHeight = Math.max(330, Math.min(analysis.chartData.length * 50 + 100, 520));
  const height = isTemporal ? 360 : categoryHeight;
  const formatCategoryTick = (value: string | number) => {
    const text = String(value);
    return text.length > 22 ? `${text.slice(0, 21).trimEnd()}…` : text;
  };
  const formatter = (value: number, key: string) => {
    const series = analysis.chartSeries.find((item) => item.key === key);
    return formatChartValue(value, series);
  };
  const hasNegativeValue = containsNegativeValue(analysis.chartData, analysis.chartSeries);

  const commonTooltip = <FinanceTooltip series={analysis.chartSeries} />;

  if (analysis.chartData.length === 0 || analysis.chartSeries.length === 0) {
    return (
      <div className="chart-empty" role="status">
        <CircleAlert size={22} />
        <div>
          <strong>No chart was generated</strong>
          <p>Refine the measure or period and Finkey will build a source-backed visual.</p>
        </div>
      </div>
    );
  }

  if (analysis.chartType === "donut") {
    return (
      <div className="chart-canvas" style={{ height }} role="img" aria-label={`${analysis.chartTitle}. ${analysis.chartSubtitle}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={analysis.chartData}
              dataKey={analysis.chartSeries[0]?.key ?? "value"}
              nameKey="label"
              cx="50%"
              cy="46%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={3}
              isAnimationActive={!reducedMotion}
              animationDuration={650}
            >
              {analysis.chartData.map((item, index) => <Cell key={item.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip content={commonTooltip} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (analysis.chartType === "composed") {
    const isReconciliation = analysis.plan.metric === "reconciliation_gap";
    const differenceSeries = isReconciliation
      ? analysis.chartSeries.filter((series) => series.key === "gap")
      : [];
    const primarySeries = isReconciliation
      ? analysis.chartSeries.filter((series) => series.key !== "gap")
      : analysis.chartSeries;
    const primaryDomain = zeroBasedDomain(analysis.chartData, primarySeries);
    const differenceDomain = zeroBasedDomain(analysis.chartData, differenceSeries);
    const primaryHasNegative = containsNegativeValue(analysis.chartData, primarySeries);
    const differenceHasNegative = containsNegativeValue(analysis.chartData, differenceSeries);
    const chartAriaLabel = isReconciliation
      ? `${analysis.chartTitle}. ${analysis.chartSubtitle}. Bank and business values use the left axis; net difference uses a separate right axis.`
      : `${analysis.chartTitle}. ${analysis.chartSubtitle}`;

    return (
      <div className="chart-canvas" style={{ height }}>
        {isReconciliation && (
          <div
            role="note"
            style={{
              minHeight: 22,
              padding: "2px 8px 0",
              color: "#6b7280",
              fontSize: 11,
              lineHeight: 1.4,
              textAlign: "right",
            }}
          >
            Net difference uses the labelled right-hand scale.
          </div>
        )}
        <div
          role="img"
          aria-label={chartAriaLabel}
          style={{ height: isReconciliation ? "calc(100% - 22px)" : "100%" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={analysis.chartData}
              margin={{ top: 20, right: isReconciliation ? 2 : 18, bottom: 8, left: 0 }}
            >
            <CartesianGrid stroke="#e7e9ef" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
            <YAxis
              yAxisId="primary"
              axisLine={false}
              tickLine={false}
              width={66}
              domain={primaryDomain}
              tickFormatter={(value) => formatCurrency(Number(value))}
              tick={{ fill: "#6b7280", fontSize: 11 }}
            />
            {isReconciliation && (
              <YAxis
                yAxisId="difference"
                orientation="right"
                axisLine={{ stroke: "#ef5b78", strokeOpacity: 0.45 }}
                tickLine={false}
                width={76}
                domain={differenceDomain}
                tickFormatter={(value) => formatCurrency(Number(value))}
                tick={{ fill: "#bd405b", fontSize: 10 }}
                label={{
                  value: "Difference",
                  angle: -90,
                  position: "insideRight",
                  fill: "#9f3650",
                  fontSize: 10,
                }}
              />
            )}
            <Tooltip content={commonTooltip} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            {primaryHasNegative && (
              <ReferenceLine yAxisId="primary" y={0} {...ZERO_REFERENCE_PROPS} />
            )}
            {isReconciliation && differenceHasNegative && (
              <ReferenceLine
                yAxisId="difference"
                y={0}
                stroke="#bd405b"
                strokeDasharray="3 3"
                strokeWidth={1.25}
              />
            )}
            {analysis.chartSeries.map((series) =>
              series.kind === "line" ? (
                <Line
                  key={series.key}
                  yAxisId={isReconciliation && series.key === "gap" ? "difference" : "primary"}
                  dataKey={series.key}
                  name={isReconciliation && series.key === "gap" ? `${series.label} · right axis` : series.label}
                  stroke={series.color}
                  strokeWidth={isReconciliation && series.key === "gap" ? 3 : 2.5}
                  strokeDasharray={isReconciliation && series.key === "gap" ? "7 4" : undefined}
                  dot={{ r: 3, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 5 }}
                  animationDuration={650}
                  isAnimationActive={!reducedMotion}
                />
              ) : (
                <Bar
                  key={series.key}
                  yAxisId="primary"
                  dataKey={series.key}
                  name={series.label}
                  fill={series.color}
                  radius={6}
                  maxBarSize={38}
                  animationDuration={650}
                  isAnimationActive={!reducedMotion}
                />
              ),
            )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (analysis.chartType === "area") {
    const signedDomain = hasNegativeValue
      ? zeroBasedDomain(analysis.chartData, analysis.chartSeries)
      : undefined;
    return (
      <div className="chart-canvas" style={{ height }} role="img" aria-label={`${analysis.chartTitle}. ${analysis.chartSubtitle}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analysis.chartData} margin={{ top: 20, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#e7e9ef" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} width={66} domain={signedDomain} tickFormatter={(value) => formatter(Number(value), analysis.chartSeries[0]?.key ?? "value")} tick={{ fill: "#6b7280", fontSize: 11 }} />
            <Tooltip content={commonTooltip} />
            {hasNegativeValue && <ReferenceLine y={0} {...ZERO_REFERENCE_PROPS} />}
            <Area type="monotone" dataKey={analysis.chartSeries[0]?.key ?? "value"} name={analysis.chartSeries[0]?.label} stroke="#2f6bff" fill="#2f6bff" fillOpacity={0.12} strokeWidth={2.5} animationDuration={650} isAnimationActive={!reducedMotion} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (analysis.chartType === "line") {
    const signedDomain = hasNegativeValue
      ? zeroBasedDomain(analysis.chartData, analysis.chartSeries)
      : undefined;
    return (
      <div className="chart-canvas" style={{ height }} role="img" aria-label={`${analysis.chartTitle}. ${analysis.chartSubtitle}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={analysis.chartData} margin={{ top: 20, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#e7e9ef" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} width={66} domain={signedDomain} tickFormatter={(value) => formatter(Number(value), analysis.chartSeries[0]?.key ?? "value")} tick={{ fill: "#6b7280", fontSize: 11 }} />
            <Tooltip content={commonTooltip} />
            {hasNegativeValue && <ReferenceLine y={0} {...ZERO_REFERENCE_PROPS} />}
            <Line type="monotone" dataKey={analysis.chartSeries[0]?.key ?? "value"} name={analysis.chartSeries[0]?.label} stroke="#2f6bff" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} animationDuration={650} isAnimationActive={!reducedMotion} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const barMargin = isTemporal
    ? { top: 20, right: 18, bottom: 8, left: 0 }
    : { top: 8, right: 24, bottom: 8, left: 24 };
  const barDomain = zeroBasedDomain(analysis.chartData, analysis.chartSeries);

  return (
    <div className="chart-canvas" style={{ height }} role="img" aria-label={`${analysis.chartTitle}. ${analysis.chartSubtitle}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={analysis.chartData} layout={isTemporal ? "horizontal" : "vertical"} margin={barMargin}>
          <CartesianGrid stroke="#e7e9ef" vertical={isTemporal ? false : true} horizontal={isTemporal} />
          {isTemporal ? (
            <>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis domain={barDomain} axisLine={false} tickLine={false} width={66} tickFormatter={(value) => formatter(Number(value), analysis.chartSeries[0]?.key ?? "value")} tick={{ fill: "#6b7280", fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis type="number" domain={barDomain} axisLine={false} tickLine={false} tickFormatter={(value) => formatter(Number(value), analysis.chartSeries[0]?.key ?? "value")} tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={142} tickFormatter={formatCategoryTick} tick={{ fill: "#3f4653", fontSize: 11 }} />
            </>
          )}
          <Tooltip content={commonTooltip} />
          {analysis.chartSeries.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />}
          {hasNegativeValue && (
            isTemporal
              ? <ReferenceLine y={0} {...ZERO_REFERENCE_PROPS} />
              : <ReferenceLine x={0} {...ZERO_REFERENCE_PROPS} />
          )}
          {analysis.chartSeries.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={series.color}
              radius={6}
              maxBarSize={34}
              animationDuration={650}
              isAnimationActive={!reducedMotion}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AccessibleChartTable({ analysis }: { analysis: AnalysisResult }) {
  if (analysis.chartData.length === 0 || analysis.chartSeries.length === 0) return null;

  return (
    <details className="chart-data-details" id="chart-data">
      <summary>View exact chart data</summary>
      <div className="table-wrap chart-table-wrap" role="region" aria-label={`${analysis.chartTitle} exact data`} tabIndex={0}>
        <table>
          <caption>{analysis.chartTitle}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              {analysis.chartSeries.map((series) => (
                <th scope="col" className="amount-cell" key={series.key}>
                  {tableSeriesHeader(series)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.chartData.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {analysis.chartSeries.map((series) => (
                  <td className="amount-cell" key={series.key}>
                    {formatExactChartValue(Number(row[series.key] ?? 0), series)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function FinanceTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; dataKey?: string; name?: string; color?: string }>;
  label?: string;
  series: ChartSeries[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => {
        const definition = series.find((seriesItem) => seriesItem.key === item.dataKey);
        return (
          <div key={item.dataKey ?? item.name}>
            <span><i style={{ background: item.color }} />{definition?.label ?? item.name}</span>
            <b>{formatChartValue(Number(item.value ?? 0), definition)}</b>
          </div>
        );
      })}
    </div>
  );
}

function formatChartValue(value: number, series?: ChartSeries): string {
  if (series?.format === "percent") return formatPercent(value);
  if (series?.format === "number") return formatNumber(value);
  return formatCurrency(value);
}

function formatExactChartValue(value: number, series?: ChartSeries): string {
  if (!Number.isFinite(value)) return "—";
  if (series?.format === "currency") return formatCurrency(value, false);
  if (series?.format === "percent") {
    const percentage = value * 100;
    const isWholePercentage = Math.abs(percentage - Math.round(percentage)) < 1e-9;
    return new Intl.NumberFormat("en-GB", {
      style: "percent",
      minimumFractionDigits: isWholePercentage ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-GB", {
    notation: "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function tableSeriesHeader(series: ChartSeries): string {
  if (series.format === "currency") return `${series.label} (EUR)`;
  if (series.format === "percent") return `${series.label} (%)`;
  return series.label;
}

function csvSeriesHeader(series: ChartSeries): string {
  if (series.format === "currency") return `${series.label} [EUR]`;
  if (series.format === "percent") return `${series.label} [%]`;
  return `${series.label} [number]`;
}

function normalizeCsvValue(value: string | number | undefined, series: ChartSeries): string {
  if (value == null || value === "") return "";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  if (series.format === "currency") return normalizedFixed(numericValue, 2);
  if (series.format === "percent") return normalizedFixed(numericValue * 100, 2);

  const rounded = Math.round(numericValue * 1_000_000) / 1_000_000;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(6).replace(/\.?0+$/, "");
}

function normalizedFixed(value: number, fractionDigits: number): string {
  const factor = 10 ** fractionDigits;
  const rounded = Math.round(value * factor) / factor;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(fractionDigits);
}

function escapeCsvCell(value: string | number | undefined): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function EvidenceTable({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="table-wrap" role="region" aria-label="Evidence rows" tabIndex={0}>
      <table>
        <caption>Highest-magnitude source records for this answer</caption>
        <thead>
          <tr><th scope="col">Date</th><th scope="col">Counterparty</th><th scope="col">Context</th><th scope="col">Status</th><th scope="col" className="amount-cell">Amount</th></tr>
        </thead>
        <tbody>
          {analysis.details.map((row) => (
            <tr key={row.id}>
              <td>{row.date || "—"}</td>
              <td>{row.counterparty}</td>
              <td>{row.context}</td>
              <td><span className="table-status">{row.status}</span></td>
              <td className="amount-cell">{formatCurrency(row.amount, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
