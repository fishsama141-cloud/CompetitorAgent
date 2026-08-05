'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, Copy,
  Lightbulb, Settings2, Shield, Sparkles, Swords, TrendingUp, Zap,
  XCircle, Loader2, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Competitor, SwotItem, SwotMatrix } from '@/lib/types'
import { generateSwot as generateSwotApi } from '@/lib/services/swot'
import { listCompetitors } from '@/lib/services/competitor'
import type { SwotGenerateResponse } from '@/lib/types'
import { CitationTag } from '@/components/citation-tag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useReveal } from '@/hooks/use-reveal'

const QUADRANTS = [
  { key: 'strengths' as const, title: '优势 Strengths', icon: Shield, tone: 'strength' },
  { key: 'weaknesses' as const, title: '劣势 Weaknesses', icon: AlertTriangle, tone: 'weakness' },
  { key: 'opportunities' as const, title: '机会 Opportunities', icon: TrendingUp, tone: 'opportunity' },
  { key: 'threats' as const, title: '威胁 Threats', icon: Swords, tone: 'threat' },
]

const TONE: Record<string, { chip: string; bar: string; iconBg: string }> = {
  strength: { chip: 'bg-sky-50 text-sky-600 ring-sky-200', bar: 'bg-sky-400', iconBg: 'bg-sky-50 ring-sky-200 text-sky-600' },
  weakness: { chip: 'bg-red-50 text-red-500 ring-red-200', bar: 'bg-red-400', iconBg: 'bg-red-50 ring-red-200 text-red-500' },
  opportunity: { chip: 'bg-emerald-50 text-emerald-600 ring-emerald-200', bar: 'bg-emerald-400', iconBg: 'bg-emerald-50 ring-emerald-200 text-emerald-600' },
  threat: { chip: 'bg-amber-50 text-amber-600 ring-amber-200', bar: 'bg-amber-400', iconBg: 'bg-amber-50 ring-amber-200 text-amber-600' },
}

