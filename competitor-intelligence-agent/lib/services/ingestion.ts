import apiClient from '@/lib/api-client'
import type { CrawlRequest, CrawlResponse, CrawlTaskItem, TaskStatus } from '@/lib/types'

export async function startCrawl(payload: CrawlRequest): Promise<CrawlResponse> {
  const { data } = await apiClient.post<CrawlResponse>('/data/crawl', payload)
  return data
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const { data } = await apiClient.get<TaskStatus>(`/data/task/${taskId}`)
  return data
}

export async function listCrawlTasks(): Promise<CrawlTaskItem[]> {
  const { data } = await apiClient.get<CrawlTaskItem[]>('/data/tasks')
  return data
}

export async function exportTaskDocx(taskId: string, filename: string): Promise<void> {
  const resp = await apiClient.get(`/data/task/${taskId}/export`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([resp.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
