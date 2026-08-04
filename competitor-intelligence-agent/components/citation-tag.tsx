'use client'

import { FileText, Quote } from 'lucide-react'

import type { Citation } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export function CitationTag({
  citation,
  className,
  superscript = false,
}: {
  citation: Citation
  className?: string
  superscript?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`查看引用 ${citation.chunk_id}`}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-md border border-sky-200 bg-sky-50 font-mono text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              superscript
                ? 'mx-[1px] translate-y-[-1px] px-1 py-0 text-[9px] leading-[1.5] align-middle'
                : 'px-1.5 py-0.5 text-[10px]',
              className,
            )}
          >
            <Quote className={superscript ? 'size-2' : 'size-2.5'} />
            {citation.chunk_id}
          </button>
        }
      />
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border/50 px-3.5 py-2.5">
          <FileText className="size-3.5 text-sky-500" />
          <span className="truncate text-[12px] font-medium">
            {citation.source_title}
          </span>
          <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {citation.chunk_id}
          </span>
        </div>
        <div className="px-3.5 py-3">
          <p className="border-l-2 border-sky-200 pl-3 text-[12px] leading-relaxed text-muted-foreground">
            {citation.raw_text_snippet}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
