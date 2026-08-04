'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileStack,
  Globe,
  Link2,
  Loader2,
  MoreHorizontal,
  Play,
  RefreshCw,
  ScrollText,
  Target,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  competitors as seedCompetitors,
  crawlTasks as seedTasks,
  sourceTypes,
  type TaskStatus,
} from '@/lib/mock-data'
import { startCrawl as startCrawlApi } from '@/lib/services/ingestion'
import type { CrawlResponse } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
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
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_META: Record<
  TaskStatus['status'],
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  completed: {
    label: 'Completed',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  processing: {
    label: 'Processing',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
    icon: Loader2,
  },
  failed: {
    label: 'Failed',
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: XCircle,
  },
}

export function IngestionView({ domain }: { domain: string }) {
  const [tasks, setTasks] = useState<TaskStatus[]>(seedTasks)
  const [target, setTarget] = useState('cmp_001')
  const [url, setUrl] = useState('https://deepseek.com/news')
  const [sourceType, setSourceType] =
    useState<TaskStatus['source_type']>('changelog')
  const [crawling, setCrawling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showTaskTable, setShowTaskTable] = useState(true)

  const visibleCompetitors = useMemo(
    () =>
      seedCompetitors.filter(
        (c) => c.category === domain || domain === 'AI Assistant',
      ),
    [domain],
  )

  const stats = useMemo(() => {
    const docs = seedCompetitors.reduce((s, c) => s + c.document_count, 0)
    return {
      targets: seedCompetitors.length,
      docs,
      running: tasks.filter((t) => t.status === 'processing').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    }
  }, [tasks])

  async function startCrawl() {
    if (crawling) return
    const competitor =
      seedCompetitors.find((c) => c.competitor_id === target)?.name ?? 'Unknown'
    setCrawling(true)
    setProgress(6)

    const taskId = `crawl_${String(tasks.length + 1).padStart(3, '0')}`

    try {
      const result: CrawlResponse = await startCrawlApi({
        competitor_id: target,
        url,
        source_type: sourceType,
      })
      setTasks((prev) => [
        {
          task_id: result.task_id,
          competitor,
          source_url: url,
          source_type: sourceType,
          status:
            result.crawl_status === 'failed'
              ? 'failed'
              : result.crawl_status === 'completed'
                ? 'completed'
                : 'processing',
          progress_percentage: 6,
          documents_created: 0,
          error_message: null,
        },
        ...prev,
      ])
      toast.success(`采集任务已提交 · ${competitor}`, {
        description: `${result.task_id} · 预计耗时 ${result.estimated_time}`,
      })
      setCrawling(false)
      setProgress(100)
      return
    } catch {
      // 后端不可用，回退到客户端模拟
    }

    setTasks((prev) => [
      {
        task_id: taskId,
        competitor,
        source_url: url,
        source_type: sourceType,
        status: 'processing',
        progress_percentage: 6,
        documents_created: 0,
        error_message: null,
      },
      ...prev,
    ])

    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + Math.round(6 + Math.random() * 12))
        setTasks((prev) =>
          prev.map((t) =>
            t.task_id === taskId
              ? {
                  ...t,
                  progress_percentage: next,
                  documents_created: Math.round((next / 100) * 31),
                  status: next >= 100 ? 'completed' : 'processing',
                }
              : t,
          ),
        )
        if (next >= 100) {
          clearInterval(timer)
          setCrawling(false)
          toast.success(`采集完成（模拟）· ${competitor}`, {
            description: `${taskId} 已生成 31 个文档片段并写入向量库。`,
          })
        }
        return next
      })
    }, 520)
  }

  function retry(taskId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId
          ? { ...t, status: 'processing', progress_percentage: 12 }
          : t,
      ),
    )
    toast('已重新排队', { description: `${taskId} 正在重试采集。` })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ---- Stat row — compact Apple-style ---- */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="监控目标"
          value={String(stats.targets)}
          caption="active competitors"
          icon={Target}
        />
        <StatTile
          label="文档总量"
          value={stats.docs.toLocaleString('en-US')}
          caption="documents ingested"
          icon={FileStack}
        />
        <StatTile
          label="进行中"
          value={String(stats.running)}
          caption="crawl running"
          icon={Loader2}
          accent="signal"
        />
        <StatTile
          label="失败"
          value={String(stats.failed)}
          caption="need attention"
          icon={XCircle}
          accent="weakness"
        />
      </section>

      {/* ---- Crawl Console ---- */}
      <Card className="gradient-card card-shadow overflow-hidden bg-white transition-shadow hover:card-shadow-hover">
        <CardHeader className="border-b border-border/50 pb-5">
          <CardTitle className="flex items-center gap-2.5 text-[15px] tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="size-4 text-primary" />
            </div>
            采集控制台
          </CardTitle>
          <CardDescription className="text-[12.5px]">
            选择竞品目标、配置来源类型，启动异步爬取任务并写入 ChromaDB 向量库。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FieldGroup className="gap-5">
            <div className="grid gap-5 lg:grid-cols-[220px_1fr_220px]">
              <Field>
                <FieldLabel htmlFor="crawl-target" className="text-[12px]">竞品目标</FieldLabel>
                <Select
                  value={target}
                  onValueChange={(v) => setTarget(v as string)}
                >
                  <SelectTrigger id="crawl-target" className="w-full">
                    <SelectValue>
                      {(value) =>
                        seedCompetitors.find((c) => c.competitor_id === value)
                          ?.name ?? '选择目标'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {seedCompetitors.map((c) => (
                        <SelectItem key={c.competitor_id} value={c.competitor_id}>
                          <span className="flex w-full items-center gap-2">
                            {c.name}
                            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                              {c.competitor_id}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="crawl-url" className="text-[12px]">来源地址</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Link2 className="size-3.5" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="crawl-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://deepseek.com/news"
                    className="font-mono text-[12px]"
                  />
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="crawl-source" className="text-[12px]">来源类型</FieldLabel>
                <Select
                  value={sourceType}
                  onValueChange={(v) =>
                    setSourceType(v as TaskStatus['source_type'])
                  }
                >
                  <SelectTrigger id="crawl-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {sourceTypes.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={startCrawl} disabled={crawling} className="rounded-full">
                {crawling ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Play data-icon="inline-start" />
                )}
                {crawling ? '采集进行中…' : '开始采集'}
              </Button>
              <span className="font-mono text-[11px] text-muted-foreground">
                POST /ingestion.crawl
              </span>
            </div>

            {crawling && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 font-medium text-violet-700">
                    <Loader2 className="size-3.5 animate-spin" />
                    正在解析页面并生成向量嵌入
                  </span>
                  <span className="font-mono text-violet-600">
                    {progress}% · 预计剩余{' '}
                    {Math.max(1, Math.round((100 - progress) / 12))}s
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-200/50">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {/* ---- Competitor Cards ---- */}
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">
              竞品目标卡片
            </h2>
            <p className="text-[12px] text-muted-foreground">
              当前领域 · {domain} · 共 {visibleCompetitors.length} 个目标
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground">
            查看全部
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleCompetitors.map((c) => (
            <Card
              key={c.competitor_id}
              className="card-shadow group gap-0 overflow-hidden bg-white py-0 transition-all hover:card-shadow-hover"
            >
              <div className="flex items-start gap-3 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary ring-1 ring-primary/20">
                  {c.name.slice(0, 1)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold tracking-tight">
                    {c.name}
                  </span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {c.competitor_id}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">目标操作</span>
                      </Button>
                    }
                  />
                  <TooltipContent>编辑采集配置</TooltipContent>
                </Tooltip>
              </div>

              <Separator className="bg-border/50" />

              <div className="flex flex-col gap-3 p-5">
                <Badge
                  variant="secondary"
                  className="w-fit border-0 bg-muted/70 text-[10px] text-muted-foreground"
                >
                  {c.category}
                </Badge>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    最近更新
                  </span>
                  <span className="font-mono text-foreground/80">
                    {c.latest_update}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <FileStack className="size-3.5" />
                    文档数量
                  </span>
                  <span className="font-mono text-foreground/80">
                    {c.document_count}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{
                      width: `${Math.min(100, (c.document_count / 120) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---- Task Log Table — collapsible for progressive disclosure ---- */}
      <Card className="card-shadow overflow-hidden bg-white transition-shadow hover:card-shadow-hover">
        <CardHeader
          className="cursor-pointer border-b border-border/50 pb-5 hover:bg-muted/20"
          onClick={() => setShowTaskTable(!showTaskTable)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <ScrollText className="size-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-[15px] tracking-tight">
                  采集任务与日志
                </CardTitle>
                <CardDescription className="text-[12.5px]">
                  实时追踪任务状态、进度与生成的文档数量 · 共 {tasks.length} 条
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
              {showTaskTable ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>
        </CardHeader>
        {showTaskTable && (
          <CardContent className="px-0 pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="pl-6 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Task ID
                        </TableHead>
                        <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Competitor
                        </TableHead>
                        <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Source URL
                        </TableHead>
                        <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Status
                        </TableHead>
                        <TableHead className="w-[168px] font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Progress
                        </TableHead>
                        <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Docs
                        </TableHead>
                        <TableHead className="pr-6 text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((t) => {
                        const meta = STATUS_META[t.status]
                        const Icon = meta.icon
                        return (
                          <TableRow key={t.task_id} className="border-border/40">
                            <TableCell className="pl-6 font-mono text-[12px] text-foreground/85">
                              {t.task_id}
                            </TableCell>
                            <TableCell className="text-[13px] font-medium">
                              {t.competitor}
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <div className="flex flex-col gap-0.5">
                                <span className="truncate font-mono text-[11px] text-muted-foreground">
                                  {t.source_url}
                                </span>
                                <span className="font-mono text-[10px] text-primary/70">
                                  {t.source_type}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn('gap-1.5 border-0 text-[10px] font-medium', meta.className)}
                              >
                                <Icon
                                  className={cn(
                                    'size-3',
                                    t.status === 'processing' && 'animate-spin',
                                  )}
                                />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-[width] duration-500',
                                      t.status === 'failed'
                                        ? 'bg-red-400'
                                        : t.status === 'completed'
                                          ? 'bg-emerald-400'
                                          : 'bg-violet-400',
                                    )}
                                    style={{ width: `${t.progress_percentage}%` }}
                                  />
                                </div>
                                <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                                  {t.progress_percentage}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-[12px]">
                              {t.documents_created}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              {t.status === 'failed' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-full text-[11px]"
                                  onClick={() => retry(t.task_id)}
                                >
                                  <RefreshCw data-icon="inline-start" />
                                  重试
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[11px] text-muted-foreground"
                                  onClick={() =>
                                    toast(`日志 · ${t.task_id}`, {
                                      description: `${t.source_type} → ${t.documents_created} docs · ${t.progress_percentage}%`,
                                    })
                                  }
                                >
                                  查看日志
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
      </Card>
    </div>
  )
}

/* ── StatTile ── */
function StatTile({
  label,
  value,
  caption,
  icon: Icon,
  accent = 'primary',
}: {
  label: string
  value: string
  caption: string
  icon: React.ComponentType<{ className?: string }>
  accent?: 'primary' | 'signal' | 'weakness'
}) {
  const accentClass = {
    primary: 'text-primary bg-primary/10 ring-primary/20',
    signal: 'text-violet-600 bg-violet-50 ring-violet-200',
    weakness: 'text-red-500 bg-red-50 ring-red-200',
  }[accent]

  return (
    <Card className="card-shadow stat-accent gap-0 bg-white py-0 transition-shadow hover:card-shadow-hover">
      <div className="flex items-start gap-3 p-5">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1',
            accentClass,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <span className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          <span className="truncate font-mono text-[10px] text-muted-foreground/70">
            {caption}
          </span>
        </div>
      </div>
    </Card>
  )
}
