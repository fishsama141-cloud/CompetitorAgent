'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileDown,
  Lightbulb,
  MoreHorizontal,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  competitors,
  recommendations as mockRecommendations,
  swotMatrix as mockSwotMatrix,
  type SwotItem,
} from '@/lib/mock-data'
import { generateSwot as generateSwotApi } from '@/lib/services/swot'
import type { SwotGenerateResponse } from '@/lib/types'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const QUADRANTS = [
  {
    key: 'strengths' as const,
    title: '优势 Strengths',
    icon: Shield,
    tone: 'strength',
  },
  {
    key: 'weaknesses' as const,
    title: '劣势 Weaknesses',
    icon: AlertTriangle,
    tone: 'weakness',
  },
  {
    key: 'opportunities' as const,
    title: '机会 Opportunities',
    icon: TrendingUp,
    tone: 'opportunity',
  },
  {
    key: 'threats' as const,
    title: '威胁 Threats',
    icon: Swords,
    tone: 'threat',
  },
]

const TONE: Record<
  string,
  { border: string; chip: string; bar: string }
> = {
  strength: {
    border: 'border-border/50 hover:border-blue-200',
    chip: 'bg-blue-50 text-blue-600 ring-blue-200',
    bar: 'bg-blue-400',
  },
  weakness: {
    border: 'border-border/50 hover:border-red-200',
    chip: 'bg-red-50 text-red-500 ring-red-200',
    bar: 'bg-red-400',
  },
  opportunity: {
    border: 'border-border/50 hover:border-emerald-200',
    chip: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
    bar: 'bg-emerald-400',
  },
  threat: {
    border: 'border-border/50 hover:border-amber-200',
    chip: 'bg-amber-50 text-amber-600 ring-amber-200',
    bar: 'bg-amber-400',
  },
}

