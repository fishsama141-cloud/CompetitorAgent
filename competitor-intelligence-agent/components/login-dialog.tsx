'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { KeyRound, Loader2, LogIn, Radar, Sparkles, UserPlus, X } from 'lucide-react'
import { useCallback, useState, type FormEvent } from 'react'

import { useAuth } from '@/hooks/use-auth'

// ── Types ────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

type Mode = 'login' | 'register'

// ── Component ────────────────────────────────────────────────

export function LoginDialog({ open, onClose }: Props) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = useCallback(() => {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setError('')
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError('')

      if (!username.trim() || !password.trim()) {
        setError('请输入用户名和密码')
        return
      }

      if (password.length < 6) {
        setError('密码至少 6 位')
        return
      }

      setBusy(true)
      try {
        if (mode === 'login') {
          await login(username.trim(), password)
        } else {
          await register(username.trim(), password)
        }
        onClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '操作失败')
      } finally {
        setBusy(false)
      }
    },
    [mode, username, password, login, register, onClose],
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-[380px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>

              {/* Brand header */}
              <div className="flex flex-col items-center px-8 pb-5 pt-10">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <Radar className="size-6 text-primary" />
                </div>
                <h2 className="mt-4 text-[18px] font-semibold tracking-tight text-foreground">
                  {mode === 'login' ? '欢迎回来' : '创建账户'}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Competitor Intelligence Agent
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 px-8 pb-2">
                {/* Username */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    用户名
                  </label>
                  <input
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="h-10 rounded-xl border border-border/70 bg-muted/40 px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    密码
                  </label>
                  <input
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="h-10 rounded-xl border border-border/70 bg-muted/40 px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                {/* Error */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600"
                  >
                    {error}
                  </motion.p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground text-[14px] font-semibold text-white transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : mode === 'login' ? (
                    <LogIn className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  {mode === 'login' ? '登 录' : '注 册'}
                </button>
              </form>

              {/* Switch mode */}
              <div className="flex items-center justify-center gap-1.5 px-8 pb-8 pt-4">
                <span className="text-[12px] text-muted-foreground">
                  {mode === 'login' ? '还没有账户？' : '已有账户？'}
                </span>
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-[12px] font-medium text-primary transition-colors hover:text-primary/70"
                >
                  {mode === 'login' ? '创建账户' : '立即登录'}
                </button>
              </div>

              {/* Footer accent */}
              <div className="flex items-center justify-center gap-1 border-t border-border/40 bg-muted/20 px-8 py-3">
                <Sparkles className="size-3 text-primary/50" />
                <span className="font-mono text-[9px] text-muted-foreground/60">
                  JWT · bcrypt · SQLite
                </span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
