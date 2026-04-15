'use client'

import { useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { bbox as turfBbox } from '@turf/turf'
import CommunitySidebar from '@/components/CommunitySidebar'
import RegisterSheet from '@/components/RegisterSheet'
import AddressSearch from '@/components/AddressSearch'
import AuthButton from '@/components/AuthButton'
import type { Community } from '@/lib/types'
import type { MapHandle } from '@/components/Map'
import Link from 'next/link'
import { useMapPageState, TIER2_THRESHOLD } from './useMapPageState'
import { useAuth } from '@/hooks/useAuth'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

type Props = {
  initialCommunities: Community[]
  initialSelectedCommunity?: Community | null
  initialMode?: 'explore' | 'draw'
  initialPanel?: 'about' | 'browse'
  initialLat?: number | null
  initialLng?: number | null
}

export default function MapPage(props: Props) {
  const { initialSelectedCommunity = null, initialLat = null, initialLng = null } = props
  const mapRef = useRef<MapHandle>(null)
  const { user: currentUser } = useAuth()

  const {
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
    initialQueryDoneRef,
  } = useMapPageState(props, mapRef)

  const { communities, drawMode, drawError, panel, clickMarker, submitError, hoveredCommunities, pointResults, pointLoading, pointClicked, editGeojson } = state

  // Run initial lat/lng point query once map is ready
  useEffect(() => {
    if (!mapReady || initialQueryDoneRef.current) return
    if (initialLat == null || initialLng == null) return
    initialQueryDoneRef.current = true
    fetch(`/api/communities/at-point?lat=${initialLat}&lng=${initialLng}`)
      .then((r) => r.json())
      .then((data) => dispatch({ type: 'CLICK_RESULTS', communities: data }))
      .catch(() => dispatch({ type: 'CLICK_RESULTS', communities: [] }))
  }, [mapReady, initialLat, initialLng, dispatch, initialQueryDoneRef])

  // Fly to deep-linked community once map is ready
  useEffect(() => {
    if (!mapReady || !initialSelectedCommunity) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const [minLng, minLat, maxLng, maxLat] = turfBbox(initialSelectedCommunity.geojson) as [
      number, number, number, number
    ]
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: { top: 80, bottom: 80, left: 80, right: 360 }, duration: 600, maxZoom: 15 }
    )
  }, [mapReady, initialSelectedCommunity])

  // Geolocation on first load (skip if saved view or deep-linked)
  useEffect(() => {
    if (initialSelectedCommunity) return
    if (initialLat != null) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem('gc.mapView') !== null) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current?.getMap()
        if (map) map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13, duration: 400 })
        handleMapClick(pos.coords.latitude, pos.coords.longitude)
      },
      () => {}
    )
  }, [handleMapClick, initialSelectedCommunity, initialLat])

  const isDrawActive = drawMode !== 'off'
  const isPanelOpen = panel.type !== 'closed'
  const selectedCommunityId =
    panel.type === 'detail' ? panel.community.id
    : panel.type === 'edit' ? panel.community.id
    : null
  // Exclude the community being edited from the fill layer while the draw
  // control renders it via direct_select, to avoid a double polygon.
  const editingCommunityId = panel.type === 'edit' ? panel.community.id : null

  const navBtnClass = 'shrink-0 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-medium'

  // Panel content — shared between desktop and mobile
  const panelContent = panel.type === 'form' ? (
    <RegisterSheet
      geojson={panel.geojson}
      onSubmit={handleRegisterSubmit}
      onBack={() => dispatch({ type: 'START_DRAW' })}
      submitError={submitError}
      currentUser={currentUser}
    />
  ) : (
    <CommunitySidebar
      communities={pointResults}
      allCommunities={communities}
      loading={pointLoading}
      clicked={pointClicked}
      selectedCommunity={panel.type === 'detail' ? panel.community : null}
      editingCommunity={panel.type === 'edit' ? panel.community : null}
      showAbout={panel.type === 'about'}
      browseMode={panel.type === 'browse'}
      currentUser={currentUser}
      onBrowseModeChange={(active) => dispatch(active ? { type: 'SHOW_BROWSE' } : { type: 'CLOSE_PANEL' })}
      onSelectCommunity={handleSelectCommunity}
      onDeleteCommunity={handleDeleteCommunity}
      onEditCommunity={(c) => dispatch({ type: 'EDIT_COMMUNITY', community: c })}
      onCancelEdit={() => dispatch({ type: 'CANCEL_EDIT' })}
      onUpdateCommunity={handleUpdateCommunity}
      onClaimCommunity={handleClaimCommunity}
      submitError={submitError}
      onBack={() => dispatch({ type: 'BACK_TO_LIST' })}
      onClose={() => dispatch({ type: 'CLOSE_PANEL' })}
    />
  )

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas">
      {/* Tier 2 nudge banner */}
      {communities.length >= TIER2_THRESHOLD && (
        <div className="shrink-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 text-center">
          {communities.length} communities registered — time to tackle Tier 2 of the project plan.
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 z-30 bg-panel border-b border-line shadow-sm px-4 py-2.5">
        {/* Row 1: logo + search (+ desktop-only buttons) */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            onClick={() => dispatch({ type: 'CLOSE_PANEL' })}
            className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src="/icon.svg" alt="geographic.community" className="md:hidden w-8 h-8 rounded-lg" />
            <span className="hidden md:inline font-bold text-ink text-base tracking-tight">
              geographic<span className="text-accent">.</span>community
            </span>
          </Link>
          <div className="flex-1 max-w-sm">
            <AddressSearch onSelect={handleAddressSelect} />
          </div>

          {/* Desktop-only: buttons inline in row 1 */}
          <div className="hidden md:flex items-center gap-2">
            {drawMode === 'off' && (
              <button
                onClick={() => dispatch({ type: 'SHOW_BROWSE' })}
                className={`${navBtnClass} border border-line text-ink-3 hover:bg-chip hover:border-line-input`}
              >
                All Communities
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'SHOW_ABOUT' })}
              className={`${navBtnClass} border border-line text-ink-3 hover:bg-chip hover:border-line-input`}
            >
              About
            </button>
            {isDrawActive && panel.type !== 'edit' ? (
              <button
                onClick={() => dispatch({ type: 'CANCEL_DRAW' })}
                className={`${navBtnClass} bg-red-600 text-white hover:bg-red-700 shadow-sm`}
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => dispatch({ type: 'START_DRAW' })}
                className={`${navBtnClass} bg-accent text-white hover:bg-accent-hi shadow-sm`}
              >
                + Add Community
              </button>
            )}
            <AuthButton user={currentUser ?? null} />
          </div>
        </div>

        {/* Row 2: buttons (mobile only) */}
        <div className="mt-2 flex md:hidden items-center gap-2">
          {drawMode === 'off' && (
            <button
              onClick={() => dispatch({ type: 'SHOW_BROWSE' })}
              className={`${navBtnClass} border border-line text-ink-3 hover:bg-chip hover:border-line-input`}
            >
              All
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'SHOW_ABOUT' })}
            className={`${navBtnClass} border border-line text-ink-3 hover:bg-chip hover:border-line-input`}
          >
            About
          </button>
          <AuthButton user={currentUser ?? null} />
          <div className="flex-1" />
          {isDrawActive && panel.type !== 'edit' ? (
            <button
              onClick={() => dispatch({ type: 'CANCEL_DRAW' })}
              className={`${navBtnClass} bg-red-600 text-white hover:bg-red-700 shadow-sm`}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => dispatch({ type: 'START_DRAW' })}
              className={`${navBtnClass} bg-accent text-white hover:bg-accent-hi shadow-sm`}
            >
              + Add
            </button>
          )}
        </div>
      </header>

      {/* Everything below the header */}
      <div className="flex-1 relative overflow-hidden">
        {/* Draw mode instruction / error banner */}
        {drawMode === 'drawing' && (drawError || panel.type !== 'edit') && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-panel rounded-xl shadow-lg px-4 py-3 text-sm text-ink-2 border border-line max-w-md pointer-events-none">
            {drawError ? (
              <span className="text-red-500 font-medium">{drawError}</span>
            ) : (
              <span>Click the map to place points around your community boundary. Double-click (or click the first point) to finish.</span>
            )}
          </div>
        )}

        {/* Map */}
        <div className="absolute inset-0">
          <Map
            ref={mapRef}
            communities={communities}
            onMapClick={handleMapClick}
            onCommunityHover={(cs) => dispatch({ type: 'SET_HOVERED', communities: cs })}
            onReady={() => setMapReady(true)}
            drawActive={isDrawActive}
            onDrawComplete={handleDrawComplete}
            editGeojson={editGeojson}
            editingCommunityId={editingCommunityId}
            selectedCommunityId={selectedCommunityId}
            clickMarker={clickMarker}
            className="w-full h-full"
          />
        </div>

        {/* Hover tooltip */}
        {hoveredCommunities.length > 0 && drawMode === 'off' && !selectedCommunityId && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-panel/95 shadow-lg border border-line rounded-xl px-3 py-1.5 text-sm font-semibold text-ink pointer-events-none">
            {hoveredCommunities.length === 1
              ? hoveredCommunities[0].name
              : `${hoveredCommunities.length} communities overlap here`}
          </div>
        )}

        {/* Right panel (desktop) */}
        <div
          className={`
            hidden md:flex flex-col absolute right-0 top-0 bottom-0 w-80 bg-panel border-l border-line shadow-xl z-20
            transition-transform duration-200
            ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {panelContent}
        </div>

        {/* Bottom sheet (mobile) */}
        {isPanelOpen && (
          <div className="md:hidden absolute bottom-0 left-0 right-0 z-20 h-1/2 rounded-t-2xl shadow-2xl border-t border-line bg-panel overflow-hidden">
            {panelContent}
          </div>
        )}
      </div>
    </div>
  )
}
