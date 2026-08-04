'use client'

import { useMemo, useState } from 'react'
import {
  CalendarClock, CheckCircle2, FileStack, Globe, Link2,
  Loader2, MoreHorizontal, Play, RefreshCw, ScrollText,
  Target, XCircle, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  competitors as seedCompetitors, crawlTasks as seedTasks,
  sourceTypes, type TaskStatus,
} from '@/lib/mock-data'
import { startCrawl as startCrawlApi } from '@/lib/services/ingestion'
import type { CrawlResponse } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useReveal } from '@/hooks/use-reveal'

const STATUS_META: Record<TaskStatus['status'], { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  completed: { label: 'Completed', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  processing: { label: 'Processing', className: 'border-sky-200 bg-sky-50 text-sky-700', icon: Loader2 },
  failed: { label: 'Failed', className: 'border-red-200 bg-red-50 text-red-700', icon: XCircle },
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-3.5 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

export function IngestionView({ domain }: { domain: string }) {
  const [tasks, setTasks] = useState<TaskStatus[]>(seedTasks)
  const [target, setTarget] = useState('cmp_001')
  const [url, setUrl] = useState('https://deepseek.com/news')
  const [sourceType, setSourceType] = useState<TaskStatus['source_type']>('changelog')
  const [crawling, setCrawling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showTaskTable, setShowTaskTable] = useState(true)
  const heroRef = useReveal()
  const statsRef = useReveal()
  const consoleRef = useReveal()
  const cardsRef = useReveal()
  const logRef = useReveal()

  const visibleCompetitors = useMemo(
    () => seedCompetitors.filter((c) => c.category === domain || domain === 'AI Assistant'),
    [domain],
  )
  const stats = useMemo(() => {
    const docs = seedCompetitors.reduce((s, c) => s + c.document_count, 0)
    return { targets: seedCompetitors.length, docs, running: tasks.filter((t) => t.status === 'processing').length, failed: tasks.filter((t) => t.status === 'failed').length }
  }, [tasks])

  async function startCrawl() {
    if (crawling) return
    const competitor = seedCompetitors.find((c) => c.competitor_id === target)?.name ?? 'Unknown'
    setCrawling(true); setProgress(6)
    const taskId = `crawl_${String(tasks.length + 1).padStart(3, '0')}`
    try {
      const result: CrawlResponse = await startCrawlApi({ competitor_id: target, url, source_type: sourceType })
      setTasks((prev) => [{ task_id: result.task_id, competitor, source_url: url, source_type: sourceType, status: result.crawl_status === 'failed' ? 'failed' : result.crawl_status === 'completed' ? 'completed' : 'processing', progress_percentage: 6, documents_created: 0, error_message: null }, ...prev])
      toast.success(`采集任务已提交 · ${competitor}`, { description: `${result.task_id}` })
      setCrawling(false); setProgress(100); return
    } catch { /* mock fallback */ }
    setTasks((prev) => [{ task_id: taskId, competitor, source_url: url, source_type: sourceType, status: 'processing', progress_percentage: 6, documents_created: 0, error_message: null }, ...prev])
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + Math.round(6 + Math.random() * 12))
        setTasks((prev) => prev.map((t) => t.task_id === taskId ? { ...t, progress_percentage: next, documents_created: Math.round((next / 100) * 31), status: next >= 100 ? 'completed' : 'processing' } : t))
        if (next >= 100) { clearInterval(timer); setCrawling(false); toast.success(`采集完成 · ${competitor}`) }
        return next
      })
    }, 520)
  }

  function retry(taskId: string) {
    setTasks((prev) => prev.map((t) => t.task_id === taskId ? { ...t, status: 'processing', progress_percentage: 12 } : t))
    toast('已重新排队')
  }

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section ref={heroRef} className="reveal relative overflow-hidden rounded-3xl section-hero px-6 py-12 lg:px-12 lg:py-16">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-primary/70 uppercase">Data Pipeline</span>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight lg:text-5xl">数据采集</h1>
            <p className="max-w-lg text-[14px] leading-relaxed text-muted-foreground">
              自动化竞品数据采集与向量化入库。选择目标、配置来源，一键将非结构化数据转化为可检索的知识片段。
            </p>
          </div>
          <Button onClick={startCrawl} disabled={crawling} size="lg" className="btn-press rounded-full">
            {crawling ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            {crawling ? '采集中…' : '开始采集'}
          </Button>
        </div>
      </section>

      {/* STATS */}
      <section ref={statsRef} className="reveal-stagger mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="监控目标" value={String(stats.targets)} caption="活跃竞品" icon={Target} />
        <StatTile label="文档总量" value={stats.docs.toLocaleString('en-US')} caption="已入库片段" icon={FileStack} />
        <StatTile label="进行中" value={String(stats.running)} caption="采集任务" icon={Loader2} accent="signal" />
        <StatTile label="失败" value={String(stats.failed)} caption="需关注" icon={XCircle} accent="weakness" />
      </section>

      {/* CONSOLE */}
      <section ref={consoleRef} className="reveal mt-8">
        <div className="mb-4"><SectionHeader icon={Globe} title="采集控制台" description="配置来源并启动异步爬取任务" /></div>
        <Card className="card-shadow card-lift bg-white">
          <CardContent className="pt-6">
            <FieldGroup className="gap-5">
              <div className="grid gap-5 lg:grid-cols-[220px_1fr_220px]">
                <Field>
                  <FieldLabel htmlFor="crawl-target" className="text-[12px]">竞品目标</FieldLabel>
                  <Select value={target} onValueChange={(v) => setTarget(v as string)}>
                    <SelectTrigger id="crawl-target" className="w-full">
                      <SelectValue>{(value) => seedCompetitors.find((c) => c.competitor_id === value)?.name ?? '选择'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent><SelectGroup>{seedCompetitors.map((c) => (<SelectItem key={c.competitor_id} value={c.competitor_id}>{c.name}</SelectItem>))}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="crawl-url" className="text-[12px]">来源地址</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon><Link2 className="size-3.5" /></InputGroupAddon>
                    <InputGroupInput id="crawl-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="font-mono text-[12px]" />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="crawl-source" className="text-[12px]">来源类型</FieldLabel>
                  <Select value={sourceType} onValueChange={(v) => setSourceType(v as TaskStatus['source_type'])}>
                    <SelectTrigger id="crawl-source" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{sourceTypes.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectGroup></SelectContent>
                  </Select>
                </Field>
              </div>
              {crawling && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 font-medium text-sky-700"><Loader2 className="size-3.5 animate-spin" />正在解析页面并生成向量嵌入</span>
                    <span className="font-mono text-sky-600">{progress}% · 预计剩余 {Math.max(1, Math.round((100 - progress) / 12))}s</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-200/50">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      </section>

      {/* COMPETITORS */}
      <section ref={cardsRef} className="reveal mt-8">
        <div className="mb-4 flex items-end justify-between">
          <SectionHeader icon={Target} title="监控目标" description={`${domain} · ${visibleCompetitors.length} 个目标`} />
          <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground">查看全部<ArrowRight data-icon="inline-end" /></Button>
        </div>
        <div className="reveal-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleCompetitors.map((c) => (
            <Card key={c.competitor_id} className="card-shadow card-lift reveal group gap-0 bg-white py-0">
              <div className="flex items-start gap-3 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">{c.name.slice(0, 1)}</div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold tracking-tight">{c.name}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">{c.competitor_id}</span>
                </div>
                <Tooltip>
                  <TooltipTrigger render={<Button variant="ghost" size="icon-sm" className="opacity-0 transition-opacity group-hover:opacity-100"><MoreHorizontal className="size-4" /></Button>} />
                  <TooltipContent>编辑采集配置</TooltipContent>
                </Tooltip>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 p-5">
                <Badge variant="secondary" className="w-fit border-0 bg-muted text-[10px] text-muted-foreground">{c.category}</Badge>
                <div className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="size-3.5" />最近更新</span><span className="font-mono">{c.latest_update}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-1.5 text-muted-foreground"><FileStack className="size-3.5" />文档数量</span><span className="font-mono">{c.document_count}</span></div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, (c.document_count / 120) * 100)}%` }} /></div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* TASK LOG */}
      <section ref={logRef} className="reveal mt-8">
        <Card className="card-shadow bg-white">
          <CardHeader className="cursor-pointer border-b border-border/50 pb-5 hover:bg-muted/30 transition-colors" onClick={() => setShowTaskTable(!showTaskTable)}>
            <div className="flex items-center justify-between">
              <SectionHeader icon={ScrollText} title="采集任务与日志" description={`实时追踪 · ${tasks.length} 条`} />
              <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">{showTaskTable ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</Button>
            </div>
          </CardHeader>
          {showTaskTable && (
            <CardContent className="px-0 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="pl-6 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Task ID</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Competitor</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Source</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Status</TableHead>
                      <TableHead className="w-[168px] font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Progress</TableHead>
                      <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Docs</TableHead>
                      <TableHead className="pr-6 text-right font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t) => {
                      const meta = STATUS_META[t.status]; const Icon = meta.icon
                      return (
                        <TableRow key={t.task_id} className="border-border/40 transition-colors hover:bg-muted/20">
                          <TableCell className="pl-6 font-mono text-[12px]">{t.task_id}</TableCell>
                          <TableCell className="text-[13px] font-medium">{t.competitor}</TableCell>
                          <TableCell className="max-w-[260px]"><div className="flex flex-col gap-0.5"><span className="truncate font-mono text-[11px] text-muted-foreground">{t.source_url}</span><span className="font-mono text-[10px] text-primary/70">{t.source_type}</span></div></TableCell>
                          <TableCell><Badge variant="secondary" className={cn('gap-1.5 border-0 text-[10px] font-medium', meta.className)}><Icon className={cn('size-3', t.status === 'processing' && 'animate-spin')} />{meta.label}</Badge></TableCell>
                          <TableCell><div className="flex items-center gap-2"><div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-[width] duration-500', t.status === 'failed' ? 'bg-red-400' : t.status === 'completed' ? 'bg-emerald-400' : 'bg-primary')} style={{ width: `${t.progress_percentage}%` }} /></div><span className="w-9 text-right font-mono text-[11px] text-muted-foreground">{t.progress_percentage}%</span></div></TableCell>
                          <TableCell className="text-right font-mono text-[12px]">{t.documents_created}</TableCell>
                          <TableCell className="pr-6 text-right">{t.status === 'failed' ? <Button variant="outline" size="sm" className="h-7 rounded-full text-[11px]" onClick={() => retry(t.task_id)}><RefreshCw data-icon="inline-start" />重试</Button> : <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={() => toast(`日志 · ${t.task_id}`, { description: `${t.source_type} → ${t.documents_created} docs` })}>查看日志</Button>}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      </section>
    </div>
  )
}

function StatTile({ label, value, caption, icon: Icon, accent = 'primary' }: { label: string; value: string; caption: string; icon: React.ComponentType<{ className?: string }>; accent?: 'primary' | 'signal' | 'weakness' }) {
  const accentClass = { primary: 'text-primary bg-primary/10', signal: 'text-sky-600 bg-sky-50', weakness: 'text-red-500 bg-red-50' }[accent]
  return (
    <div className="reveal card-lift flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/5 transition-all hover:ring-black/10">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', accentClass)}><Icon className="size-5" /></div>
      <div className="flex min-w-0 flex-col"><span className="text-[11px] text-muted-foreground">{label}</span><span className="text-[26px] leading-tight font-bold tracking-tight tabular-nums">{value}</span><span className="truncate font-mono text-[10px] text-muted-foreground">{caption}</span></div>
    </div>
  )
}
