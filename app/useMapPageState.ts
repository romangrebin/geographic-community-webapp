import { useReducer, useCallback, useEffect, useRef, useState } from 'react'
import { booleanValid, area, centroid, bbox as turfBbox } from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { Community, CommunityCategory, CommunityInput } from '@/lib/types'
import type { MapHandle } from '@/components/Map'

// ── Constants ──────────────────────────────────────────────
const MAX_AREA_KM2 = 40
export const TIER2_THRESHOLD = 100

// ── Types ──────────────────────────────────────────────────

export type Panel =
  | { type: 'closed' }
  | { type: 'explore' }
  | { type: 'detail'; community: Community; from?: 'browse' }
  | { type: 'edit'; community: Community }
  | { type: 'about' }
  | { type: 'browse' }
  | { type: 'form'; geojson: Feature<Polygon | MultiPolygon> }

export type DrawMode = 'off' | 'drawing' | 'drawn'

/**
 * Point-query results live at the top level, not inside the Panel union.
 * This means navigating explore → detail → back preserves the results
 * without a re-fetch. The panel is just "what view am I looking at?"
 */
export type State = {
  communities: Community[]
  drawMode: DrawMode
  drawError: string | null
  panel: Panel
  /** When in edit-boundary mode, this holds the polygon being edited. */
  editGeojson: Feature<Polygon | MultiPolygon> | null
  // Point-query state — independent of which panel is showing
  pointResults: Community[]
  pointLoading: boolean
  pointClicked: boolean
  pointOffline: boolean
  clickMarker: { lat: number; lng: number } | null
  submitError: string | null
  hoveredCommunities: Community[]
}

