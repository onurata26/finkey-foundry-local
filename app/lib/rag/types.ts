export type RagDocument = {
  id: string;
  name: string;
  sourceType: string;
  byteSize: number;
  chunkCount: number;
  embeddingModel: string;
  createdAt: string;
};

export type RagChunkInput = {
  text: string;
  embedding: number[];
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  heading?: string;
  startIndex?: number;
  endIndex?: number;
};

export type RagSearchResult = {
  chunkId: string;
  chunkIndex?: number;
  documentId: string;
  documentName: string;
  text: string;
  score: number;
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  heading?: string;
};

export type RagChartPoint = {
  label: string;
  value: number;
  displayValue: string;
  sourceNumber: number;
};

export type RagChart = {
  type: "bar" | "line";
  title: string;
  unit: string;
  points: RagChartPoint[];
};

export type RagAnswer = {
  answer: string;
  model: string;
  chart: RagChart | null;
  sources: Array<{
    sourceNumber: number;
    documentId: string;
    documentName: string;
    score: number;
    excerpt: string;
    location: string;
  }>;
};
