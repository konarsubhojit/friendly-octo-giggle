'use client'

import { useCallback, useMemo } from 'react'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { SavedViewCriteria } from '@/lib/validations/admin'

export interface AdminListSortState {
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

export interface AdminListStateSnapshot {
  readonly search: string
  readonly filters: Record<string, string>
  readonly sort: AdminListSortState | null
  readonly cursor: string | null
}

const FILTER_PARAM_PREFIX = 'f_'

export const decodeAdminListState = (
  params: URLSearchParams
): AdminListStateSnapshot => {
  const filters: Record<string, string> = {}

  params.forEach((value, key) => {
    if (!key.startsWith(FILTER_PARAM_PREFIX) || !value.trim()) {
      return
    }

    filters[key.slice(FILTER_PARAM_PREFIX.length)] = value
  })

  const sortField = params.get('sortField')
  const sortDirection = params.get('sortDirection')

  return {
    search: params.get('q') ?? '',
    filters,
    sort:
      sortField && (sortDirection === 'asc' || sortDirection === 'desc')
        ? {
            field: sortField,
            direction: sortDirection,
          }
        : null,
    cursor: params.get('cursor'),
  }
}

export const encodeAdminListState = (
  state: AdminListStateSnapshot
): URLSearchParams => {
  const params = new URLSearchParams()

  if (state.search.trim()) {
    params.set('q', state.search.trim())
  }

  for (const [key, value] of Object.entries(state.filters)) {
    if (value.trim()) {
      params.set(`${FILTER_PARAM_PREFIX}${key}`, value)
    }
  }

  if (state.sort) {
    params.set('sortField', state.sort.field)
    params.set('sortDirection', state.sort.direction)
  }

  if (state.cursor) {
    params.set('cursor', state.cursor)
  }

  return params
}

export interface UseAdminListStateResult extends AdminListStateSnapshot {
  readonly setSearch: (value: string) => void
  readonly setFilter: (key: string, value: string) => void
  readonly removeFilter: (key: string) => void
  readonly clearFilters: () => void
  readonly setSort: (sort: AdminListSortState | null) => void
  readonly setCursor: (cursor: string | null) => void
  readonly applyCriteria: (criteria: SavedViewCriteria) => void
  readonly toCriteria: () => SavedViewCriteria
}

export const useAdminListState = (): UseAdminListStateResult => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const state = useMemo(
    () => decodeAdminListState(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const replaceState = useCallback(
    (nextState: AdminListStateSnapshot) => {
      const nextParams = encodeAdminListState(nextState)
      const nextUrl = nextParams.toString()
        ? `${pathname}?${nextParams.toString()}`
        : pathname
      router.replace(nextUrl as Route, { scroll: false })
    },
    [pathname, router]
  )

  const updateState = useCallback(
    (updater: (current: AdminListStateSnapshot) => AdminListStateSnapshot) => {
      replaceState(updater(state))
    },
    [replaceState, state]
  )

  return {
    ...state,
    setSearch: (value) =>
      updateState((current) => ({
        ...current,
        search: value,
        cursor: null,
      })),
    setFilter: (key, value) =>
      updateState((current) => ({
        ...current,
        filters: {
          ...current.filters,
          [key]: value,
        },
        cursor: null,
      })),
    removeFilter: (key) =>
      updateState((current) => {
        const nextFilters = { ...current.filters }
        delete nextFilters[key]
        return {
          ...current,
          filters: nextFilters,
          cursor: null,
        }
      }),
    clearFilters: () =>
      updateState((current) => ({
        ...current,
        filters: {},
        cursor: null,
      })),
    setSort: (sort) =>
      updateState((current) => ({
        ...current,
        sort,
        cursor: null,
      })),
    setCursor: (cursor) =>
      updateState((current) => ({
        ...current,
        cursor,
      })),
    applyCriteria: (criteria) =>
      replaceState({
        search: criteria.search ?? '',
        filters: Object.fromEntries(
          Object.entries(criteria.filters ?? {}).map(([key, value]) => [
            key,
            String(value),
          ])
        ),
        sort: criteria.sort ?? null,
        cursor: null,
      }),
    toCriteria: () => ({
      search: state.search || undefined,
      filters:
        Object.keys(state.filters).length > 0 ? state.filters : undefined,
      sort: state.sort ?? undefined,
    }),
  }
}
