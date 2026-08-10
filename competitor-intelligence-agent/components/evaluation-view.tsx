'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck, CircleSlash, FlaskConical, Gavel, History, Quote,
  ShieldCheck, Sparkles, XCircle, Loader2, ChevronRight, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Evaluations, Competitor, EvaluationRun, EvalReportListItem } from '@/lib/types'
import { runEvaluation as runEvaluationApi, listEvalReports } from '@/lib/services/evaluation'
import { listCompetitors } from '@/lib/services/competitor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useReveal } from '@/hooks/use-reveal'

// Formula docs for display
const FORMULA_DOCS: Record<string, { zh: string; formula: string }> = {
  faithfulness: {
    zh: '忠实度：每个SWOT分析点与其引用原文片段的语义相似度均值',
    formula: '1/N · Σ cosine_sim(embed(point), embed(raw_text_snippet))',
  },
  citation_accuracy: {
    zh: '引用准确率：chunk_id在向量库中真实存在的比例',
    formula: 'verified_chunk_ids / total_chunk_ids',
  },
  completeness: {
    zh: '完整度：四象限覆盖度评分',
    formula: 'min(avg(items_per_quadrant) / 3, 1.0)',
  },
  hallucination_rate: {
    zh: '幻觉率：分析点与原文相似度低于0.5阈值的比例',
    formula: 'count(similarity < 0.5) / total_points',
  },
}

const TONE_MAP: Record<string, { text: string; ring: string; bg: string; stroke: string }> = {
  emerald: { text: 'text-emerald-600', ring: 'ring-emerald-200', bg: 'bg-emerald-50', stroke: '#34c759' },
  sky: { text: 'text-sky-600', ring: 'ring-sky-200', bg: 'bg-sky-50', stroke: '#0071e3' },
}

