'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import apiClient from '@/lib/api-client'

// ── Types ────────────────────────────────────────────────────

interface User {
  id: number
  username: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

const TOKEN_KEY = 'competitor_agent_token'

// ── Context ───────────────────────────────────────────────────

const AuthCtx = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// ── Helpers ───────────────────────────────────────────────────

function saveToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token)
}

function loadToken(): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem(TOKEN_KEY)
  return null
}

function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY)
}

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: validate stored token
  useEffect(() => {
    const stored = loadToken()
    if (!stored) {
      setIsLoading(false)
      return
    }

    apiClient
      .get('/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then((res) => {
        const body = res.data
        if (body && body.id && body.username) {
          setUser({ id: body.id, username: body.username })
          setToken(stored)
        } else {
          clearToken()
        }
      })
      .catch(() => clearToken())
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password })
    const body = res.data
    if (!body?.access_token) throw new Error('登录响应异常')
    saveToken(body.access_token)
    setToken(body.access_token)
    setUser({ id: 0, username: body.username })
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post('/auth/register', { username, password })
    const body = res.data
    if (!body?.access_token) throw new Error('注册响应异常')
    saveToken(body.access_token)
    setToken(body.access_token)
    setUser({ id: 0, username: body.username })
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, token, isLoading, login, register, logout }),
    [user, token, isLoading, login, register, logout],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
