import apiClient from '@/lib/api-client'
import type { CrawlRequest, CrawlResponse, TaskStatus } from '@/lib/types'

export async function startCrawl(payload: CrawlRequest): Promise<CrawlResponse> {
  const { data } = await apiClient.post<CrawlResponse>('/data/crawl', payload)
  return data
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const { data } = await apiClient.get<TaskStatus>(`/data/task/${taskId}`)
  return data
}