export function SwotView({ domain }: { domain: string }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [targets, setTargets] = useState<string[]>([])
  const [days, setDays] = useState(30)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  // Start with EMPTY matrix (no mock data)
  const [swotData, setSwotData] = useState<SwotMatrix | null>(null)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [showRecs, setShowRecs] = useState(true)

  // Config sheet
  const [configOpen, setConfigOpen] = useState(false)

  const heroRef = useReveal()
  const matrixRef = useReveal()
  const recsRef = useReveal()

  // ── Load competitors from API ──────────────────────────────
  useEffect(() => {
    listCompetitors().then(setCompetitors).catch(() => setCompetitors([]))
  }, [])

  const label = targets.length === 0
    ? '未选择目标'
    : targets.map((id) => competitors.find((c) => c.competitor_id === id)?.name ?? id).join(' vs ')

  async function generate() {
    if (!targets.length) return
    setGenerating(true)
    try {
      const names = targets.map((id) => competitors.find((c) => c.competitor_id === id)?.name).filter(Boolean) as string[]
      const result: SwotGenerateResponse = await generateSwotApi({ competitors: names, domain, time_range_days: days })
      setSwotData(result.swot_matrix); setRecommendations(result.recommendations)
      toast.success('SWOT 报告已生成')
    } catch (err: any) { toast.error('SWOT 生成失败', { description: err?.message ?? '请确认向量库中有数据且 LLM API Key 已配置' }) }
    finally { setGenerating(false) }
  }

  function copyAll() {
    navigator.clipboard?.writeText(recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n'))
    setCopied(true); toast.success('已复制'); setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex flex-col">
      {/* ================================================================
          HERO — Apple-style
          ================================================================ */}
      <motion.section
        ref={heroRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-start gap-8 py-16 lg:py-24"
      >
        <span className="font-mono text-[11px] font-medium tracking-[0.2em] text-primary/60 uppercase">
          Strategy
        </span>
        <h1 className="max-w-2xl text-[40px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[56px]">
          SWOT 战略分析，
          <br />
          <span className="text-primary">带引用的竞争态势矩阵。</span>
        </h1>
        <p className="max-w-lg text-[17px] leading-relaxed text-muted-foreground">
          选择对比目标与时间窗口，智能体基于知识库自动推导优劣势与战略建议，每条结论附带原文引用。
        </p>
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="btn-press rounded-full px-8 text-[15px]"
            onClick={generate}
            disabled={generating || !targets.length}
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {generating ? '生成中…' : '生成 SWOT 报告'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="btn-press rounded-full px-6 text-[15px]"
            onClick={() => setConfigOpen(true)}
          >
            <Settings2 className="size-4" />
            配置
          </Button>
        </div>
        {/* Active config summary */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{label}</span>
          <span>{domain}</span>
          <span>近 {days} 天</span>
        </div>
      </motion.section>

      {/* ================================================================
          MATRIX — 2x2 clean card grid
          ================================================================ */}
      <section ref={matrixRef} className="py-8 lg:py-12">
        <div className="mb-8">
          <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
            Competitive Matrix
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em]">竞争态势矩阵</h2>
        </div>

        {!swotData ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/50 bg-muted/10 py-20 text-center">
            <Zap className="size-10 text-muted-foreground/25" />
            <p className="text-[14px] text-muted-foreground">尚未生成 SWOT 报告</p>
            <p className="text-[12px] text-muted-foreground/60 max-w-md">
              选择对比目标与时间窗口后，点击"生成 SWOT 报告"按钮。智能体将基于知识库中的竞品情报自动分析。
            </p>
          </div>
        ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {QUADRANTS.map((q) => {
            const tone = TONE[q.tone]; const Icon = q.icon; const items = swotData[q.key]
            const avgConf = items.length ? Math.round((items.reduce((s, i) => s + i.confidence, 0) / items.length) * 100) : 0
            return (
              <motion.div
                key={q.key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: QUADRANTS.indexOf(q) * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5"
              >
                {/* Quadrant header */}
                <div className="flex items-center gap-3 border-b border-border/40 px-6 py-5">
                  <div className={cn('flex size-9 items-center justify-center rounded-xl ring-1', tone.iconBg)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold tracking-[-0.01em]">{q.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{items.length} insights</span>
                  </div>
                  <span className={cn('rounded-lg px-2 py-1 font-mono text-[10px] font-medium ring-1', tone.chip)}>
                    {avgConf}% avg
                  </span>
                </div>
                {/* Quadrant items */}
                <div className="flex flex-col">
                  {items.map((item, i) => (
                    <SwotRow
                      key={`${q.key}-${i}`}
                      item={item}
                      tone={q.tone}
                      last={i === items.length - 1}
                    />
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
        )}
      </section>

      {/* ================================================================
          RECOMMENDATIONS — expandable
          ================================================================ */}
      {swotData && (
      <section ref={recsRef} className="py-8 lg:py-12">
        {/* Source disclosure for strategic recommendations */}
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50/50 p-3 text-[12px] text-sky-700">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>
            <strong>战略建议来源说明：</strong>战略建议由 DeepSeek LLM 基于知识库中的竞品情报数据自动生成，并非联网搜索或人工撰写。每条 SWOT 分析点均附带原文引用（chunk_id + 片段），可追溯至原始文档。
          </span>
        </div>
        <div
          className="mb-8 flex cursor-pointer items-end justify-between"
          onClick={() => setShowRecs(!showRecs)}
        >
          <div>
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
              Strategic Recommendations
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em]">
              战略建议 · {recommendations.length} 条
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="btn-press rounded-full"
              onClick={(e) => { e.stopPropagation(); copyAll() }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? '已复制' : '复制'}
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={(e) => { e.stopPropagation(); setShowRecs(!showRecs) }}>
              {showRecs ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showRecs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3">
                {recommendations.map((rec, i) => (
                  <motion.div
                    key={rec}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex gap-4 rounded-2xl border border-border/50 bg-white p-5 ring-1 ring-black/5 transition-all hover:ring-black/10"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-[11px] font-medium text-primary ring-1 ring-primary/20">
                      {i + 1}
                    </span>
                    <p className="text-[14px] leading-relaxed text-foreground/80">{rec}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      )}

      {/* ================================================================
          CONFIG SHEET
          ================================================================ */}
      <AnimatePresence>
        {configOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setConfigOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                    <Settings2 className="size-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold">报告配置</h2>
                    <p className="font-mono text-[11px] text-muted-foreground">选择对比目标与时间窗口</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setConfigOpen(false)}>
                  <XCircle className="size-5" />
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="flex flex-col gap-8">
                  {/* Targets */}
                  <div className="flex flex-col gap-3">
                    <label className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      对比目标
                    </label>
                    <ToggleGroup value={targets} onValueChange={(v) => setTargets(v as string[])} className="flex-wrap justify-start">
                      {competitors.map((c) => (
                        <ToggleGroupItem
                          key={c.competitor_id}
                          value={c.competitor_id}
                          className="text-[13px] transition-all duration-200 aria-pressed:bg-primary/10 aria-pressed:text-primary aria-pressed:ring-1 aria-pressed:ring-primary/30"
                        >
                          {c.name}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  {/* Time range */}
                  <div className="flex flex-col gap-3">
                    <label className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      时间范围 · 近 {days} 天
                    </label>
                    <div className="flex items-center gap-4">
                      <Slider value={[days]} min={7} max={90} step={1} onValueChange={(v) => setDays(Array.isArray(v) ? v[0] : (v as number))} className="flex-1" />
                      <span className="w-12 text-right font-mono text-[14px] tabular-nums font-medium">{days}d</span>
                    </div>
                  </div>

                  {/* Domain display */}
                  <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                    <span className="font-mono text-[10px] text-muted-foreground">当前领域</span>
                    <p className="mt-1 text-[14px] font-medium">{domain}</p>
                  </div>
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
   SWOT Row
   ───────────────────────────────────────────── */
function SwotRow({ item, tone, last }: { item: SwotItem; tone: string; last: boolean }) {
  const t = TONE[tone]
  return (
    <div className={cn('flex flex-col gap-2.5 px-6 py-4 transition-colors hover:bg-muted/20', !last && 'border-b border-border/30')}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', t.bar)} />
        <p className="flex-1 text-[14px] leading-relaxed">{item.point}</p>
        <span className={cn('shrink-0 rounded-lg px-1.5 py-0.5 font-mono text-[10px] font-medium ring-1', t.chip)}>
          {Math.round(item.confidence * 100)}%
        </span>
      </div>
      <div className="flex items-center gap-2 pl-[18px]">
        <CitationTag citation={item.citation} />
        <span className="truncate text-[11px] text-muted-foreground">{item.citation.source_title}</span>
        <div className="ml-auto hidden w-20 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
          <div className={cn('h-[3px] rounded-full transition-all', t.bar)} style={{ width: `${item.confidence * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