type Action =
  | { type: 'SET_COMMUNITIES'; communities: Community[] }
  | { type: 'ADD_COMMUNITY'; community: Community }
  | { type: 'UPDATE_COMMUNITY'; community: Community }
  | { type: 'REMOVE_COMMUNITY'; id: string }
  | { type: 'START_DRAW' }
  | { type: 'DRAW_COMPLETE'; geojson: Feature<Polygon | MultiPolygon> }
  | { type: 'DRAW_ERROR'; error: string }
  | { type: 'CANCEL_DRAW' }
  | { type: 'SHOW_FORM'; geojson: Feature<Polygon | MultiPolygon> }
  | { type: 'CLICK_MAP'; lat: number; lng: number }
  | { type: 'CLICK_LOADING' }
  | { type: 'CLICK_RESULTS'; communities: Community[] }
  | { type: 'CLICK_OFFLINE' }
  | { type: 'SELECT_COMMUNITY'; community: Community }
  | { type: 'EDIT_COMMUNITY'; community: Community }
  | { type: 'FINISH_EDIT'; community: Community }
  | { type: 'CANCEL_EDIT' }
  | { type: 'BACK_TO_LIST' }
  | { type: 'SHOW_ABOUT' }
  | { type: 'SHOW_BROWSE' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_SUBMIT_ERROR'; error: string | null }
  | { type: 'SET_HOVERED'; communities: Community[] }
  | { type: 'UPDATE_EDIT_GEOJSON'; geojson: Feature<Polygon | MultiPolygon> }
  | { type: 'CLAIM_COMMUNITY'; community: Community }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_COMMUNITIES':
      return { ...state, communities: action.communities }

    case 'ADD_COMMUNITY':
      return { ...state, communities: [action.community, ...state.communities] }

    case 'UPDATE_COMMUNITY':
      return {
        ...state,
        communities: state.communities.map((c) =>
          c.id === action.community.id ? action.community : c
        ),
        panel: state.panel.type === 'detail' && state.panel.community.id === action.community.id
          ? { type: 'detail', community: action.community }
          : state.panel.type === 'edit' && state.panel.community.id === action.community.id
          ? { type: 'detail', community: action.community }
          : state.panel,
      }

    case 'REMOVE_COMMUNITY':
      return {
        ...state,
        communities: state.communities.filter((c) => c.id !== action.id),
        pointResults: state.pointResults.filter((c) => c.id !== action.id),
        panel: { type: 'closed' },
        clickMarker: null,
      }

    case 'START_DRAW':
      return {
        ...state,
        drawMode: 'drawing',
        drawError: null,
        panel: { type: 'closed' },
        submitError: null,
      }

    case 'DRAW_COMPLETE':
      return {
        ...state,
        drawMode: 'drawn',
        drawError: null,
        panel: { type: 'form', geojson: action.geojson },
      }

    case 'DRAW_ERROR':
      return { ...state, drawError: action.error }

    case 'CANCEL_DRAW':
      return { ...state, drawMode: 'off', drawError: null, submitError: null, editGeojson: null, panel: { type: 'closed' } }

    case 'SHOW_FORM':
      return { ...state, panel: { type: 'form', geojson: action.geojson } }

    case 'CLICK_MAP':
      return {
        ...state,
        clickMarker: { lat: action.lat, lng: action.lng },
        pointResults: [],
        pointLoading: true,
        pointClicked: true,
        pointOffline: false,
        panel: { type: 'explore' },
        hoveredCommunities: [],
      }

    case 'CLICK_LOADING':
      return { ...state, pointLoading: true }

    case 'CLICK_RESULTS':
      return { ...state, pointResults: action.communities, pointLoading: false, pointOffline: false }

    case 'CLICK_OFFLINE':
      return { ...state, pointResults: [], pointLoading: false, pointOffline: true }

    case 'SELECT_COMMUNITY':
      return {
        ...state,
        panel: {
          type: 'detail',
          community: action.community,
          from: state.panel.type === 'browse' ? 'browse' : undefined,
        },
      }

    case 'EDIT_COMMUNITY':
      // Enter edit mode: activate vertex editing on the map immediately
      return {
        ...state,
        panel: { type: 'edit', community: action.community },
        submitError: null,
        drawMode: 'drawing',
        drawError: null,
        editGeojson: action.community.geojson,
      }

    case 'FINISH_EDIT':
      return {
        ...state,
        communities: state.communities.map((c) =>
          c.id === action.community.id ? action.community : c
        ),
        panel: { type: 'detail', community: action.community },
        submitError: null,
        drawMode: 'off',
        editGeojson: null,
      }

    case 'CANCEL_EDIT':
      if (state.panel.type === 'edit') {
        // Restore the original geojson (editGeojson) in case vertices were dragged
        const original = state.editGeojson
          ? { ...state.panel.community, geojson: state.editGeojson }
          : state.panel.community
        return { ...state, panel: { type: 'detail', community: original }, submitError: null, drawMode: 'off', editGeojson: null }
      }
      return state

    case 'BACK_TO_LIST':
      if (state.panel.type === 'browse') return { ...state, panel: { type: 'closed' } }
      if (state.panel.type === 'detail' && state.panel.from === 'browse') {
        return { ...state, panel: { type: 'browse' } }
      }
      // Return to explore — point results are preserved in top-level state
      return { ...state, panel: state.pointClicked ? { type: 'explore' } : { type: 'closed' } }

    case 'SHOW_ABOUT':
      return { ...state, panel: { type: 'about' } }

    case 'SHOW_BROWSE':
      return { ...state, panel: { type: 'browse' } }

    case 'CLOSE_PANEL':
      return { ...state, panel: { type: 'closed' }, clickMarker: null, pointResults: [], pointLoading: false, pointClicked: false, pointOffline: false }

    case 'SET_SUBMIT_ERROR':
      return { ...state, submitError: action.error }

    case 'SET_HOVERED':
      return { ...state, hoveredCommunities: action.communities }

    case 'UPDATE_EDIT_GEOJSON':
      // Vertex drag completed while in edit-boundary mode — update the community's
      // geojson in the edit panel but keep draw mode active so the user can drag
      // more vertices. editGeojson keeps the ORIGINAL for cancel-restore.
      if (state.panel.type !== 'edit') return state
      return {
        ...state,
        drawError: null,
        panel: {
          type: 'edit',
          community: { ...state.panel.community, geojson: action.geojson },
        },
      }

    case 'CLAIM_COMMUNITY':
      return {
        ...state,
        communities: state.communities.map((c) =>
          c.id === action.community.id ? action.community : c
        ),
        panel: state.panel.type === 'detail' && state.panel.community.id === action.community.id
          ? { type: 'detail', community: action.community }
          : state.panel,
      }

    default:
      return state
  }
}