export function EvaluationView() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [reports, setReports] = useState<EvalReportListItem[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string>('')  // '' = auto-pick latest
  const [reportsLoading, setReportsLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // Start with null — no mock data
  const [scores, setScores] = useState<Evaluations | null>(null)
  const [history, setHistory] = useState<{ report_id: string; scores: Evaluations; evaluated_at: string }[]>([])

  const heroRef = useReveal()
  const gaugesRef = useReveal()

  useEffect(() => {
    listCompetitors().then(setCompetitors).catch(() => setCompetitors([]))
    listEvalReports()
      .then((r) => setReports(r))
      .catch(() => setReports([]))
      .finally(() => setReportsLoading(false))
  }, [])

  async function run() {
    setRunning(true)
    try {
      const payload = selectedReportId ? { report_id: selectedReportId } : {}
      const result = await runEvaluationApi(payload)
      setScores(result)
      setHistory((prev) => [{
        report_id: selectedReportId || result.formulas?.report_id || 'auto-latest',
        scores: result,
        evaluated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }, ...prev])
      toast.success('评估完成', { description: '已运行确定性公式 + LLM 裁判双重评估' })
    }
    catch (err: any) { toast.error('评估失败', { description: err?.message ?? '请先生成 SWOT 报告再运行评估' }) }
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
          <span className="text-primary">确定性公式 + LLM 双重裁判。</span>
        </h1>
        <p className="max-w-lg text-[17px] leading-relaxed text-muted-foreground">
          对 SWOT 报告运行四维检测：忠实度（语义相似度）、引用准确率（chunk_id 验证）、完整度（四象限覆盖）、幻觉率（低相似度比例）。每项得分由确定性公式与 LLM 裁判取平均。
        </p>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-3 max-w-md">
            <Select value={selectedReportId} onValueChange={(v) => setSelectedReportId(v ?? '')}>
              <SelectTrigger className="h-12 flex-1 rounded-2xl border border-border/60 bg-muted/30 px-4 text-[13px] font-mono">
                {reportsLoading ? (
                  <span className="text-muted-foreground/50 flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    加载报告列表…
                  </span>
                ) : (
                  <SelectValue placeholder={reports.length === 0 ? '暂无 SWOT 报告，请先生成' : '选择报告（留空 = 自动取最新）'} />
                )}
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-2xl">
                <SelectGroup>
                  {/* Default: auto-pick latest */}
                  <SelectItem value="" className="font-mono text-[13px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">⭐ 自动选择最新报告</span>
                      <span className="text-[11px] text-muted-foreground">不指定报告，评估最近生成的一份</span>
                    </div>
                  </SelectItem>
                  <div className="my-1 border-t border-border/40" />
                  {reports.map((r) => (
                    <SelectItem key={r.report_id} value={r.report_id} className="font-mono text-[13px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[200px]">{r.report_id}</span>
                          <Badge variant="secondary" className="shrink-0 text-[10px] px-1 py-0">{r.total_points} 条</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {r.competitor_names} · {r.domain} · {r.created_at?.slice(0, 10)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="lg"
            className="btn-press rounded-full px-8 text-[15px]"
            onClick={run}
            disabled={running || reportsLoading}
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
          GAUGE CARDS — clean ring charts with formula disclosure
          ================================================================ */}
      <section ref={gaugesRef} className="py-8 lg:py-12">
        <div className="mb-8">
          <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
            Quality Metrics
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em]">评估指标</h2>
        </div>

        {!scores ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/50 bg-muted/10 py-20 text-center">
            <FlaskConical className="size-10 text-muted-foreground/25" />
            <p className="text-[14px] text-muted-foreground">尚未运行评估</p>
            <p className="text-[12px] text-muted-foreground/60 max-w-md">
             选择一份 SWOT 报告（或留空自动选最新），点击"运行评估"即可。
            </p>
          </div>
        ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {([
            { key: 'faithfulness', label: '忠实度', en: 'Faithfulness', value: scores.faithfulness, icon: ShieldCheck, tone: 'emerald' as const, inverted: false },
            { key: 'citation_accuracy', label: '引用准确率', en: 'Citation Accuracy', value: scores.citation_accuracy, icon: Quote, tone: 'sky' as const, inverted: false },
            { key: 'completeness', label: '完整度', en: 'Completeness', value: scores.completeness, icon: BadgeCheck, tone: 'sky' as const, inverted: false },
            { key: 'hallucination_rate', label: '幻觉率', en: 'Hallucination Rate', value: scores.hallucination_rate, icon: CircleSlash, tone: 'emerald' as const, inverted: true },
          ]).map((m, i) => {
            const doc = FORMULA_DOCS[m.key]
            return (
              <GaugeCard
                key={m.key}
                metric={{ ...m, hint: doc.zh, formula: doc.formula }}
                index={i}
              />
            )
          })}
        </div>
        )}
      </section>

      {/* ================================================================
          QUALITY GATE BANNER — only shown when scores exist
          ================================================================ */}
      {scores && (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center gap-4 rounded-3xl border border-border/50 bg-white p-5 ring-1 ring-black/5"
      >
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground">
          评分方式：每项指标由<strong>确定性公式</strong>（语义相似度、chunk_id 存在性验证）与 <strong>LLM 裁判</strong>（DeepSeek）取平均值得出。展开下方指标卡片可查看公式详情。
        </p>
        <Badge variant="secondary" className={cn(
          'border-0 text-[11px] font-medium',
          scores.hallucination_rate <= 0.08 && scores.faithfulness >= 0.85
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700',
        )}>
          {scores.hallucination_rate <= 0.08 && scores.faithfulness >= 0.85 ? '质量门禁通过' : '需人工复核'}
        </Badge>
      </motion.div>
      )}

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
                    <p className="font-mono text-[11px] text-muted-foreground">{history.length} 条记录</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setHistoryOpen(false)}>
                  <XCircle className="size-5" />
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-3">
                  {history.map((h, i) => (
                    <HistoryRow key={h.report_id} item={{ ...h, status: 'passed' as const }} index={i} isActive={h.report_id === selectedReportId} />
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
function GaugeCard({ metric, index }: {
  metric: { key: string; label: string; en: string; value: number; icon: any; tone: 'emerald' | 'sky'; inverted: boolean; hint: string; formula?: string }
  index: number
}) {
  const tone = TONE_MAP[metric.tone]; const Icon = metric.icon
  const fill = metric.inverted ? 1 - metric.value : metric.value
  const r = 30; const c = 2 * Math.PI * r
  const [showFormula, setShowFormula] = useState(false)

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
          <button
            onClick={(e) => { e.stopPropagation(); setShowFormula(!showFormula) }}
            className="ml-auto rounded-lg p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title="查看计算公式"
          >
            <Info className="size-3.5" />
          </button>
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
              {metric.inverted ? (metric.value <= 0.05 ? '优秀' : '需关注') : fill >= 0.9 ? '优秀' : fill >= 0.7 ? '良好' : '需改进'}
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

        {/* Formula disclosure */}
        <AnimatePresence>
          {showFormula && metric.formula && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-1 rounded-xl border border-border/50 bg-muted/20 p-3">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">计算公式</span>
                <code className="mt-1 block text-[11px] leading-relaxed text-foreground/70">{metric.formula}</code>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
