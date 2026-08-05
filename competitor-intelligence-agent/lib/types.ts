// ============================================================
// API Contract Types — strictly aligned with api_contract.json
// ============================================================

// --- Competitor ---

export type Competitor = {
  competitor_id: string
  name: string
  category: string
  latest_update: string
  document_count: number
}

export type CreateCompetitorRequest = {
  name: string
  category: string
  official_url: string
  description: string
}

export type CreateCompetitorResponse = {
  competitor_id: string
  name: string
  created_time: string
}

// --- Data Ingestion ---

export type CrawlRequest = {
  competitor_id: string
  url: string
  source_type: 'changelog' | 'app_store' | 'custom_url'
}

export type CrawlResponse = {
  task_id: string
  crawl_status: 'processing' | 'completed' | 'failed'
  estimated_time: string
}

export type TaskStatus = {
  task_id: string
  status: 'processing' | 'completed' | 'failed'
  progress_percentage: number
  documents_created: number
  error_message: string | null
}

// Extended task for UI display (includes crawl request context)
export type TaskStatusWithMeta = TaskStatus & {
  competitor: string
  source_url: string
  source_type: CrawlRequest['source_type']
}

// --- Knowledge Base ---

export type UploadDocumentRequest = {
  competitor_id: string
  file_name: string
  document_type: 'changelog' | 'app_store' | 'custom_url'
  content: string
}

export type UploadDocumentResponse = {
  document_id: string
  status: 'indexed' | 'processing' | 'failed'
}

export type SearchRequest = {
  query: string
  top_k: number
  competitor_id: string
  domain: string
}

export type SearchResult = {
  chunk_id: string
  content: string
  source: string
  similarity_score: number
}

export type SearchResponse = {
  results: SearchResult[]
}

// --- Citation (unified across SWOT & Chat) ---

export type Citation = {
  chunk_id: string
  source_title: string
  raw_text_snippet: string
}

// --- RAG Chat ---

export type ChatRequest = {
  question: string
  competitor_id: string
}

export type ChatResponse = {
  answer: string
  citations: Citation[]
}

// --- SWOT Agent ---

export type SwotGenerateRequest = {
  competitors: string[] // competitor names
  domain: string
  time_range_days: number
}

export type SwotItem = {
  point: string
  citation: Citation
  confidence: number
}

export type SwotMatrix = {
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
}

export type SwotGenerateResponse = {
  report_id: string
  task_id: string
  swot_matrix: SwotMatrix
  recommendations: string[]
}

// --- Evaluation ---

export type EvaluationRequest = {
  report_id: string
}

export type Evaluations = {
  faithfulness: number
  citation_accuracy: number
  completeness: number
  hallucination_rate: number
}

// Extended for UI display (history table)
export type EvaluationRun = {
  report_id: string
  evaluated_at: string
  status: 'passed' | 'running' | 'failed'
  scores: Evaluations
}

// --- Chat UI types ---

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}
