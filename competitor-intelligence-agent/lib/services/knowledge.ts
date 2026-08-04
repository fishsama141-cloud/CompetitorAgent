import apiClient from '@/lib/api-client'
import type {
  SearchRequest,
  SearchResponse,
  UploadDocumentRequest,
  UploadDocumentResponse,
  ChatRequest,
  ChatResponse,
} from '@/lib/types'

export async function searchKnowledge(
  payload: SearchRequest,
): Promise<SearchResponse> {
  const { data } = await apiClient.post<SearchResponse>(
    '/knowledge/search',
    payload,
  )
  return data
}

export async function uploadDocument(
  payload: UploadDocumentRequest,
): Promise<UploadDocumentResponse> {
  const { data } = await apiClient.post<UploadDocumentResponse>(
    '/knowledge/documents',
    payload,
  )
  return data
}

export async function chat(payload: ChatRequest): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>('/chat', payload)
  return data
}
