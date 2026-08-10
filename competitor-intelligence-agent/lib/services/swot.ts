import apiClient from '@/lib/api-client'
import type {
  SwotGenerateRequest,
  SwotGenerateResponse,
  SwotReportListItem,
  SwotReportDetail,
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

export async function listSwotReports(): Promise<SwotReportListItem[]> {
  const { data } = await apiClient.get<SwotReportListItem[]>('/swot/reports')
  return data
}

export async function getSwotReport(
  reportId: string,
): Promise<SwotReportDetail> {
  const { data } = await apiClient.get<SwotReportDetail>(
    `/swot/reports/${reportId}`,
  )
  return data
}

export async function deleteSwotReport(reportId: string): Promise<void> {
  await apiClient.delete(`/swot/reports/${reportId}`)
}
