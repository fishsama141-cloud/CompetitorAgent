'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CloudUpload, FileText, MessageSquare, Search,
  SendHorizontal, Sparkles, Trash2, XCircle,
  ChevronRight, ArrowUpRight, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ChatMessage, Competitor } from '@/lib/types'
import { searchKnowledge, chat as chatApi, uploadDocument } from '@/lib/services/knowledge'
import { listCompetitors } from '@/lib/services/competitor'
import type { SearchResponse, ChatResponse, SearchResult } from '@/lib/types'
import { CitationTag } from '@/components/citation-tag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { useReveal } from '@/hooks/use-reveal'

/* ─────────────────────────────────────────────
   Main View
   ───────────────────────────────────────────── */
export function KnowledgeView() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)

  // Upload — starts empty (no fake default files)
  const [files, setFiles] = useState<{ name: string; size: string }[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Chat sheet — starts empty (no fake default messages)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)

  // Detail sheet
  const [selectedChunk, setSelectedChunk] = useState<SearchResult | null>(null)

  const [competitorId, setCompetitorId] = useState('')
  const heroRef = useReveal()

  // ── Load competitors from API ──────────────────────────────
  useEffect(() => {
    listCompetitors().then((data) => {
      setCompetitors(data)
      if (data.length > 0 && !competitorId) {
        setCompetitorId(data[0].competitor_id)
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCategory = useMemo(
    () => competitors.find((c) => c.competitor_id === competitorId)?.category ?? 'AI Assistant',
    [competitors, competitorId],
  )

  const avgScore = useMemo(
    () => results.length ? results.reduce((s, r) => s + r.similarity_score, 0) / results.length : 0,
    [results],
  )

  async function runSearch() {
    if (!query.trim() || !competitorId) return
    setSearching(true); setSearched(true)
    try {
      const res: SearchResponse = await searchKnowledge({ query, top_k: topK, competitor_id: competitorId, domain: selectedCategory })
      setResults(res.results)
    } catch (err: any) {
      toast.error('检索失败', { description: err?.message ?? '请确认后端服务已启动且知识库中有数据' })
      setResults([])
    }
    finally { setSearching(false) }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    const fileObjs = Array.from(list)
    const next = fileObjs.map((f) => ({ name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` }))
    setFiles((prev) => [...next, ...prev])

    fileObjs.forEach(async (file) => {
      try {
        const content = await file.text()
        await uploadDocument({
          competitor_id: competitorId,
          file_name: file.name,
          document_type: 'changelog',
          content,
        })
        toast.success(`已索引：${file.name}`, { description: '文档已切分并写入向量库' })
      } catch (err: any) {
        toast.error(`上传失败：${file.name}`, { description: err?.message ?? '未知错误' })
      }
    })
  }

  async function send() {
    const text = draft.trim(); if (!text || thinking) return
    setDraft(''); setMessages((prev) => [...prev, { id: `msg_${prev.length + 1}`, role: 'user', content: text }]); setThinking(true)
    try {
      const res: ChatResponse = await chatApi({ question: text, competitor_id: competitorId })
      setMessages((prev) => [...prev, { id: `msg_${prev.length + 1}`, role: 'assistant', content: res.answer, citations: res.citations }])
    } catch (err: any) {
      toast.error('对话请求失败', { description: err?.message ?? '请确认后端服务已启动且 LLM API Key 已配置' })
    } finally { setThinking(false) }
  }

  return (
    <div className="flex flex-col">
      {/* ================================================================
          HERO — Apple-style massive type + single CTA
          ================================================================ */}
      <motion.section
        ref={heroRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-start gap-8 py-16 lg:py-24"
      >
        <span className="font-mono text-[11px] font-medium tracking-[0.2em] text-primary/60 uppercase">
          Vector Store · RAG
        </span>
        <h1 className="max-w-2xl text-[40px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[56px]">
          知识库 &amp; RAG 检索，
          <br />
          <span className="text-primary">语义驱动竞品洞察。</span>
        </h1>
        <p className="max-w-lg text-[17px] leading-relaxed text-muted-foreground">
          上传文档构建向量索引，用自然语言检索竞品情报。每条结果自动附带引用来源。
        </p>

        {/* Search bar — integrated into hero */}
        <div className="flex w-full max-w-xl items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) runSearch() }}
              placeholder="输入检索查询语句…"
              className="h-12 w-full rounded-2xl border border-border/60 bg-muted/30 pl-11 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
            />
          </div>
          <Button
            size="lg"
            className="btn-press h-12 rounded-2xl px-6 text-[14px]"
            onClick={runSearch}
            disabled={searching || !query.trim()}
          >
            {searching ? <Spinner /> : <Search className="size-4" />}
            检索
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="btn-press h-12 rounded-2xl px-6 text-[14px]"
            onClick={() => setUploadOpen(true)}
          >
            <CloudUpload className="size-4" />
            上传
          </Button>
        </div>

        {/* Top-K slider — subtle, below the search bar */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">Top-K</span>
          <Slider value={[topK]} min={1} max={10} step={1} onValueChange={(v) => setTopK(Array.isArray(v) ? v[0] : (v as number))} className="w-28" />
          <span className="w-6 text-right font-mono text-[12px] tabular-nums text-muted-foreground">{topK}</span>
        </div>
      </motion.section>

      {/* ================================================================
          RESULTS GRID — card-based, like competitor cards
          ================================================================ */}
      {searched && (
        <section className="py-8 lg:py-12">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
                Search Results
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em]">检索结果</h2>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {results.length} 片段 · avg {avgScore.toFixed(2)}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/50 bg-muted/10 py-20 text-center">
              <Search className="size-10 text-muted-foreground/25" />
              <p className="text-[14px] text-muted-foreground">无匹配结果</p>
              <p className="text-[12px] text-muted-foreground/60">尝试更换查询词或降低 Top-K 阈值</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r, i) => (
                <ResultCard
                  key={r.chunk_id}
                  result={r}
                  index={i}
                  onClick={() => setSelectedChunk(r)}
                  onChat={() => { setChatOpen(true); setSelectedChunk(r) }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================================================================
          RAG CHAT — prominent AI agent on main page
          ================================================================ */}
      <section className="py-8 lg:py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
              RAG Agent
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em]">竞品情报智能问答</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-muted-foreground">知识库上下文</span>
            <Select value={competitorId} onValueChange={(v) => setCompetitorId(v ?? '')}>
              <SelectTrigger className="h-8 w-[150px] text-[12px]">
                <SelectValue placeholder="选择竞品" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {competitors.map((c) => (
                    <SelectItem key={c.competitor_id} value={c.competitor_id}>{c.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chat messages */}
        <div className="mb-4 max-h-[420px] overflow-y-auto rounded-3xl border border-border/50 bg-white p-6 ring-1 ring-black/5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Sparkles className="size-6 text-primary" />
              </div>
              <p className="text-[14px] font-medium text-foreground/70">向 AI 智能体提问</p>
              <p className="text-[12px] text-muted-foreground/60 max-w-sm">
                智能体将基于知识库中的竞品情报数据回答你的问题，回答附带原文引用来源。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {m.role === 'assistant' && (
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                      <Sparkles className="size-3.5 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-md bg-foreground text-white'
                      : 'rounded-bl-md border border-border/50 bg-muted/20',
                  )}>
                    {m.role === 'assistant' ? <ChatText message={m} /> : m.content}
                  </div>
                </motion.div>
              ))}
              {thinking && (
                <div className="flex items-center gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                    <Sparkles className="size-3.5 animate-pulse text-primary" />
                  </div>
                  <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Spinner className="size-3.5" />正在检索知识库…
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault(); send()
              }
            }}
            placeholder="向情报智能体提问，例如：DeepSeek 最近更新了哪些功能？与竞品相比有什么优势？"
            className="min-h-[60px] flex-1 resize-none rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
            rows={2}
          />
          <Button
            size="icon"
            className="btn-press size-12 shrink-0 rounded-2xl"
            onClick={send}
            disabled={thinking || !draft.trim() || !competitorId}
          >
            <SendHorizontal className="size-5" />
          </Button>
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">
          Enter 发送 · Shift + Enter 换行 · 基于向量检索的 RAG 智能问答（需要知识库中有数据）
        </p>
      </section>

      {/* ================================================================
          UPLOAD SHEET
          ================================================================ */}
      <AnimatePresence>
        {uploadOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setUploadOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                    <CloudUpload className="size-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold">文档上传</h2>
                    <p className="font-mono text-[11px] text-muted-foreground">.md · .pdf · .txt</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setUploadOpen(false)}>
                  <XCircle className="size-5" />
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                  className={cn(
                    'flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center transition-all duration-300',
                    dragging ? 'border-primary/50 bg-primary/[0.03] scale-[0.99]' : 'border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/[0.02]',
                  )}
                >
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                    <CloudUpload className="size-6 text-primary" />
                  </div>
                  <span className="text-[14px] font-medium">拖拽文件到此处，或点击选择</span>
                  <span className="font-mono text-[11px] text-muted-foreground">单文件最大 20 MB</span>
                  <input ref={inputRef} type="file" multiple accept=".md,.pdf,.txt" className="hidden" onChange={(e) => addFiles(e.target.files)} />
                </button>

                {files.length > 0 && (
                  <ul className="mt-6 flex flex-col gap-2">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border/50 bg-white px-4 py-3 transition-all hover:border-border hover:shadow-sm">
                        <FileText className="size-4 shrink-0 text-primary/70" />
                        <span className="truncate text-[13px]">{f.name}</span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{f.size}</span>
                        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================================================================
          CHAT SHEET
          ================================================================ */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setChatOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                    <MessageSquare className="size-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold">RAG 对话</h2>
                    <p className="font-mono text-[11px] text-muted-foreground">基于知识库智能问答</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setChatOpen(false)}>
                  <XCircle className="size-5" />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-4">
                  {messages.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      {m.role === 'assistant' && (
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                          <Sparkles className="size-3.5 text-primary" />
                        </div>
                      )}
                      <div className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
                        m.role === 'user'
                          ? 'rounded-br-md bg-foreground text-white'
                          : 'rounded-bl-md border border-border/50 bg-muted/20',
                      )}>
                        {m.role === 'assistant' ? <ChatText message={m} /> : m.content}
                      </div>
                    </motion.div>
                  ))}
                  {thinking && (
                    <div className="flex items-center gap-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20"><Sparkles className="size-3.5 animate-pulse text-primary" /></div>
                      <span className="flex items-center gap-2 text-[12px] text-muted-foreground"><Spinner className="size-3.5" />正在检索知识库…</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-border/50 p-4">
                <div className="flex items-end gap-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                    placeholder="向情报智能体提问…"
                    className="min-h-[60px] flex-1 resize-none rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
                    rows={2}
                  />
                  <Button
                    size="icon"
                    className="btn-press size-11 shrink-0 rounded-2xl"
                    onClick={send}
                    disabled={thinking || !draft.trim()}
                  >
                    <SendHorizontal className="size-4" />
                  </Button>
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">Enter 发送 · Shift + Enter 换行</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================================================================
          DETAIL SHEET — chunk detail
          ================================================================ */}
      <AnimatePresence>
        {selectedChunk && !uploadOpen && !chatOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedChunk(null)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
                <div>
                  <h2 className="text-[16px] font-semibold">片段详情</h2>
                  <p className="font-mono text-[11px] text-muted-foreground">{selectedChunk.chunk_id} · {selectedChunk.source}</p>
                </div>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setSelectedChunk(null)}>
                  <XCircle className="size-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-muted-foreground">相似度</span>
                    <Badge variant="secondary" className={cn('border-0 font-mono text-[11px]', selectedChunk.similarity_score >= 0.9 ? 'bg-emerald-50 text-emerald-700' : selectedChunk.similarity_score >= 0.82 ? 'bg-sky-50 text-sky-700' : 'bg-muted text-muted-foreground')}>
                      {selectedChunk.similarity_score.toFixed(4)}
                    </Badge>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-muted/20 p-5">
                    <p className="text-[14px] leading-relaxed">{selectedChunk.content}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    来源：{selectedChunk.source} · ID：{selectedChunk.chunk_id}
                  </div>
                  <Button
                    variant="outline"
                    className="btn-press mt-2 rounded-2xl"
                    onClick={() => { setChatOpen(true) }}
                  >
                    <MessageSquare className="size-4" />
                    对此片段提问
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Result Card — Apple-style, like competitor cards
   ───────────────────────────────────────────── */
function ResultCard({
  result,
  index,
  onClick,
  onChat,
}: {
  result: SearchResult
  index: number
  onClick: () => void
  onChat: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-3xl bg-white p-6 transition-shadow duration-500',
        'ring-1 ring-black/5 hover:ring-black/10',
      )}
    >
      <motion.div
        animate={{ y: hovered ? -4 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex flex-col gap-4"
      >
        {/* Top row: chunk_id + score */}
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {result.chunk_id}
          </span>
          <motion.div animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : 8 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="size-4 text-muted-foreground/40" />
          </motion.div>
        </div>

        {/* Content */}
        <p className="line-clamp-3 text-[13.5px] leading-relaxed text-foreground/80">
          {result.content}
        </p>

        {/* Source + score bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{result.source}</span>
            <Badge variant="secondary" className={cn(
              'ml-auto border-0 font-mono text-[10px]',
              result.similarity_score >= 0.9 ? 'bg-emerald-50 text-emerald-700' : result.similarity_score >= 0.82 ? 'bg-sky-50 text-sky-700' : 'bg-muted text-muted-foreground',
            )}>
              {result.similarity_score.toFixed(2)}
            </Badge>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${result.similarity_score * 100}%` }}
            />
          </div>
        </div>

        {/* Hover action */}
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
              <Button variant="secondary" size="sm" className="btn-press h-8 rounded-full text-[12px]" onClick={(e) => { e.stopPropagation(); onChat() }}>
                <MessageSquare className="size-3" />
                对话提问
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Chat text with inline citations
   ───────────────────────────────────────────── */
function ChatText({ message }: { message: ChatMessage }) {
  const parts = message.content.split(/(\[chunk_\d+\])/g)
  return (
    <div className="text-[13px] leading-relaxed whitespace-pre-line">
      {parts.map((part, i) => {
        const match = part.match(/^\[(chunk_\d+)\]$/)
        if (!match) return <span key={i}>{part}</span>
        const citation = message.citations?.find((c) => c.chunk_id === match[1])
        if (!citation) return <span key={i}>{part}</span>
        return <CitationTag key={i} citation={citation} superscript />
      })}
    </div>
  )
}
