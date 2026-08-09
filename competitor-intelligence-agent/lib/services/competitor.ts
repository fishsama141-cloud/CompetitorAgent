import apiClient from '@/lib/api-client'
import type {
  Competitor,
  CreateCompetitorRequest,
  CreateCompetitorResponse,
} from '@/lib/types'

export async function listCompetitors(): Promise<Competitor[]> {
  const { data } = await apiClient.get<Competitor[]>('/competitors')
  return data
}

export async function createCompetitor(
  payload: CreateCompetitorRequest,
): Promise<CreateCompetitorResponse> {
  const { data } = await apiClient.post<CreateCompetitorResponse>(
    '/competitors',
    payload,
  )
  return data
}

export async function deleteCompetitor(
  competitorId: string,
): Promise<{ competitor_id: string; name: string; deleted_tasks: number; deleted_docs: number }> {
  const { data } = await apiClient.delete(`/competitors/${competitorId}`)
  return data
}
