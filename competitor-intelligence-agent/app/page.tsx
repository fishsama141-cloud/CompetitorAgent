'use client'

import { useCallback, useState } from 'react'

import { AppShell, type TabKey } from '@/components/app-shell'
import { IngestionView } from '@/components/ingestion-view'
import { KnowledgeView } from '@/components/knowledge-view'
import { SwotView } from '@/components/swot-view'
import { EvaluationView } from '@/components/evaluation-view'
import { LoginDialog } from '@/components/login-dialog'
import { useAuth } from '@/hooks/use-auth'

export default function Page() {
  const { user, isLoading, logout } = useAuth()
  const [tab, setTab] = useState<TabKey>('ingestion')
  const [domain, setDomain] = useState('AI Assistant')
  const [loginOpen, setLoginOpen] = useState(false)

  const showLogin = useCallback(() => setLoginOpen(true), [])
  const hideLogin = useCallback(() => setLoginOpen(false), [])

  // Show nothing while validating stored token
  if (isLoading) return null

  return (
    <>
      <AppShell
        active={tab}
        onChange={setTab}
        domain={domain}
        onDomainChange={setDomain}
        user={user}
        onLogin={showLogin}
        onLogout={logout}
      >
        {user ? (
          <>
            {tab === 'ingestion' && <IngestionView domain={domain} onNavigate={setTab} />}
            {tab === 'knowledge' && <KnowledgeView />}
            {tab === 'swot' && <SwotView domain={domain} />}
            {tab === 'evaluation' && <EvaluationView />}
          </>
        ) : (
          /* Unauthenticated: show a premium landing-style prompt */
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-[15px] text-muted-foreground">
              请先登录以访问竞品情报平台
            </p>
            <button
              onClick={showLogin}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-8 text-[14px] font-semibold text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              登录 / 注册
            </button>
          </div>
        )}
      </AppShell>

      <LoginDialog open={loginOpen} onClose={hideLogin} />
    </>
  )
}
