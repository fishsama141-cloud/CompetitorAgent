'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Boxes,
  CloudUpload,
  Cpu,
  FileText,
  Gauge,
  MessageSquare,
  Search,
  SendHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  initialChat,
  searchResults as seedResults,
  competitors,
  type ChatMessage,
} from '@/lib/mock-data'
import { searchKnowledge, chat as chatApi, uploadDocument } from '@/lib/services/knowledge'
import type { SearchResponse, ChatResponse, UploadDocumentResponse } from '@/lib/types'
import { CitationTag } from '@/components/citation-tag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

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

  const avgScore = useMemo(
    () =>
      results.length
        ? results.reduce((s, r) => s + r.similarity_score, 0) / results.length
        : 0,
    [results],
  )

  async function runSearch() {
    setSearching(true)
    try {
      const res: SearchResponse = await searchKnowledge({
        query,
        top_k: topK,
        competitor_id: competitorId,
        domain: competitors.find((c) => c.competitor_id === competitorId)?.category ?? 'AI Assistant',
      })
      setResults(res.results)
    } catch {
      await new Promise((r) => setTimeout(r, 700))
      setResults(seedResults.slice(0, topK))
    } finally {
      setSearching(false)
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    const next = Array.from(list).map((f) => ({
      name: f.name,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
    }))
    setFiles((prev) => [...next, ...prev])

    // Try real API
    next.forEach(async (f) => {
      try {
        await uploadDocument({
          competitor_id: competitorId,
          file_name: f.name,
          document_type: 'changelog',
        })
      } catch {
        // fallback
      }
    })

    toast.success(`已上传 ${next.length} 个文件`, {
      description: 'knowledge_base.upload_document · 正在切分并生成向量',
    })
  }

  async function send() {
    const text = draft.trim()
    if (!text || thinking) return
    setDraft('')
    setMessages((prev) => [
      ...prev,
      { id: `msg_${prev.length + 1}`, role: 'user', content: text },
    ])
    setThinking(true)
    try {
      const res: ChatResponse = await chatApi({
        question: text,
        competitor_id: competitorId,
      })
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${prev.length + 1}`,
          role: 'assistant',
          content: res.answer,
          citations: res.citations,
        },
      ])
    } catch {
      await new Promise((r) => setTimeout(r, 1100))
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${prev.length + 1}`,
          role: 'assistant',
          content:
            '基于知识库检索，竞品在高峰期的稳定性问题是最可复用的切入点[chunk_002]；同时其开放平台的批量推理定价正在重塑企业侧价格锚点[chunk_003]。建议把「不中断的长会话」作为差异化叙事，并在企业方案中补齐审计与权限能力。',
          citations: [
            {
              chunk_id: 'chunk_002',
              source_title: 'App Store 评论',
              raw_text_snippet:
                '经常提示网络连接超时，需要反复重发才能拿到结果。',
            },
            {
              chunk_id: 'chunk_003',
              source_title: 'Changelog',
              raw_text_snippet:
                '开放平台上线深度 API 与批量推理定价，面向企业客户提供私有化部署。',
            },
          ],
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ---- Metrics row ---- */}
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Boxes}
          label="已索引片段"
          value="1,248"
          caption="total chunks indexed"
          trail="+128 本周新增"
          accent="primary"
        />
        <MetricCard
          icon={Cpu}
          label="嵌入模型"
          value="text-embedding-3-small"
          mono
          caption="1536 dimensions"
          trail="ChromaDB · cosine"
          accent="signal"
        />
        <MetricCard
          icon={Gauge}
          label="检索延迟"
          value="42 ms"
          caption="p95 vector latency"
          trail="较上周 -9 ms"
          accent="opportunity"
        />
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        {/* ===== Left Column ===== */}
        <div className="flex flex-col gap-8">
          {/* Upload */}
          <Card className="card-shadow border-0 bg-white transition-shadow hover:card-shadow-hover">
            <CardHeader className="border-b border-border/50 pb-5">
              <CardTitle className="flex items-center gap-2.5 text-[15px] tracking-tight">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <CloudUpload className="size-4 text-primary" />
                </div>
                文档上传
              </CardTitle>
              <CardDescription className="text-[12.5px]">
                支持 .md / .pdf / .txt，拖拽或点击上传至向量知识库。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-6">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  addFiles(e.dataTransfer.files)
                }}
                className={cn(
                  'flex w-full flex-col items-center gap-2.5 rounded-2xl border border-dashed px-6 py-10 text-center transition-all',
                  dragging
                    ? 'border-primary/50 bg-primary/[0.04]'
                    : 'border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/[0.02]',
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <CloudUpload className="size-5 text-primary" />
                </div>
                <span className="text-[13px] font-medium">
                  拖拽文件到此处，或点击选择
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  .md · .pdf · .txt · 单文件最大 20 MB
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".md,.pdf,.txt"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </button>

              {files.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 transition-colors hover:border-border"
                    >
                      <FileText className="size-3.5 shrink-0 text-sky-500" />
                      <span className="truncate text-[12px]">{f.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                        {f.size}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">移除 {f.name}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Semantic Search */}
          <Card className="card-shadow border-0 bg-white transition-shadow hover:card-shadow-hover">
            <CardHeader className="border-b border-border/50 pb-5">
              <CardTitle className="flex items-center gap-2.5 text-[15px] tracking-tight">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="size-4 text-primary" />
                </div>
                语义检索
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-3 text-[12.5px]">
                <span>验证向量召回质量，调整 Top-K 观察相似度分布。</span>
                <Select value={competitorId} onValueChange={(v) => setCompetitorId(v as string)}>
                  <SelectTrigger className="h-7 w-[140px] text-[11px]" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {competitors.map((c) => (
                        <SelectItem key={c.competitor_id} value={c.competitor_id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-6">
              <InputGroup>
                <InputGroupAddon>
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.nativeEvent.isComposing &&
                      e.keyCode !== 229
                    ) {
                      runSearch()
                    }
                  }}
                  placeholder="输入检索查询语句…"
                  className="text-[13px]"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    variant="default"
                    onClick={runSearch}
                    disabled={searching}
                    className="rounded-full"
                  >
                    {searching ? <Spinner /> : '检索'}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>

              <div className="flex items-center gap-4">
                <span className="shrink-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                  Top-K
                </span>
                <Slider
                  value={[topK]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(v) =>
                    setTopK(Array.isArray(v) ? v[0] : (v as number))
                  }
                  className="flex-1"
                />
                <span className="w-8 shrink-0 text-right font-mono text-[12px] tabular-nums">
                  {topK}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-4 text-[11px] text-muted-foreground">
                <span>命中 {results.length} 个片段</span>
                <span className="font-mono">
                  avg similarity {avgScore.toFixed(2)}
                </span>
              </div>

              <ul className="flex flex-col gap-3">
                {results.map((r) => (
                  <li key={r.chunk_id}>
                    <Sheet>
                      <SheetTrigger asChild>
                        <div
                          className="group w-full cursor-pointer rounded-2xl border border-border/50 bg-muted/15 p-4 text-left transition-all hover:border-sky-200 hover:bg-sky-50/30"
                          onClick={() => setSelectedChunk(r)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {r.chunk_id}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground">
                              {r.source}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'ml-auto shrink-0 border-0 font-mono text-[10px]',
                                r.similarity_score >= 0.9
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : r.similarity_score >= 0.82
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {r.similarity_score.toFixed(2)}
                            </Badge>
                          </div>
                          <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-foreground/80">
                            {r.content}
                          </p>
                          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                              style={{ width: `${r.similarity_score * 100}%` }}
                            />
                          </div>
                        </div>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[420px] sm:max-w-[480px]">
                        <SheetHeader>
                          <SheetTitle className="text-[15px]">片段详情</SheetTitle>
                          <SheetDescription>
                            {r.chunk_id} · {r.source}
                          </SheetDescription>
                        </SheetHeader>
                        <div className="mt-6 flex flex-col gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-muted-foreground">相似度</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'border-0 font-mono text-[11px]',
                                r.similarity_score >= 0.9
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : r.similarity_score >= 0.82
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {r.similarity_score.toFixed(4)}
                            </Badge>
                          </div>
                          <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                            <p className="text-[13px] leading-relaxed text-foreground/85">
                              {r.content}
                            </p>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            来源：{r.source} · ID：{r.chunk_id}
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* ===== Right Column — RAG Chat ===== */}
        <Card className="card-shadow flex flex-col overflow-hidden border-0 bg-white xl:sticky xl:top-[104px] xl:h-[calc(100svh-136px)]">
          <CardHeader className="border-b border-border/50 pb-5">
            <CardTitle className="flex items-center gap-2.5 text-[15px] tracking-tight">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="size-4 text-primary" />
              </div>
              RAG 对话
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3 text-[12.5px]">
              <span>基于知识库的智能问答，回答附带可点击引用。</span>
              <Select value={competitorId} onValueChange={(v) => setCompetitorId(v as string)}>
                <SelectTrigger className="h-7 w-[140px] text-[11px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {competitors.map((c) => (
                      <SelectItem key={c.competitor_id} value={c.competitor_id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </CardDescription>
          </CardHeader>

          <CardContent className="flex max-h-[480px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6 xl:max-h-none">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex gap-3',
                  m.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {m.role === 'assistant' && (
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                    <Sparkles className="size-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[86%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-md bg-primary/10 text-foreground ring-1 ring-primary/20'
                      : 'rounded-bl-md border border-border/50 bg-muted/20',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <AssistantText message={m} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex items-center gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Sparkles className="size-3.5 animate-pulse text-primary" />
                </div>
                <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Spinner className="size-3.5" />
                  正在检索知识库并生成引用…
                </span>
              </div>
            )}
          </CardContent>

          <Separator className="bg-border/50" />

          <div className="p-4">
            <InputGroup>
              <InputGroupTextarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing &&
                    e.keyCode !== 229
                  ) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="向情报智能体提问，例如：竞品最近的定价变化意味着什么？"
                className="min-h-[68px] text-[13px]"
              />
              <InputGroupAddon align="block-end">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Enter 发送 · Shift + Enter 换行
                </span>
                <InputGroupButton
                  variant="default"
                  className="ml-auto rounded-full"
                  onClick={send}
                  disabled={thinking || !draft.trim()}
                >
                  <SendHorizontal data-icon="inline-start" />
                  发送
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ── Assistant text with CitationTag ── */
function AssistantText({ message }: { message: ChatMessage }) {
  const parts = message.content.split(/(\[chunk_\d+\])/g)
  return (
    <p className="text-[13px] leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[(chunk_\d+)\]$/)
        if (!match) return <span key={i}>{part}</span>
        const citation = message.citations?.find(
          (c) => c.chunk_id === match[1],
        )
        if (!citation) return <span key={i}>{part}</span>
        return <CitationTag key={i} citation={citation} superscript />
      })}
    </p>
  )
}

/* ── MetricCard ── */
function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  trail,
  accent,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  caption: string
  trail: string
  accent: 'primary' | 'signal' | 'opportunity'
  mono?: boolean
}) {
  const accentClass = {
    primary: 'text-primary bg-primary/10 ring-primary/20',
    signal: 'text-sky-600 bg-sky-50 ring-sky-200',
    opportunity: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
  }[accent]

  return (
    <Card className="card-shadow gap-0 border-0 bg-white py-0 transition-shadow hover:card-shadow-hover">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-lg ring-1',
              accentClass,
            )}
          >
            <Icon className="size-4" />
          </div>
          <span className="text-[12px] text-muted-foreground">{label}</span>
        </div>
        <span
          className={cn(
            'truncate font-semibold tracking-tight',
            mono ? 'font-mono text-[15px]' : 'text-2xl tabular-nums',
          )}
        >
          {value}
        </span>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/70">
          <span className="truncate">{caption}</span>
          <span className="shrink-0 text-foreground/60">{trail}</span>
        </div>
      </div>
    </Card>
  )
}
