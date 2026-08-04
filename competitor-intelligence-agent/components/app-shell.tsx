'use client'

import type * as React from 'react'
import {
  Radar,
  Sparkles,
} from 'lucide-react'

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
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* ================================================================
          Top Navigation — Dark pill-style (agency-os inspired)
          ================================================================ */}
      <header className="glass-header sticky top-0 z-30 border-b border-white/10">
        <div className="flex h-14 items-center gap-4 px-6 lg:gap-8 lg:px-10">
          {/* ---- Logo ---- */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20">
              <Radar className="size-[18px] text-primary-foreground" />
            </div>
            <div className="hidden flex-col leading-none sm:flex">
              <span className="text-[14px] font-semibold tracking-tight text-white">
                Competitor Intel
              </span>
              <span className="font-mono text-[9px] tracking-[0.18em] text-white/40 uppercase">
                Agent v2.4
              </span>
            </div>
          </div>

          {/* ---- Center Tabs ---- */}
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
                    'hover:text-white',
                    isActive
                      ? 'text-white'
                      : 'text-white/50',
                  )}
                >
                  {item.label}
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
                className="h-8 w-[128px] border-white/15 bg-white/10 text-[12px] text-white/80 shadow-none hover:bg-white/15 lg:w-[148px]"
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
            <div className="hidden items-center gap-2 rounded-full bg-emerald-500/15 px-2.5 py-1 ring-1 ring-emerald-400/30 lg:flex">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="font-mono text-[10px] font-medium text-emerald-300">
                Connected
              </span>
            </div>

            {/* User Avatar */}
            <Avatar className="size-7 rounded-full ring-2 ring-white/20">
              <AvatarFallback className="rounded-full bg-primary/30 text-[11px] font-medium text-white">
                林
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* ================================================================
          Main Content — generous spacing with subtle gradient depth
          ================================================================ */}
      <main className="relative flex-1">
        <div className="relative px-5 py-8 lg:px-12 lg:py-12">
          {children}
        </div>
      </main>

      {/* ================================================================
          Footer — subtle violet-tinted surface
          ================================================================ */}
      <footer className="border-t border-border bg-surface/60 px-5 py-4 lg:px-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3 text-primary/60" />
            Competitor Intelligence Agent
          </span>
          <span>ChromaDB · text-embedding-3-small</span>
          <span className="ml-auto">Last sync 2026-08-04 09:12</span>
        </div>
      </footer>

    </div>
  )
}
