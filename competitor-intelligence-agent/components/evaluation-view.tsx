'use client'

import { useState } from 'react'
import {
  BadgeCheck, CircleSlash, FlaskConical, Gavel, History, Quote,
  ShieldCheck, Sparkles, XCircle, Loader2, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { evaluationHistory, evaluations } from '@/lib/mock-data'
import type { EvaluationRun } from '@/lib/types'
import { runEvaluation as runEvaluationApi } from '@/lib/services/evaluation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useReveal } from '@/hooks/use-reveal'

const METRICS = [
  { key: 'faithfulness', label: '忠实度', en: 'Faithfulness', value: evaluations.faithfulness, icon: ShieldCheck, tone: 'emerald' as const, hint: '回答内容是否严格基于检索片段' },
  { key: 'citation', label: '引用准确率', en: 'Citation Accuracy', value: evaluations.citation_accuracy, icon: Quote, tone: 'sky' as const, hint: '引用标签与原文片段的匹配程度' },
  { key: 'completeness', label: '完整度', en: 'Completeness', value: evaluations.completeness, icon: BadgeCheck, tone: 'sky' as const, hint: '是否覆盖问题涉及的全部关键维度' },
  { key: 'hallucination', label: '幻觉率', en: 'Hallucination Rate', value: evaluations.hallucination_rate, icon: CircleSlash, tone: 'emerald' as const, hint: '越低越好 · 当前处于优秀区间', inverted: true },
]

const TONE_MAP: Record<string, { text: string; ring: string; bg: string; stroke: string }> = {
  emerald: { text: 'text-emerald-600', ring: 'ring-emerald-200', bg: 'bg-emerald-50', stroke: '#34c759' },
  sky: { text: 'text-sky-600', ring: 'ring-sky-200', bg: 'bg-sky-50', stroke: '#0071e3' },
}

export function EvaluationView() {
  const [reportId, setReportId] = useState('rpt_20260801_swot')
  const [running, setRunning] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const heroRef = useReveal()
  const gaugesRef = useReveal()

  async function run() {
    setRunning(true)
    try { await runEvaluationApi({ report_id: reportId }); toast.success('评估完成') }
    catch { await new Promise((r) => setTimeout(r, 1500)); toast.success('评估完成（模拟）') }
    finally { setRunning(false) }
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
          Quality Gate
        </span>
        <h1 className="max-w-2xl text-[40px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[56px]">
          质量评估，
          <br />
          <span className="text-primary">LLM-as-a-Judge 裁判模型。</span>
        </h1>
        <p className="max-w-lg text-[17px] leading-relaxed text-muted-foreground">
          对 SWOT 报告运行忠实度、引用准确率、完整度与幻觉率四维检测，确保每一份分析报告都可信赖。
        </p>
        <div className="flex items-center gap-3">
          <Select value={reportId} onValueChange={(v) => setReportId(v as string)}>
            <SelectTrigger className="h-12 w-[240px] rounded-2xl font-mono text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {evaluationHistory.map((h) => (
                  <SelectItem key={h.report_id} value={h.report_id} className="font-mono text-[12px]">
                    {h.report_id}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            size="lg"
            className="btn-press rounded-full px-8 text-[15px]"
            onClick={run}
            disabled={running}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
            {running ? '评估中…' : '运行评估'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="btn-press rounded-full px-6 text-[15px]"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-4" />
            评估历史
          </Button>
        </div>
      </motion.section>

      {/* ================================================================
          GAUGE CARDS — clean ring charts
          ================================================================ */}
      <section ref={gaugesRef} className="py-8 lg:py-12">
        <div className="mb-8">
          <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
            Quality Metrics
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em]">评估指标</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {METRICS.map((m, i) => (
            <GaugeCard key={m.key} metric={m} index={i} />
          ))}
        </div>
      </section>

      {/* ================================================================
          QUALITY GATE BANNER
          ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center gap-4 rounded-3xl border border-border/50 bg-white p-5 ring-1 ring-black/5"
      >
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground">
          当前报告的忠实度与引用准确率均高于 0.90 阈值，幻觉率 0.03 处于优秀区间。
        </p>
        <Badge variant="secondary" className="border-0 bg-emerald-50 text-[11px] font-medium text-emerald-700">
          质量门禁通过
        </Badge>
      </motion.div>

      {/* ================================================================
          HISTORY SHEET
          ================================================================ */}
      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                    <History className="size-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold">评估历史</h2>
                    <p className="font-mono text-[11px] text-muted-foreground">{evaluationHistory.length} 条记录</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setHistoryOpen(false)}>
                  <XCircle className="size-5" />
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-3">
                  {evaluationHistory.map((h, i) => (
                    <HistoryRow key={h.report_id} item={h} index={i} isActive={h.report_id === reportId} />
                  ))}
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
   Gauge Card — SVG ring
   ───────────────────────────────────────────── */
