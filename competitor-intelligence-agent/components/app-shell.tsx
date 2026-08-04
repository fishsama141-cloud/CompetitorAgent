'use client'

import { useState } from 'react'
import type * as React from 'react'
import {
  KeyRound,
  Plus,
  Radar,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { domains } from '@/lib/mock-data'

export type TabKey = 'ingestion' | 'knowledge' | 'swot' | 'evaluation'

const NAV: {
  key: TabKey
  label: string
}[] = [
  { key: 'ingestion', label: '数据采集' },
  { key: 'knowledge', label: '知识库&RAG' },
  { key: 'swot', label: 'SWOT分析' },
  { key: 'evaluation', label: '质量评估' },
]

export function AppShell({
  active,
  onChange,
  domain,
  onDomainChange,
  children,
}: {
  active: TabKey
  onChange: (key: TabKey) => void
  domain: string
  onDomainChange: (value: string) => void
  children: React.ReactNode
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')

  function handleAdd() {
    if (!newName.trim()) return
    toast.success(`竞品「${newName.trim()}」已加入监控列表`, {
      description: newUrl.trim()
        ? `来源：${newUrl.trim()}`
        : '请配置采集来源以开始抓取',
    })
    setNewName('')
    setNewUrl('')
    setAddOpen(false)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ================================================================
          Top Navigation — Apple-style frosted glass
          ================================================================ */}
      <header className="glass-surface sticky top-0 z-30 border-b border-border/50">
        <div className="flex h-14 items-center gap-4 px-6 lg:gap-8 lg:px-10">
          {/* ---- Logo ---- */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Radar className="size-[18px] text-primary" />
            </div>
            <div className="hidden flex-col leading-none sm:flex">
              <span className="text-[14px] font-semibold tracking-tight text-foreground">
                Competitor Intel
              </span>
              <span className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground/70 uppercase">
                Agent v2.4
              </span>
            </div>
          </div>

          {/* ---- Center Tabs — Apple-style underline indicator ---- */}
          <nav className="flex flex-1 items-center justify-center gap-0.5" role="tablist">
            {NAV.map((item) => {
              const isActive = active === item.key
              return (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onChange(item.key)}
                  className={cn(
                    'relative px-4 py-3.5 text-[13px] font-medium tracking-tight transition-colors lg:px-6',
                    'hover:text-foreground',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                  {/* Apple-style bottom indicator bar */}
                  {isActive && (
                    <span className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full bg-primary lg:inset-x-5" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* ---- Right Side ---- */}
          <div className="flex shrink-0 items-center gap-3">
            {/* Domain Selector */}
            <Select value={domain} onValueChange={(v) => onDomainChange(v as string)}>
              <SelectTrigger
                className="h-8 w-[128px] border-0 bg-muted/60 text-[12px] shadow-none hover:bg-muted lg:w-[148px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {domains.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* API Key indicator — green dot + label */}
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-200/60 lg:flex">
              <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              <span className="font-mono text-[10px] font-medium text-emerald-700">
                Connected
              </span>
            </div>

            {/* Add Competitor */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-[12px] font-medium text-primary hover:bg-primary/10"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">添加竞品</span>
            </Button>

            {/* User Avatar */}
            <Avatar className="size-7 rounded-full ring-2 ring-border/50">
              <AvatarFallback className="rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                林
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* ================================================================
          Main Content — generous Apple-style spacing
          ================================================================ */}
      <main className="relative flex-1">
        <div className="relative px-5 py-8 lg:px-12 lg:py-12">
          {children}
        </div>
      </main>

      {/* ================================================================
          Footer — minimal, clean
          ================================================================ */}
      <footer className="border-t border-border/50 bg-white px-5 py-4 lg:px-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3 text-primary/50" />
            Competitor Intelligence Agent
          </span>
          <span>ChromaDB · text-embedding-3-small</span>
          <span className="ml-auto">Last sync 2026-08-04 09:12</span>
        </div>
      </footer>

      {/* ================================================================
          Add Competitor Dialog
          ================================================================ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加竞品</DialogTitle>
            <DialogDescription>
              输入竞品名称与官方地址，即可加入监控列表并启动数据采集。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-name" className="text-[12px]">
                竞品名称
              </Label>
              <Input
                id="add-name"
                placeholder="例如：DeepSeek"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    handleAdd()
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-url" className="text-[12px]">
                官方地址 <span className="text-muted-foreground">(选填)</span>
              </Label>
              <Input
                id="add-url"
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    handleAdd()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>
              确认添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
