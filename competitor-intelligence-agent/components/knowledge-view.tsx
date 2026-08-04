'use client'

import { useMemo, useRef, useState } from 'react'
import { Boxes, CloudUpload, Cpu, FileText, Gauge, MessageSquare, Search, SendHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { initialChat, searchResults as seedResults, competitors, type ChatMessage } from '@/lib/mock-data'
import { searchKnowledge, chat as chatApi, uploadDocument } from '@/lib/services/knowledge'
import type { SearchResponse, ChatResponse } from '@/lib/types'
import { CitationTag } from '@/components/citation-tag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupTextarea } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useReveal } from '@/hooks/use-reveal'

function SectionHeader({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10"><Icon className="size-3.5 text-primary" /></div>
      <div><h2 className="text-sm font-semibold tracking-tight">{title}</h2>{description && <p className="text-[11px] text-muted-foreground">{description}</p>}</div>
    </div>
  )
}

export function KnowledgeView() {
  const [query, setQuery] = useState('DeepSeek 深度搜索')
  const [topK, setTopK] = useState(5)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(seedResults.slice(0, 5))
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<{ name: string; size: string }[]>([
    { name: 'deepseek-changelog-2026-07.md', size: '48 KB' },
    { name: 'appstore-reviews-doubao.txt', size: '132 KB' },
  ])
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [competitorId, setCompetitorId] = useState('cmp_001')
  const [selectedChunk, setSelectedChunk] = useState<(typeof seedResults)[0] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const heroRef = useReveal()
  const contentRef = useReveal()

  const avgScore = useMemo(() => results.length ? results.reduce((s, r) => s + r.similarity_score, 0) / results.length : 0, [results])

  async function runSearch() {
    setSearching(true)
    try {
      const res: SearchResponse = await searchKnowledge({ query, top_k: topK, competitor_id: competitorId, domain: competitors.find((c) => c.competitor_id === competitorId)?.category ?? 'AI Assistant' })
      setResults(res.results)
    } catch { await new Promise((r) => setTimeout(r, 700)); setResults(seedResults.slice(0, topK)) }
    finally { setSearching(false) }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    const next = Array.from(list).map((f) => ({ name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` }))
    setFiles((prev) => [...next, ...prev])
    next.forEach(async (f) => { try { await uploadDocument({ competitor_id: competitorId, file_name: f.name, document_type: 'changelog' }) } catch { /* fallback */ } })
    toast.success(`已上传 ${next.length} 个文件`, { description: '正在切分并生成向量' })
  }

  async function send() {
    const text = draft.trim(); if (!text || thinking) return
    setDraft(''); setMessages((prev) => [...prev, { id: `msg_${prev.length + 1}`, role: 'user', content: text }]); setThinking(true)
    try {
      const res: ChatResponse = await chatApi({ question: text, competitor_id: competitorId })
      setMessages((prev) => [...prev, { id: `msg_${prev.length + 1}`, role: 'assistant', content: res.answer, citations: res.citations }])
    } catch {
      await new Promise((r) => setTimeout(r, 1100))
      setMessages((prev) => [...prev, { id: `msg_${prev.length + 1}`, role: 'assistant', content: '基于知识库检索，竞品在高峰期的稳定性问题是最可复用的切入点[chunk_002]；同时其开放平台的批量推理定价正在重塑企业侧价格锚点[chunk_003]。', citations: [{ chunk_id: 'chunk_002', source_title: 'App Store', raw_text_snippet: '经常提示网络连接超时。' }, { chunk_id: 'chunk_003', source_title: 'Changelog', raw_text_snippet: '开放平台上线深度 API。' }] }])
    } finally { setThinking(false) }
  }

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section ref={heroRef} className="reveal relative overflow-hidden rounded-3xl section-hero px-6 py-12 lg:px-12 lg:py-16">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-primary/70 uppercase">Vector Store · RAG</span>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight lg:text-5xl">知识库 & RAG 检索</h1>
            <p className="max-w-lg text-[14px] leading-relaxed text-muted-foreground">语义搜索与智能问答。上传文档构建向量索引，用自然语言查询竞品情报并获取带引用来源的回答。</p>
          </div>
          <div className="reveal-stagger flex gap-3">
            <MetricChip icon={Boxes} label="已索引片段" value="1,248" />
            <MetricChip icon={Cpu} label="嵌入模型" value="3-small" />
            <MetricChip icon={Gauge} label="检索延迟" value="42ms" />
          </div>
        </div>
      </section>

      {/* TWO COLUMN */}
      <section ref={contentRef} className="reveal mt-8">
        <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
          {/* LEFT */}
          <div className="flex flex-col gap-8">
            {/* Upload */}
            <Card className="card-shadow card-lift reveal bg-white">
              <CardHeader className="border-b border-border/50 pb-5">
                <SectionHeader icon={CloudUpload} title="文档上传" description="支持 .md / .pdf / .txt，拖拽或点击上传" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                  className={cn('flex w-full flex-col items-center gap-2.5 rounded-2xl border border-dashed px-6 py-10 text-center transition-all duration-300', dragging ? 'border-primary/50 bg-primary/[0.03] scale-[0.99]' : 'border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/[0.02]')}>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><CloudUpload className="size-5 text-primary" /></div>
                  <span className="text-[13px] font-medium">拖拽文件到此处，或点击选择</span>
                  <span className="font-mono text-[11px] text-muted-foreground">.md · .pdf · .txt · 单文件最大 20 MB</span>
                  <input ref={inputRef} type="file" multiple accept=".md,.pdf,.txt" className="hidden" onChange={(e) => addFiles(e.target.files)} />
                </button>
                {files.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 transition-all hover:border-border hover:bg-white">
                        <FileText className="size-3.5 shrink-0 text-primary/70" /><span className="truncate text-[12px]">{f.name}</span><span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{f.size}</span>
                        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="size-3.5" /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Search */}
            <Card className="card-shadow card-lift reveal bg-white">
              <CardHeader className="border-b border-border/50 pb-5">
                <SectionHeader icon={Search} title="语义检索" description="验证向量召回质量，调整 Top-K 观察相似度分布" />
              </CardHeader>
              <CardContent className="flex flex-col gap-5 pt-6">
                <InputGroup>
                  <InputGroupAddon><Search className="size-3.5" /></InputGroupAddon>
                  <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) runSearch() }} placeholder="输入检索查询语句…" className="text-[13px]" />
                  <InputGroupAddon align="inline-end"><InputGroupButton variant="default" onClick={runSearch} disabled={searching} className="btn-press rounded-full">{searching ? <Spinner /> : '检索'}</InputGroupButton></InputGroupAddon>
                </InputGroup>
                <div className="flex items-center gap-4">
                  <span className="shrink-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Top-K</span>
                  <Slider value={[topK]} min={1} max={10} step={1} onValueChange={(v) => setTopK(Array.isArray(v) ? v[0] : (v as number))} className="flex-1" />
                  <span className="w-8 shrink-0 text-right font-mono text-[12px] tabular-nums">{topK}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-4 text-[11px] text-muted-foreground"><span>命中 {results.length} 个片段</span><span className="font-mono">avg similarity {avgScore.toFixed(2)}</span></div>
                <ul className="flex flex-col gap-3">
                  {results.map((r, i) => (
                    <li key={r.chunk_id} className="reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                      <Sheet>
                        <SheetTrigger className="group w-full cursor-pointer rounded-2xl border border-border/50 bg-muted/15 p-4 text-left transition-all duration-300 hover:border-sky-200 hover:bg-sky-50/30 hover:scale-[1.01]" onClick={() => setSelectedChunk(r)}>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{r.chunk_id}</span>
                            <span className="truncate text-[11px] text-muted-foreground">{r.source}</span>
                            <Badge variant="secondary" className={cn('ml-auto shrink-0 border-0 font-mono text-[10px]', r.similarity_score >= 0.9 ? 'bg-emerald-50 text-emerald-700' : r.similarity_score >= 0.82 ? 'bg-sky-50 text-sky-700' : 'bg-muted text-muted-foreground')}>{r.similarity_score.toFixed(2)}</Badge>
                          </div>
                          <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-foreground/80">{r.content}</p>
                          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500" style={{ width: `${r.similarity_score * 100}%` }} /></div>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[420px] sm:max-w-[480px]">
                          <SheetHeader><SheetTitle className="text-[15px]">片段详情</SheetTitle><SheetDescription>{r.chunk_id} · {r.source}</SheetDescription></SheetHeader>
                          <div className="mt-6 flex flex-col gap-4">
                            <div className="flex items-center gap-2"><span className="text-[12px] text-muted-foreground">相似度</span><Badge variant="secondary" className={cn('border-0 font-mono text-[11px]', r.similarity_score >= 0.9 ? 'bg-emerald-50 text-emerald-700' : r.similarity_score >= 0.82 ? 'bg-sky-50 text-sky-700' : 'bg-muted text-muted-foreground')}>{r.similarity_score.toFixed(4)}</Badge></div>
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4"><p className="text-[13px] leading-relaxed">{r.content}</p></div>
                            <div className="text-[11px] text-muted-foreground">来源：{r.source} · ID：{r.chunk_id}</div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — Chat */}
          <div>
            <div className="mb-4"><SectionHeader icon={MessageSquare} title="RAG 对话" description="基于知识库的智能问答" /></div>
            <Card className="card-shadow card-lift reveal flex flex-col bg-white xl:sticky xl:top-[104px] xl:h-[calc(100svh-136px)]">
              <CardContent className="flex max-h-[480px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6 xl:max-h-none">
                {messages.map((m, i) => (
                  <div key={m.id} className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')} style={{ animation: `fadeInUp 0.4s ${i * 50}ms both` }}>
                    {m.role === 'assistant' && <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20"><Sparkles className="size-3.5 text-primary" /></div>}
                    <div className={cn('max-w-[86%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-border/50 bg-muted/20')}>
                      {m.role === 'assistant' ? <AssistantText message={m} /> : m.content}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20"><Sparkles className="size-3.5 animate-pulse text-primary" /></div>
                    <span className="flex items-center gap-2 text-[12px] text-muted-foreground"><Spinner className="size-3.5" />正在检索知识库…</span>
                  </div>
                )}
              </CardContent>
              <Separator className="bg-border/50" />
              <div className="p-4">
                <InputGroup>
                  <InputGroupTextarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} placeholder="向情报智能体提问…" className="min-h-[68px] text-[13px]" />
                  <InputGroupAddon align="block-end">
                    <span className="font-mono text-[10px] text-muted-foreground">Enter 发送 · Shift + Enter 换行</span>
                    <InputGroupButton variant="default" className="btn-press ml-auto rounded-full" onClick={send} disabled={thinking || !draft.trim()}><SendHorizontal data-icon="inline-start" />发送</InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}

function AssistantText({ message }: { message: ChatMessage }) {
  const parts = message.content.split(/(\[chunk_\d+\])/g)
  return <p className="text-[13px] leading-relaxed">{parts.map((part, i) => { const match = part.match(/^\[(chunk_\d+)\]$/); if (!match) return <span key={i}>{part}</span>; const citation = message.citations?.find((c) => c.chunk_id === match[1]); if (!citation) return <span key={i}>{part}</span>; return <CitationTag key={i} citation={citation} superscript /> })}</p>
}

function MetricChip({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="reveal flex flex-col items-center gap-1 rounded-xl bg-white p-4 ring-1 ring-black/5 transition-all hover:scale-105 hover:ring-black/10">
      <Icon className="size-5 text-primary/60" /><span className="text-lg font-bold tracking-tight tabular-nums">{value}</span><span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
