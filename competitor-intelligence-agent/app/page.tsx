'use client'

import { useState } from 'react'

import { AppShell, type TabKey } from '@/components/app-shell'
import { IngestionView } from '@/components/ingestion-view'
import { KnowledgeView } from '@/components/knowledge-view'
import { SwotView } from '@/components/swot-view'
import { EvaluationView } from '@/components/evaluation-view'

export default function Page() {
  const [tab, setTab] = useState<TabKey>('ingestion')
  const [domain, setDomain] = useState('AI Assistant')

  return (
    <AppShell
      active={tab}
      onChange={setTab}
      domain={domain}
      onDomainChange={setDomain}
    >
      {tab === 'ingestion' && <IngestionView domain={domain} />}
      {tab === 'knowledge' && <KnowledgeView />}
      {tab === 'swot' && <SwotView domain={domain} />}
      {tab === 'evaluation' && <EvaluationView />}
    </AppShell>
  )
}
