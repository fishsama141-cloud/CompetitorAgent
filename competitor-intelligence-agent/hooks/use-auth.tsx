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

const API = 'http://localhost:8000/api/v1'
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

    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('token expired')
        return res.json()
      })
      .then((data) => {
        if (data.status === 'success' && data.data) {
          setUser({ id: data.data.id, username: data.data.username })
          setToken(stored)
        } else {
          clearToken()
        }
      })
      .catch(() => clearToken())
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.detail ?? '登录失败')
    if (json.status !== 'success' || !json.data?.access_token) {
      throw new Error('登录响应异常')
    }
    saveToken(json.data.access_token)
    setToken(json.data.access_token)
    setUser({ id: 0, username: json.data.username }) // id filled by /me on next load
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.detail ?? '注册失败')
    if (json.status !== 'success' || !json.data?.access_token) {
      throw new Error('注册响应异常')
    }
    saveToken(json.data.access_token)
    setToken(json.data.access_token)
    setUser({ id: 0, username: json.data.username })
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
