'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type {
  AdminResourceKey,
  SavedViewCriteria,
} from '@/lib/validations/admin'

export interface SavedViewSummary {
  readonly id: string
  readonly resource: AdminResourceKey
  readonly name: string
  readonly criteria: SavedViewCriteria
  readonly isBuiltIn: boolean
  readonly owned: boolean
}

interface SavedViewsResponse {
  readonly success: true
  readonly data: {
    readonly views: readonly SavedViewSummary[]
  }
}

interface SavedViewResponse {
  readonly success: true
  readonly data: {
    readonly view: SavedViewSummary
  }
}

export const useSavedViews = (resource: AdminResourceKey) => {
  const [views, setViews] = useState<readonly SavedViewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<SavedViewsResponse>(
        `/api/admin/saved-views?resource=${encodeURIComponent(resource)}`
      )
      setViews(response.data.views)
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load saved views'
      )
    } finally {
      setLoading(false)
    }
  }, [resource])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (input: { readonly name: string; readonly criteria: SavedViewCriteria }) => {
      const response = await apiClient.post<SavedViewResponse>(
        '/api/admin/saved-views',
        {
          resource,
          ...input,
        }
      )
      setViews((current) => [...current, response.data.view])
      return response.data.view
    },
    [resource]
  )

  const rename = useCallback(async (id: string, name: string) => {
    const response = await apiClient.patch<SavedViewResponse>(
      `/api/admin/saved-views/${encodeURIComponent(id)}`,
      { name }
    )
    setViews((current) =>
      current.map((view) =>
        view.id === id ? response.data.view : view
      )
    )
    return response.data.view
  }, [])

  const remove = useCallback(async (id: string) => {
    await apiClient.delete(`/api/admin/saved-views/${encodeURIComponent(id)}`)
    setViews((current) => current.filter((view) => view.id !== id))
  }, [])

  return {
    views,
    loading,
    error,
    refresh,
    create,
    rename,
    remove,
  }
}
