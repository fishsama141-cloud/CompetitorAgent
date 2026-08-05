'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, FileStack, Globe,
  Loader2, Play, RefreshCw, XCircle, Plus,
  ChevronRight, History, Settings2, Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sourceTypes } from '@/lib/mock-data'
import type { TaskStatusWithMeta as TaskStatus } from '@/lib/types'
import { startCrawl as startCrawlApi, getTaskStatus } from '@/lib/services/ingestion'
import { listCompetitors, createCompetitor } from '@/lib/services/competitor'
import type { Competitor, CrawlResponse } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReveal } from '@/hooks/use-reveal'

/* ─────────────────────────────────────────────
   Status badge config
   ───────────────────────────────────────────── */
const STATUS_META: Record<TaskStatus['status'], { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  completed: { label: '已完成', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  processing: { label: '采集中', className: 'bg-sky-50 text-sky-700 border-sky-200', icon: Loader2 },
  failed: { label: '失败', className: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
}

/* ─────────────────────────────────────────────
   Main View
   ───────────────────────────────────────────── */
export function IngestionView({ domain }: { domain: string }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loadingComp, setLoadingComp] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newCategory, setNewCategory] = useState('AI Assistant')
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskStatus[]>([])
  const [crawling, setCrawling] = useState(false)
  const [progress, setProgress] = useState(0)
  const heroRef = useReveal()

  // ── Fetch real competitors from the backend ────────────────
  const refreshCompetitors = useCallback(async () => {
    try {
      const data = await listCompetitors()
      setCompetitors(data)
    } catch {
      // API unavailable — start empty
      setCompetitors([])
    } finally {
      setLoadingComp(false)
    }
  }, [])

  useEffect(() => {
    refreshCompetitors()
  }, [refreshCompetitors])

  const visibleCompetitors = useMemo(
    () => competitors.filter((c) => c.category === domain || domain === 'AI Assistant'),
    [competitors, domain],
  )

  const selected = useMemo(
    () => competitors.find((c) => c.competitor_id === selectedId),
    [competitors, selectedId],
  )

  const selectedTasks = useMemo(
    () => tasks.filter((t) => t.competitor === selected?.name),
    [tasks, selected],
  )

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) return
    setAdding(true)
    try {
      await createCompetitor({
        name: newName.trim(),
        category: newCategory,
        official_url: newUrl.trim(),
        description: newDesc.trim() || newName.trim(),
      })
      toast.success(`竞品「${newName.trim()}」已加入监控列表`)
      setNewName(''); setNewUrl(''); setNewDesc(''); setAddOpen(false)
      await refreshCompetitors()
    } catch (err: any) {
      toast.error('添加失败', { description: err?.message ?? '请确认后端服务已启动' })
    } finally {
      setAdding(false)
    }
  }

  async function handleCrawl(targetId: string) {
    if (crawling) return
    const comp = competitors.find((c) => c.competitor_id === targetId)
    if (!comp) return
    const url = comp.official_url
    setCrawling(true); setProgress(0)
    try {
      const result: CrawlResponse = await startCrawlApi({
        competitor_id: targetId,
        url,
        source_type: 'changelog',
      })
      const taskId = result.task_id
      setTasks((prev) => [{
        task_id: taskId, competitor: comp.name,
        source_url: url,
        source_type: 'changelog' as const, status: 'processing' as const,
        progress_percentage: 10, documents_created: 0, error_message: null,
      }, ...prev])
      toast.success(`采集已启动 · ${comp.name}`)

      // Poll real task status every 1s
      const timer = setInterval(async () => {
        try {
          const status = await getTaskStatus(taskId)
          setTasks((prev) => prev.map((t) =>
            t.task_id === taskId
              ? { ...t, status: status.status, progress_percentage: status.progress_percentage, documents_created: status.documents_created, error_message: status.error_message }
              : t
          ))
          setProgress(status.progress_percentage)
          if (status.status === 'completed') {
            clearInterval(timer); setCrawling(false)
            toast.success(`采集完成 · ${comp.name}`, { description: `已入库 ${status.documents_created} 个片段` })
            await refreshCompetitors()
          } else if (status.status === 'failed') {
            clearInterval(timer); setCrawling(false)
            const msg =
              typeof status.error_message === 'string'
                ? status.error_message
                : status.error_message
                  ? JSON.stringify(status.error_message)
                  : '未知错误'
            toast.error(`采集失败 · ${comp.name}`, { description: msg })
          }
        } catch {
          // polling error — keep going
        }
      }, 1000)
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : (err ? String(err) : '请确认后端服务已启动且目标 URL 可访问')
      toast.error('采集启动失败', { description: msg })
      setCrawling(false); setProgress(0)
    }
  }

  return (
    <div className="flex flex-col">
      {/* ================================================================
          HERO — Apple-style: massive type, single sentence, one CTA
          ================================================================ */}
      <motion.section
        ref={heroRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-start gap-8 py-16 lg:py-24"
      >
        <span className="font-mono text-[11px] font-medium tracking-[0.2em] text-primary/60 uppercase">
          Data Pipeline
        </span>
        <h1 className="max-w-2xl text-[40px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[56px]">
          竞品数据采集，
          <br />
          <span className="text-primary">一键向量化入库。</span>
        </h1>
        <p className="max-w-lg text-[17px] leading-relaxed text-muted-foreground">
          {loadingComp
            ? '正在加载监控列表…'
            : competitors.length === 0
              ? '你还没有添加任何竞品。点击下方按钮添加第一个监控目标，开始采集竞品情报数据。'
              : '选择目标竞品，配置采集来源，自动将非结构化数据转化为可检索的知识片段。'}
        </p>
        <Button
          size="lg"
          className="btn-press mt-2 rounded-full px-8 text-[15px]"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          添加新竞品
        </Button>
      </motion.section>

      {/* ================================================================
          COMPETITOR GRID — cards as the primary UI element
          ================================================================ */}
      <section className="py-8 lg:py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase">
              Monitored Targets
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.01em]">监控目标</h2>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {visibleCompetitors.length} competitors · {domain}
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {visibleCompetitors.map((c, i) => (
            <CompetitorCard
              key={c.competitor_id}
              competitor={c}
              index={i}
              isSelected={selectedId === c.competitor_id}
              onSelect={() => setSelectedId(selectedId === c.competitor_id ? null : c.competitor_id)}
              onCrawl={(e) => { e.stopPropagation(); handleCrawl(c.competitor_id) }}
              crawling={crawling}
            />
          ))}
        </div>
      </section>

      {/* ================================================================
          SLIDE-OVER SHEET — all functional details in a drawer
          ================================================================ */}
      <AnimatePresence>
        {selectedId && selected && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setSelectedId(null)}
            />
            {/* Sheet */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-white shadow-2xl"
            >
              <SheetContent
                competitor={selected}
                tasks={selectedTasks}
                onClose={() => setSelectedId(null)}
                onCrawl={() => handleCrawl(selected.competitor_id!)}
                crawling={crawling}
                progress={progress}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================================================================
          ADD DIALOG — real API call
          ================================================================ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加竞品</DialogTitle>
            <DialogDescription>
              输入竞品名称与官方地址，加入监控列表并启动数据采集。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-name" className="text-[12px]">竞品名称 <span className="text-red-400">*</span></Label>
              <Input
                id="add-name"
                placeholder="例如：DeepSeek"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd() }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-url" className="text-[12px]">官方地址 <span className="text-red-400">*</span></Label>
              <Input id="add-url" placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-category" className="text-[12px]">分类</Label>
              <Input id="add-category" placeholder="AI Assistant" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-desc" className="text-[12px]">简介 <span className="text-muted-foreground">(选填)</span></Label>
              <Input id="add-desc" placeholder="一句话描述该竞品" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || !newUrl.trim() || adding}>
              {adding ? <Loader2 className="size-4 animate-spin" /> : null}
              {adding ? '添加中…' : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Competitor Card — Apple-style
   ───────────────────────────────────────────── */
function CompetitorCard({
  competitor,
  index,
  isSelected,
  onSelect,
  onCrawl,
  crawling,
}: {
  competitor: Competitor
  index: number
  isSelected: boolean
  onSelect: () => void
  onCrawl: (e: React.MouseEvent) => void
  crawling: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-3xl bg-white p-6 transition-shadow duration-500',
        'ring-1 ring-black/5 hover:ring-black/10',
        isSelected && 'ring-primary/40 ring-2',
      )}
    >
      {/* Hover lift */}
      <motion.div
        animate={{ y: hovered ? -4 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex flex-col gap-5"
      >
        {/* Top: avatar + name */}
        <div className="flex items-start justify-between">
          <motion.div
            animate={{ scale: hovered ? 1.05 : 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary"
          >
            {competitor.name.slice(0, 1)}
          </motion.div>
          <motion.div
            animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : 8 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="size-4 text-muted-foreground/40" />
          </motion.div>
        </div>

        {/* Name + ID */}
        <div>
          <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{competitor.name}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{competitor.competitor_id}</p>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="border-0 bg-muted text-[10px] font-normal text-muted-foreground">
            {competitor.category}
          </Badge>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {competitor.document_count} docs
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            · {competitor.latest_update}
          </span>
        </div>

        {/* Hover action bar */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="flex gap-2"
            >
              <Button
                variant="secondary"
                size="sm"
                className="btn-press h-8 rounded-full text-[12px]"
                onClick={onCrawl}
                disabled={crawling}
              >
                {crawling ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                立即采集
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-[12px] text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); onSelect() }}
              >
                <History className="size-3" />
                查看日志
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Sheet Content — crawl config + logs inside drawer
   ───────────────────────────────────────────── */
function SheetContent({
  competitor,
  tasks,
  onClose,
  onCrawl,
  crawling,
  progress,
}: {
  competitor: Competitor
  tasks: TaskStatus[]
  onClose: () => void
  onCrawl: () => void
  crawling: boolean
  progress: number
}) {
  return (
    <>
      {/* Sheet header */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
            {competitor.name.slice(0, 1)}
          </div>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{competitor.name}</h2>
            <p className="font-mono text-[11px] text-muted-foreground">{competitor.competitor_id} · {competitor.category}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={onClose}>
          <XCircle className="size-5" />
        </Button>
      </div>

      {/* Sheet body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-col gap-8">
          {/* Quick crawl */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">快速采集</h3>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-[12px]">
                <Globe className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">https://{competitor.name.toLowerCase()}.com/news</span>
              </div>
              <div className="flex items-center gap-3">
                <Select defaultValue="changelog">
                  <SelectTrigger className="h-8 w-[140px] text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {sourceTypes.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button size="sm" className="btn-press rounded-full" onClick={onCrawl} disabled={crawling}>
                  {crawling ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  {crawling ? '采集中…' : '开始采集'}
                </Button>
              </div>
              {crawling && (
                <div className="mt-1">
                  <div className="flex items-center justify-between text-[11px] text-sky-600">
                    <span>正在采集…</span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Task log for this competitor */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">采集日志</h3>
              <span className="font-mono text-[11px] text-muted-foreground">{tasks.length} 条</span>
            </div>

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 bg-muted/10 py-12 text-center">
                <Activity className="size-8 text-muted-foreground/30" />
                <p className="text-[13px] text-muted-foreground">暂无采集记录</p>
                <p className="text-[11px] text-muted-foreground/60">点击上方"开始采集"启动首次抓取</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tasks.map((t) => {
                  const meta = STATUS_META[t.status]
                  const Icon = meta.icon
                  return (
                    <motion.div
                      key={t.task_id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col gap-3 rounded-xl border border-border/50 bg-white p-4 transition-shadow hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-muted-foreground">{t.task_id}</span>
                        <Badge variant="outline" className={cn('gap-1 border text-[10px] font-medium', meta.className)}>
                          <Icon className={cn('size-3', t.status === 'processing' && 'animate-spin')} />
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', t.status === 'failed' ? 'bg-red-400' : t.status === 'completed' ? 'bg-emerald-400' : 'bg-primary')}
                            style={{ width: `${t.progress_percentage}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{t.progress_percentage}%</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <FileStack className="size-3" />
                          {t.documents_created} 文档
                        </span>
                        {t.status === 'failed' && (
                          <Button variant="ghost" size="sm" className="h-6 rounded-full text-[11px] text-primary">
                            <RefreshCw className="size-3" />重试
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
