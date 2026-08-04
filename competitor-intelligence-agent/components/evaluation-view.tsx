'use client'

import { useState } from 'react'
import {
  BadgeCheck,
  CircleSlash,
  FlaskConical,
  Gavel,
  History,
  Quote,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { evaluationHistory, evaluations } from '@/lib/mock-data'
import { runEvaluation as runEvaluationApi } from '@/lib/services/evaluation'
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const METRICS = [
  { key: 'faithfulness', label: '忠实度', en: 'Faithfulness', value: evaluations.faithfulness, icon: ShieldCheck, tone: 'emerald' as const, hint: '回答内容是否严格基于检索片段' },
  { key: 'citation', label: '引用准确率', en: 'Citation Accuracy', value: evaluations.citation_accuracy, icon: Quote, tone: 'violet' as const, hint: '引用标签与原文片段的匹配程度' },
  { key: 'completeness', label: '完整度', en: 'Completeness', value: evaluations.completeness, icon: BadgeCheck, tone: 'violet' as const, hint: '是否覆盖问题涉及的全部关键维度' },
  { key: 'hallucination', label: '幻觉率', en: 'Hallucination Rate', value: evaluations.hallucination_rate, icon: CircleSlash, tone: 'emerald' as const, hint: '越低越好 · 当前处于优秀区间', inverted: true },
]

const TONE_MAP = {
  emerald: { text: 'text-emerald-600', ring: 'ring-emerald-200', bg: 'bg-emerald-50', stroke: '#10b981' },
  violet: { text: 'text-violet-600', ring: 'ring-violet-200', bg: 'bg-violet-50', stroke: '#7c3aed' },
}

/* ── Section header ── */
function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-3.5 text-primary" />
      </div>
      <div>
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

export function EvaluationView() {
  const [reportId, setReportId] = useState('rpt_20260801_swot')
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    try {
      const result = await runEvaluationApi({ report_id: reportId })
      toast.success('评估完成', { description: `${reportId} · faithfulness ${result.faithfulness} · hallucination ${result.hallucination_rate}` })
    } catch {
      await new Promise((r) => setTimeout(r, 1500))
      toast.success('评估完成（模拟）', { description: `${reportId} · faithfulness ${evaluations.faithfulness} · hallucination ${evaluations.hallucination_rate}` })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col">
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-violet-50/60 to-violet-100/40 px-6 py-10 lg:px-10 lg:py-14">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-primary/60 uppercase">Quality Gate</span>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight lg:text-[32px]">质量评估</h1>
            <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              LLM-as-a-Judge 裁判模型评估。对指定报告运行忠实度、引用准确率、完整度与幻觉率检测。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={reportId} onValueChange={(v) => setReportId(v as string)}>
              <SelectTrigger className="w-[220px] font-mono text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {evaluationHistory.map((h) => (
                    <SelectItem key={h.report_id} value={h.report_id} className="font-mono text-[12px]">{h.report_id}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button onClick={run} disabled={running} size="lg" className="rounded-full">
              {running ? <Spinner data-icon="inline-start" /> : <FlaskConical data-icon="inline-start" />}
              {running ? '评估中…' : '运行评估'}
            </Button>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 2 — 4 Gauges
          ================================================================ */}
      <section className="mt-8">
        <div className="mb-4">
          <SectionHeader icon={Gavel} title="评估指标" description="裁判模型输出四维质量指标" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {METRICS.map((m) => (
            <GaugeCard key={m.key} metric={m} />
          ))}
        </div>
      </section>

      {/* ================================================================
          SECTION 3 — History Table
          ================================================================ */}
      <section className="mt-8">
        <div className="mb-4">
          <SectionHeader icon={History} title="评估历史" description="历史报告的评估时间、指标快照与通过状态" />
        </div>
        <Card className="card-shadow bg-white">
          <CardContent className="px-0 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="pl-6 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Report ID</TableHead>
                    <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Evaluated At</TableHead>
                    <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Faithfulness</TableHead>
                    <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Citation</TableHead>
                    <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Completeness</TableHead>
                    <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Hallucination</TableHead>
                    <TableHead className="pr-6 text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluationHistory.map((h) => (
                    <TableRow key={h.report_id} className={cn('border-border/40 transition-colors', h.report_id === reportId && 'bg-primary/[0.04]')}>
                      <TableCell className="pl-6 font-mono text-[12px] text-foreground/85">{h.report_id}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">{h.evaluated_at}</TableCell>
                      <ScoreCell value={h.scores.faithfulness} />
                      <ScoreCell value={h.scores.citation_accuracy} />
                      <ScoreCell value={h.scores.completeness} />
                      <ScoreCell value={h.scores.hallucination_rate} inverted />
                      <TableCell className="pr-6 text-right">
                        <Badge variant="secondary" className={cn(
                          'border-0 text-[10px] font-medium',
                          h.status === 'passed' ? 'bg-emerald-50 text-emerald-700' : h.status === 'running' ? 'bg-violet-50 text-violet-700' : 'bg-red-50 text-red-600',
                        )}>
                          {h.status === 'passed' ? 'Passed' : h.status === 'running' ? 'Running' : 'Failed'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ================================================================
          SECTION 4 — Quality Gate
          ================================================================ */}
      <section className="mt-8">
        <Card className="card-shadow bg-white">
          <CardContent className="flex flex-wrap items-center gap-4 py-5">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
              当前报告的忠实度与引用准确率均高于 0.90 阈值，幻觉率 0.03 处于优秀区间。
              建议保留现有检索窗口（Top-K 5）与引用强制策略。
            </p>
            <Badge variant="secondary" className="border-0 bg-emerald-50 text-[10px] font-medium text-emerald-700">
              质量门禁通过
            </Badge>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

/* ── ScoreCell ── */
function ScoreCell({ value, inverted }: { value: number; inverted?: boolean }) {
  const good = inverted ? value <= 0.08 : value >= 0.85
  return (
    <TableCell className={cn('text-right font-mono text-[12px] tabular-nums', good ? 'text-emerald-600' : 'text-red-500')}>
      {value.toFixed(2)}
    </TableCell>
  )
}

/* ── GaugeCard ── */
function GaugeCard({ metric }: { metric: (typeof METRICS)[number] }) {
  const tone = TONE_MAP[metric.tone]
  const Icon = metric.icon
  const fill = metric.inverted ? 1 - metric.value : metric.value
  const r = 30
  const c = 2 * Math.PI * r

  return (
    <Card className="card-shadow gap-0 bg-white py-0 transition-shadow hover:card-shadow-hover">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex size-8 items-center justify-center rounded-lg ring-1', tone.bg, tone.ring, tone.text)}>
            <Icon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[12.5px] font-medium">{metric.label}</span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">{metric.en}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative size-[72px] shrink-0">
            <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="36" cy="36" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
              <circle cx="36" cy="36" r={r} fill="none" stroke={tone.stroke} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - fill)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('text-[17px] font-semibold tabular-nums', tone.text)}>{metric.value.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Badge variant="secondary" className={cn('w-fit border-0 text-[10px] font-medium', tone.bg, tone.text)}>
              {metric.inverted ? '低幻觉' : fill >= 0.9 ? '优秀' : '良好'}
            </Badge>
            <p className="text-[11px] leading-relaxed text-muted-foreground text-pretty">{metric.hint}</p>
          </div>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${fill * 100}%`, background: tone.stroke }} />
        </div>
      </div>
    </Card>
  )
}
