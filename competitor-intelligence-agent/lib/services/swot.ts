import apiClient from '@/lib/api-client'
import type {
  SwotGenerateRequest,
  SwotGenerateResponse,
} from '@/lib/types'

export async function generateSwot(
  payload: SwotGenerateRequest,
): Promise<SwotGenerateResponse> {
  const { data } = await apiClient.post<SwotGenerateResponse>(
    '/swot/generate',
    payload,
  )
  return data
}