// ── Hook ───────────────────────────────────────────────────

type InitProps = {
  initialCommunities: Community[]
  initialSelectedCommunity?: Community | null
  initialMode?: 'explore' | 'draw'
  initialPanel?: 'about' | 'browse'
  initialLat?: number | null
  initialLng?: number | null
}

export function useMapPageState(props: InitProps, mapRef: React.RefObject<MapHandle | null>) {
  const {
    initialCommunities,
    initialSelectedCommunity = null,
    initialMode = 'explore',
    initialPanel: initialPanelType = null,
    initialLat = null,
    initialLng = null,
  } = props

  const hasInitialCoords = initialLat != null && initialLng != null
  const initialPanel: Panel = initialSelectedCommunity
    ? { type: 'detail', community: initialSelectedCommunity }
    : hasInitialCoords
    ? { type: 'explore' }
    : initialPanelType === 'about'
    ? { type: 'about' }
    : initialPanelType === 'browse'
    ? { type: 'browse' }
    : { type: 'closed' }

  const [state, dispatch] = useReducer(reducer, {
    communities: initialCommunities,
    drawMode: initialMode === 'draw' ? 'drawing' as DrawMode : 'off' as DrawMode,
    drawError: null,
    editGeojson: null,
    panel: initialPanel,
    pointResults: [],
    pointLoading: hasInitialCoords,
    pointClicked: hasInitialCoords,
    pointOffline: false,
    clickMarker: hasInitialCoords ? { lat: initialLat, lng: initialLng } : null,
    submitError: null,
    hoveredCommunities: [],
  })

  // ── Map callbacks ──────────────────────────────────────

  const handleMapClick = useCallback(async (lat: number, lng: number, communityIds?: string[]) => {
    if (state.drawMode !== 'off') return
    dispatch({ type: 'CLICK_MAP', lat, lng })

    if (communityIds !== undefined) {
      // Map click — resolve against already-rendered communities in state, no network call needed.
      // TODO: convert to bbox endpoint + viewport-triggered loading when page-load payload becomes
      // noticeable (~500+ communities, or whenever initial load feels slow).
      const matched = stateRef.current.communities.filter((c) => communityIds.includes(c.id))
      dispatch({ type: 'CLICK_RESULTS', communities: matched })
      return
    }

    // Address search — viewport may not contain the target location yet, so hit the API directly.
    try {
      const res = await fetch(`/api/communities/at-point?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      dispatch({ type: 'CLICK_RESULTS', communities: data })
    } catch {
      if (!navigator.onLine) {
        dispatch({ type: 'CLICK_OFFLINE' })
      } else {
        dispatch({ type: 'CLICK_RESULTS', communities: [] })
      }
    }
  }, [state.drawMode])

  const handleDrawComplete = useCallback((feature: Feature<Polygon | MultiPolygon>) => {
    if (!booleanValid(feature)) {
      dispatch({ type: 'DRAW_ERROR', error: 'The polygon geometry is invalid. Please redraw.' })
      return
    }
    const areaSqKm = area(feature) / 1_000_000
    if (areaSqKm > MAX_AREA_KM2) {
      dispatch({ type: 'DRAW_ERROR', error: `Polygon is too large (${areaSqKm.toFixed(0)} km²). Max is ${MAX_AREA_KM2} km².` })
      return
    }
    // If we're in edit-boundary mode, update the community's geojson in the edit panel
    if (stateRef.current.editGeojson !== null) {
      dispatch({ type: 'UPDATE_EDIT_GEOJSON', geojson: feature })
    } else {
      dispatch({ type: 'DRAW_COMPLETE', geojson: feature })
    }
  }, [])

  const handleAddressSelect = useCallback((lat: number, lng: number) => {
    const map = mapRef.current?.getMap()
    if (map) map.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
    handleMapClick(lat, lng)
  }, [handleMapClick, mapRef])

  const handleSelectCommunity = useCallback((c: Community) => {
    dispatch({ type: 'SELECT_COMMUNITY', community: c })
    const map = mapRef.current?.getMap()
    if (map) {
      const [minLng, minLat, maxLng, maxLat] = turfBbox(c.geojson) as [number, number, number, number]
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: { top: 80, bottom: 80, left: 80, right: 360 }, duration: 600, maxZoom: 15 }
      )
    }
  }, [mapRef])

  const handleDeleteCommunity = useCallback(async (id: string) => {
    const res = await fetch(`/api/communities/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    dispatch({ type: 'REMOVE_COMMUNITY', id })
  }, [])

  const handleRegisterSubmit = useCallback(async (data: {
    name: string
    description: string | null
    category: CommunityCategory
    website: string | null
    email: string | null
    emailPublic: boolean
  }) => {
    if (state.panel.type !== 'form') return
    dispatch({ type: 'SET_SUBMIT_ERROR', error: null })

    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, geojson: state.panel.geojson }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Something went wrong')
      }
      const community: Community = await res.json()
      dispatch({ type: 'ADD_COMMUNITY', community })
      dispatch({ type: 'SELECT_COMMUNITY', community })

      // Reset draw mode after successful registration
      dispatch({ type: 'CANCEL_DRAW' })
      dispatch({ type: 'SELECT_COMMUNITY', community })

      const map = mapRef.current?.getMap()
      if (map) {
        const c = centroid(community.geojson).geometry.coordinates
        map.flyTo({ center: [c[0], c[1]], zoom: 14, duration: 600 })
      }
    } catch (e) {
      dispatch({ type: 'SET_SUBMIT_ERROR', error: e instanceof Error ? e.message : 'An unexpected error occurred' })
    }
  }, [state.panel, mapRef])

  const handleUpdateCommunity = useCallback(async (id: string, data: Partial<CommunityInput>) => {
    dispatch({ type: 'SET_SUBMIT_ERROR', error: null })
    // If the community's geojson was edited via edit-boundary mode, include it
    const editPanel = stateRef.current.panel
    const payload: Partial<CommunityInput> =
      editPanel.type === 'edit' && editPanel.community.id === id
        ? { ...data, geojson: editPanel.community.geojson }
        : data
    try {
      const res = await fetch(`/api/communities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Something went wrong')
      }
      const updated: Community = await res.json()
      dispatch({ type: 'FINISH_EDIT', community: updated })
    } catch (e) {
      dispatch({ type: 'SET_SUBMIT_ERROR', error: e instanceof Error ? e.message : 'An unexpected error occurred' })
    }
  }, [])

  const handleClaimCommunity = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/communities/${id}/claim`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to claim community')
      }
      const updated: Community = await res.json()
      dispatch({ type: 'CLAIM_COMMUNITY', community: updated })
    } catch (e) {
      dispatch({ type: 'SET_SUBMIT_ERROR', error: e instanceof Error ? e.message : 'An unexpected error occurred' })
    }
  }, [])

  const handleReleaseStewardship = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/communities/${id}/claim`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to release stewardship')
      }
      const updated: Community = await res.json()
      dispatch({ type: 'CLAIM_COMMUNITY', community: updated })
    } catch (e) {
      dispatch({ type: 'SET_SUBMIT_ERROR', error: e instanceof Error ? e.message : 'An unexpected error occurred' })
    }
  }, [])

  // ── Stale-closure guard for the ESC handler ───────────
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  // ── ESC key: retreat one level in the panel stack ─────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return

      // Let the browser handle ESC when the user is typing
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const { panel, drawMode } = stateRef.current

      if (panel.type === 'edit') {
        dispatch({ type: 'CANCEL_EDIT' })
      } else if (panel.type === 'detail') {
        dispatch({ type: 'BACK_TO_LIST' })
      } else if (
        panel.type === 'explore' ||
        panel.type === 'about' ||
        panel.type === 'browse'
      ) {
        dispatch({ type: 'CLOSE_PANEL' })
      } else if (panel.type === 'form' || drawMode !== 'off') {
        dispatch({ type: 'CANCEL_DRAW' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch]) // dispatch is stable; state is read via stateRef

  // ── URL sync (replaceState + popstate) ─────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return
    let target = '/'
    if (state.drawMode !== 'off' && state.panel.type !== 'edit') {
      target = '/register'
    } else if (state.panel.type === 'detail' || state.panel.type === 'edit') {
      target = `/c/${state.panel.community.slug}`
    } else if (state.panel.type === 'about') {
      target = '/about'
    } else if (state.panel.type === 'browse') {
      target = '/all'
    } else if (state.clickMarker) {
      target = `/?lat=${state.clickMarker.lat.toFixed(6)}&lng=${state.clickMarker.lng.toFixed(6)}`
    }
    const current = window.location.pathname + window.location.search
    if (current !== target) {
      window.history.replaceState({ panel: state.panel.type }, '', target)
    }
  }, [state.panel, state.drawMode, state.clickMarker])

  // Listen for back/forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const path = window.location.pathname
      if (path === '/register') {
        dispatch({ type: 'START_DRAW' })
      } else if (path === '/about') {
        dispatch({ type: 'SHOW_ABOUT' })
      } else if (path === '/all') {
        dispatch({ type: 'SHOW_BROWSE' })
      } else if (path.startsWith('/c/')) {
        const slug = path.split('/c/')[1]
        const community = state.communities.find((c) => c.slug === slug)
        if (community) {
          dispatch({ type: 'SELECT_COMMUNITY', community })
        } else {
          dispatch({ type: 'CLOSE_PANEL' })
        }
      } else {
        dispatch({ type: 'CLOSE_PANEL' })
        // Check for lat/lng in the URL
        const params = new URLSearchParams(window.location.search)
        const lat = parseFloat(params.get('lat') ?? '')
        const lng = parseFloat(params.get('lng') ?? '')
        if (!isNaN(lat) && !isNaN(lng)) {
          handleMapClick(lat, lng)
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [state.communities, handleMapClick])

  // Hash-based panel state — handles /#about and /#all on initial load and
  // when an in-page anchor link changes the hash without a navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleHash = (hash: string) => {
      if (hash === '#about') dispatch({ type: 'SHOW_ABOUT' })
      else if (hash === '#all') dispatch({ type: 'SHOW_BROWSE' })
    }

    // Check hash on mount (e.g. someone navigates directly to /#about)
    if (!initialPanelType) handleHash(window.location.hash)

    // React to hash changes from in-page links (e.g. <a href="/#about">)
    const onHashChange = () => handleHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [initialPanelType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial lat/lng query
  const initialQueryDoneRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  return {
    state,
    dispatch,
    mapReady,
    setMapReady,
    handleMapClick,
    handleDrawComplete,
    handleAddressSelect,
    handleSelectCommunity,
    handleDeleteCommunity,
    handleRegisterSubmit,
    handleUpdateCommunity,
    handleClaimCommunity,
    handleReleaseStewardship,
    initialQueryDoneRef,
  }
}
