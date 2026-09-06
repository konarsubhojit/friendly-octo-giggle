import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { castDraft } from 'immer'
import { ApiError, apiClient } from '@/lib/api-client'
import type { ReturnAction, ReturnStatus } from '@/lib/constants/returns'
import type { AdminReturn } from '@/features/admin/components/AdminReturnCard'

export type ReturnQueueFilter = ReturnStatus | 'ALL'

interface ApiEnvelope<T> {
  readonly data: T
}

interface ReturnsState {
  readonly filter: ReturnQueueFilter
  // `AdminReturn` carries `readonly` nested arrays, which an Immer draft will
  // not accept directly — hence `castDraft` at each assignment.
  readonly items: readonly AdminReturn[]
  readonly loading: boolean
  readonly error: string | null
  /** Id of the return currently being actioned, so only its card is disabled. */
  readonly decidingId: string | null
  readonly decisionError: string | null
}

const DEFAULT_FILTER: ReturnQueueFilter = 'REQUESTED'

const QUEUE_ERROR = 'The returns queue could not be loaded.'

const describeError = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback

/** Load one page of the triage queue. */
export const fetchAdminReturns = createAsyncThunk<
  AdminReturn[],
  ReturnQueueFilter,
  { rejectValue: string }
>('returns/fetch', async (filter, { rejectWithValue }) => {
  try {
    const query = filter === 'ALL' ? '' : `?status=${filter}`
    const payload = await apiClient.get<
      ApiEnvelope<{ returns: AdminReturn[] }>
    >(`/api/admin/returns${query}`)
    return payload.data.returns
  } catch (error) {
    return rejectWithValue(describeError(error, QUEUE_ERROR))
  }
})

interface DecideArgs {
  readonly returnId: string
  readonly action: ReturnAction
  readonly decisionReason?: string
}

/**
 * Action one return, then reload the current view.
 *
 * The reload is not an optimisation shortcut: a decision can change which
 * filter a return belongs to, and can also fail server-side after passing the
 * client's own checks, so the queue is re-read rather than patched in place.
 */
export const decideAdminReturn = createAsyncThunk<
  void,
  DecideArgs,
  { state: { returns: ReturnsState }; rejectValue: string }
>(
  'returns/decide',
  async (
    { returnId, action, decisionReason },
    { dispatch, getState, rejectWithValue }
  ) => {
    try {
      await apiClient.patch(`/api/admin/returns/${returnId}`, {
        action,
        ...(decisionReason ? { decisionReason } : {}),
      })
    } catch (error) {
      return rejectWithValue(
        describeError(error, 'The decision could not be recorded.')
      )
    }

    await dispatch(fetchAdminReturns(getState().returns.filter))
  }
)

const initialState: ReturnsState = {
  filter: DEFAULT_FILTER,
  items: [],
  loading: false,
  error: null,
  decidingId: null,
  decisionError: null,
}

const returnsSlice = createSlice({
  name: 'returns',
  initialState,
  reducers: {
    /**
     * Seed the queue from a server-rendered first page.
     *
     * Without this the client would have to fetch during its first effect,
     * which `react-hooks/set-state-in-effect` rejects and which would leave
     * the queue blank on first paint.
     */
    hydrateReturns(
      state,
      action: { payload: { filter: ReturnQueueFilter; items: AdminReturn[] } }
    ) {
      state.filter = action.payload.filter
      state.items = castDraft(action.payload.items)
    },
    setReturnsFilter(state, action: { payload: ReturnQueueFilter }) {
      state.filter = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminReturns.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAdminReturns.fulfilled, (state, action) => {
        state.loading = false
        state.items = castDraft(action.payload)
      })
      .addCase(fetchAdminReturns.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload ?? QUEUE_ERROR
      })
      .addCase(decideAdminReturn.pending, (state, action) => {
        state.decidingId = action.meta.arg.returnId
        state.decisionError = null
      })
      .addCase(decideAdminReturn.fulfilled, (state) => {
        state.decidingId = null
      })
      .addCase(decideAdminReturn.rejected, (state, action) => {
        state.decidingId = null
        state.decisionError =
          action.payload ?? 'The decision could not be recorded.'
      })
  },
})

export const { hydrateReturns, setReturnsFilter } = returnsSlice.actions
export default returnsSlice.reducer
