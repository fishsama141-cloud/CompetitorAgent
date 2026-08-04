import apiClient from '@/lib/api-client'
import type { EvaluationRequest, Evaluations } from '@/lib/types'

export async function runEvaluation(
  payload: EvaluationRequest,
): Promise<Evaluations> {
  const { data } = await apiClient.post<Evaluations>(
    '/evaluation/run',
    payload,
  )
  return data
}

export async function getEvaluation(reportId: string): Promise<Evaluations> {
  const { data } = await apiClient.get<Evaluations>(`/evaluation/${reportId}`)
  return data
}