export function SwotView({ domain }: { domain: string }) {
  const [targets, setTargets] = useState<string[]>(['cmp_001', 'cmp_002'])
  const [days, setDays] = useState(30)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [swotData, setSwotData] = useState(mockSwotMatrix)
  const [recommendations, setRecommendations] = useState(
    mockRecommendations.map((r) => r.detail),
  )
  const [latestReportId, setLatestReportId] = useState('')
  const [showRecs, setShowRecs] = useState(true)

  const label =
    targets.length === 0
      ? '未选择目标'
      : targets
          .map(
            (id) =>
              competitors.find((c) => c.competitor_id === id)?.name ?? id,
          )
          .join(' vs ')

  async function generate() {
    setGenerating(true)
    try {
      const names = targets
        .map((id) => competitors.find((c) => c.competitor_id === id)?.name)
        .filter(Boolean) as string[]
      const result: SwotGenerateResponse = await generateSwotApi({
        competitors: names,
        domain,
        time_range_days: days,
      })
      setSwotData(result.swot_matrix)
      setRecommendations(result.recommendations)
      setLatestReportId(result.report_id)
      toast.success('SWOT 报告已生成', {
        description: `${label} · 近 ${days} 天 · report_id ${result.report_id}`,
      })
    } catch {
      await new Promise((r) => setTimeout(r, 1400))
      const fakeId = `rpt_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_swot`
      setLatestReportId(fakeId)
      toast.success('SWOT 报告已生成（模拟）', {
        description: `${label} · 近 ${days} 天 · report_id ${fakeId}`,
      })
    } finally {
      setGenerating(false)
    }
  }

  function copyAll() {
    const text = recommendations
      .map((r, i) => `${i + 1}. ${r}`)
      .join('\n')
    navigator.clipboard?.writeText(text)
    setCopied(true)
    toast.success('战略建议已复制到剪贴板')
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ---- Config Card ---- */}
      <Card className="card-shadow border-0 bg-white transition-shadow hover:card-shadow-hover">
        <CardHeader className="border-b border-border/50 pb-5">
          <CardTitle className="flex items-center gap-2.5 text-[15px] tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" />
            </div>
            报告配置
          </CardTitle>
          <CardDescription className="text-[12.5px]">
            选择对比目标与时间窗口，由智能体基于知识库生成带引用的 SWOT 矩阵。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_260px_auto] lg:items-end">
            <Field>
              <FieldLabel className="text-[12px]">对比目标</FieldLabel>
              <ToggleGroup
                value={targets}
                onValueChange={(v) => setTargets(v as string[])}
                className="flex-wrap justify-start"
              >
                {competitors.map((c) => (
                  <ToggleGroupItem
                    key={c.competitor_id}
                    value={c.competitor_id}
                    className="text-[12px] aria-pressed:bg-primary/15 aria-pressed:text-primary aria-pressed:ring-1 aria-pressed:ring-primary/30"
                  >
                    {c.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel className="text-[12px]">
                时间范围 · 近 {days} 天
              </FieldLabel>
              <div className="flex items-center gap-3 pb-1.5">
                <Slider
                  value={[days]}
                  min={7}
                  max={90}
                  step={1}
                  onValueChange={(v) =>
                    setDays(Array.isArray(v) ? v[0] : (v as number))
                  }
                  className="flex-1"
                />
                <span className="w-10 shrink-0 text-right font-mono text-[12px] tabular-nums">
                  {days}d
                </span>
              </div>
            </Field>

            <Button onClick={generate} disabled={generating || !targets.length} className="rounded-full">
              {generating ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Zap data-icon="inline-start" />
              )}
              {generating ? '生成中…' : '生成 SWOT 报告'}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/50 pt-5 font-mono text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{label}</span>
            <span>domain · {domain}</span>
            <span>window · {days}d</span>
            <span className="ml-auto">swot.generate_report</span>
          </div>
        </CardContent>
      </Card>

      {/* ---- 4 Quadrants ---- */}
      <section className="grid gap-5 lg:grid-cols-2">
        {QUADRANTS.map((q) => {
          const tone = TONE[q.tone]
          const Icon = q.icon
          const items = swotData[q.key]
          const avgConf = items.length
            ? Math.round(
                (items.reduce((s, i) => s + i.confidence, 0) / items.length) * 100,
              )
            : 0
          return (
            <Card
              key={q.key}
              className={cn(
                'card-shadow relative gap-0 overflow-hidden border-0 bg-white py-0 transition-all',
                tone.border,
              )}
            >
              <div className="relative flex items-center gap-3 px-5 py-5">
                <div
                  className={cn(
                    'flex size-9 items-center justify-center rounded-xl ring-1',
                    tone.chip,
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-semibold tracking-tight">
                    {q.title}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {items.length} insights · cited
                  </span>
                </div>
                <span
                  className={cn(
                    'ml-auto rounded-lg px-2 py-1 font-mono text-[10px] font-medium ring-1',
                    tone.chip,
                  )}
                >
                  {avgConf}% avg
                </span>
              </div>

              <Separator className="bg-border/50" />

              <div className="relative flex flex-col">
                {items.map((item, i) => (
                  <SwotRow
                    key={`${q.key}-${i}`}
                    item={item}
                    tone={q.tone}
                    last={i === items.length - 1}
                  />
                ))}
              </div>
            </Card>
          )
        })}
      </section>

      {/* ---- Recommendations — collapsible for progressive disclosure ---- */}
      <Card className="card-shadow border-0 bg-white transition-shadow hover:card-shadow-hover">
        <CardHeader
          className="cursor-pointer border-b border-border/50 pb-5 hover:bg-muted/20"
          onClick={() => setShowRecs(!showRecs)}
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-amber-200">
                <Lightbulb className="size-4 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-[15px] tracking-tight">
                  战略建议
                </CardTitle>
                <CardDescription className="text-[12.5px]">
                  由 SWOT 矩阵推导的可执行产品策略 · {recommendations.length} 条建议
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => { e.stopPropagation(); copyAll(); }}>
                {copied ? (
                  <Check data-icon="inline-start" className="size-3.5" />
                ) : (
                  <Copy data-icon="inline-start" className="size-3.5" />
                )}
                {copied ? '已复制' : '复制'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => e.stopPropagation()}>
                    <Download data-icon="inline-start" className="size-3.5" />
                    导出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast('正在导出 PDF…')}>
                    <FileDown className="size-3.5" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast('正在导出 Markdown…')}>
                    <Download className="size-3.5" />
                    Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); setShowRecs(!showRecs); }}>
                {showRecs ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showRecs && (
          <CardContent className="pt-6">
            <ul className="flex flex-col gap-3">
              {recommendations.map((rec, i) => (
                <li
                  key={rec}
                  className="flex gap-4 rounded-2xl border border-border/50 bg-muted/15 p-5 transition-all hover:border-primary/20 hover:bg-primary/[0.02]"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-[11px] font-medium text-primary ring-1 ring-primary/20">
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed text-foreground/80">
                    {rec}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/* ── SwotRow ── */
function SwotRow({
  item,
  tone,
  last,
}: {
  item: SwotItem
  tone: string
  last: boolean
}) {
  const t = TONE[tone]
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 px-5 py-4 transition-colors hover:bg-muted/20',
        !last && 'border-b border-border/40',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', t.bar)}
        />
        <p className="flex-1 text-[13px] leading-relaxed text-pretty">
          {item.point}
        </p>
        <span
          className={cn(
            'shrink-0 rounded-lg px-1.5 py-0.5 font-mono text-[10px] font-medium ring-1',
            t.chip,
          )}
        >
          {Math.round(item.confidence * 100)}%
        </span>
      </div>
      <div className="flex items-center gap-2 pl-[18px]">
        <CitationTag citation={item.citation} />
        <span className="truncate text-[11px] text-muted-foreground">
          {item.citation.source_title}
        </span>
        <div className="ml-auto hidden w-20 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
          <div
            className={cn('h-[3px] rounded-full', t.bar)}
            style={{ width: `${item.confidence * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
