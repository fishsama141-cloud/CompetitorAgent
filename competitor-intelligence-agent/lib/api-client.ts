import axios from 'axios'

/**
 * Axios instance preconfigured for the Competitor Intelligence Agent API.
 *
 * - Base URL: `/api/v1` (proxied through Next.js rewrites or same-origin backend)
 * - Timeout: 30s
 * - Automatically unwraps the `{ status, data, error_message }` envelope
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

const apiClient = axios.create({
  baseURL: `${BASE}/api/v1`,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

// --- Request interceptor: attach JWT token ---
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('competitor_agent_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// --- Response interceptor: unwrap the API envelope ---
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data

    // If the response follows the contract envelope, unwrap it
    if (body && typeof body === 'object' && 'status' in body) {
      if (body.status === 'error') {
        const message =
          body.error_message ?? body.error ?? 'Unknown server error'
        return Promise.reject(new ApiError(message, body, response.status))
      }
      // Return just the `data` portion so callers don't have to unwrap manually
      return { ...response, data: body.data }
    }

    return response
  },
  (error) => {
    if (axios.isAxiosError(error)) {
      const body = error.response?.data
      const message =
        body?.error_message ??
        body?.detail ??
        error.message
      return Promise.reject(
        new ApiError(message, body, error.response?.status ?? 0),
      )
    }
    return Promise.reject(error)
  },
)

export class ApiError extends Error {
  body: unknown
  httpStatus: number

  constructor(message: string, body: unknown, httpStatus: number) {
    super(message)
    this.name = 'ApiError'
    this.body = body
    this.httpStatus = httpStatus
  }
}

export default apiClient