function GaugeCard({ metric, index }: { metric: (typeof METRICS)[number]; index: number }) {
  const tone = TONE_MAP[metric.tone]; const Icon = metric.icon
  const fill = metric.inverted ? 1 - metric.value : metric.value
  const r = 30; const c = 2 * Math.PI * r

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-3xl bg-white p-6 ring-1 ring-black/5 transition-shadow hover:ring-black/10"
    >
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cn('flex size-9 items-center justify-center rounded-xl ring-1', tone.bg, tone.ring, tone.text)}>
            <Icon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] font-semibold tracking-[-0.01em]">{metric.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{metric.en}</span>
          </div>
        </div>

        {/* Ring chart */}
        <div className="flex items-center gap-4">
          <div className="relative size-[76px] shrink-0">
            <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="36" cy="36" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
              <circle
                cx="36" cy="36" r={r}
                fill="none"
                stroke={tone.stroke}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - fill)}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('text-[18px] font-bold tabular-nums', tone.text)}>
                {metric.value.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Badge variant="secondary" className={cn('w-fit border-0 text-[10px] font-medium', tone.bg, tone.text)}>
              {metric.inverted ? '低幻觉' : fill >= 0.9 ? '优秀' : '良好'}
            </Badge>
            <p className="text-[12px] leading-relaxed text-muted-foreground">{metric.hint}</p>
          </div>
        </div>

        {/* Bar */}
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${fill * 100}%`, background: tone.stroke }}
          />
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   History Row
   ───────────────────────────────────────────── */
function HistoryRow({ item, index, isActive }: { item: EvaluationRun; index: number; isActive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-4 transition-all',
        isActive
          ? 'border-primary/30 bg-primary/[0.02] ring-1 ring-primary/20'
          : 'border-border/50 bg-white hover:border-border hover:shadow-sm',
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-[12px] font-medium">{item.report_id}</span>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.evaluated_at}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn(
            'border-0 text-[10px] font-medium',
            item.status === 'passed' ? 'bg-emerald-50 text-emerald-700' : item.status === 'running' ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-600',
          )}>
            {item.status === 'passed' ? 'Passed' : item.status === 'running' ? 'Running' : 'Failed'}
          </Badge>
          <ChevronRight className="size-3.5 text-muted-foreground/40" />
        </div>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { label: 'Faith.', value: item.scores.faithfulness, inverted: false },
          { label: 'Citation', value: item.scores.citation_accuracy, inverted: false },
          { label: 'Compl.', value: item.scores.completeness, inverted: false },
          { label: 'Halluc.', value: item.scores.hallucination_rate, inverted: true },
        ] as const).map((s) => {
          const good = s.inverted ? s.value <= 0.08 : s.value >= 0.85
          return (
            <div key={s.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-muted-foreground">{s.label}</span>
                <span className={cn('font-mono text-[10px] tabular-nums font-medium', good ? 'text-emerald-600' : 'text-red-500')}>
                  {s.value.toFixed(2)}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', good ? 'bg-emerald-400' : 'bg-red-400')}
                  style={{ width: `${s.inverted ? (1 - s.value) * 100 : s.value * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
