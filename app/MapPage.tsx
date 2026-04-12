'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { booleanValid, area, bbox as turfBbox, centroid } from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import CommunitySidebar from '@/components/CommunitySidebar'
import RegisterSheet from '@/components/RegisterSheet'
import AddressSearch from '@/components/AddressSearch'
import type { Community, CommunityCategory } from '@/lib/types'
import type { MapHandle } from '@/components/Map'
import Link from 'next/link'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

const MAX_AREA_KM2 = 40
const TIER2_THRESHOLD = 100

type Mode =
  | { type: 'explore' }
  | { type: 'draw'; error?: string }
  | { type: 'form'; geojson: Feature<Polygon | MultiPolygon> }

type Props = {
  initialCommunities: Community[]
  initialSelectedCommunity?: Community | null
  initialMode?: 'explore' | 'draw'
  initialLat?: number | null
  initialLng?: number | null
}

export default function MapPage({
  initialCommunities,
  initialSelectedCommunity = null,
  initialMode = 'explore',
  initialLat = null,
  initialLng = null,
}: Props) {
  const [communities, setCommunities] = useState<Community[]>(initialCommunities)
  const [mode, setMode] = useState<Mode>(
    initialMode === 'draw' ? { type: 'draw' } : { type: 'explore' }
  )
  const [clickMarker, setClickMarker] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  )

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(Boolean(initialSelectedCommunity) || (initialLat != null && initialLng != null))
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [clicked, setClicked] = useState(Boolean(initialSelectedCommunity) || (initialLat != null && initialLng != null))
  const [clickedCommunities, setClickedCommunities] = useState<Community[]>(
    initialSelectedCommunity ? [initialSelectedCommunity] : []
  )
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(
    initialSelectedCommunity
  )
  const [hoveredCommunity, setHoveredCommunity] = useState<Community | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [browseMode, setBrowseMode] = useState(false)

  // Register state
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<MapHandle>(null)

  // If page loaded with a lat/lng in the URL, run the point query once map is ready
  const initialQueryDoneRef = useRef(false)
  useEffect(() => {
    if (!mapReady || initialQueryDoneRef.current) return
    if (initialLat == null || initialLng == null) return
    initialQueryDoneRef.current = true
    setSidebarLoading(true)
    fetch(`/api/communities/at-point?lat=${initialLat}&lng=${initialLng}`)
      .then((r) => r.json())
      .then((data) => setClickedCommunities(data))
      .catch(() => setClickedCommunities([]))
      .finally(() => setSidebarLoading(false))
  }, [mapReady, initialLat, initialLng])

  // Keep the browser URL in sync with app state
  useEffect(() => {
    if (typeof window === 'undefined') return
    let target = '/'
    if (mode.type === 'draw' || mode.type === 'form') {
      target = '/register'
    } else if (selectedCommunity) {
      target = `/c/${selectedCommunity.slug}`
    } else if (clickMarker) {
      target = `/?lat=${clickMarker.lat.toFixed(6)}&lng=${clickMarker.lng.toFixed(6)}`
    }
    if (window.location.pathname + window.location.search !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [selectedCommunity, mode.type, clickMarker])

  // When a specific community is deep-linked, fly to it once the map is ready
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

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (mode.type !== 'explore') return
    setClickMarker({ lat, lng })
    setSidebarLoading(true)
    setClicked(true)
    setSidebarOpen(true)
    setSelectedCommunity(null)
    setShowAbout(false)
    setBrowseMode(false)
    try {
      const res = await fetch(`/api/communities/at-point?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      setClickedCommunities(data)
    } catch {
      setClickedCommunities([])
    } finally {
      setSidebarLoading(false)
    }
  }, [mode.type])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
    setSelectedCommunity(null)
    setClickMarker(null)
    setShowAbout(false)
    setBrowseMode(false)
  }, [])

  const handleAddressSelect = useCallback((lat: number, lng: number) => {
    const map = mapRef.current?.getMap()
    if (map) {
      map.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
    }
    handleMapClick(lat, lng)
  }, [handleMapClick])

  // Geolocation on first load (skip if a saved view or deep-linked community)
  useEffect(() => {
    if (initialSelectedCommunity) return
    if (initialLat != null) return
    if (typeof window === 'undefined') return
    const hasSavedView = localStorage.getItem('gc.mapView') !== null
    if (hasSavedView) return
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

  const handleDrawComplete = useCallback((feature: Feature<Polygon | MultiPolygon>) => {
    if (!booleanValid(feature)) {
      setMode({ type: 'draw', error: 'The polygon geometry is invalid. Please redraw.' })
      return
    }
    const areaSqKm = area(feature) / 1_000_000
    if (areaSqKm > MAX_AREA_KM2) {
      setMode({ type: 'draw', error: `Polygon is too large (${areaSqKm.toFixed(0)} km²). Max is ${MAX_AREA_KM2} km².` })
      return
    }
    setMode({ type: 'form', geojson: feature })
  }, [])

  const handleRegisterSubmit = useCallback(async (data: {
    name: string
    description: string | null
    category: CommunityCategory
    website: string | null
    email: string | null
  }) => {
    if (mode.type !== 'form') return
    setSubmitError(null)

    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, geojson: mode.geojson }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Something went wrong')
      }

      const community: Community = await res.json()
      setCommunities((prev) => [community, ...prev])
      setMode({ type: 'explore' })
      setClickedCommunities([community])
      setSelectedCommunity(community)
      setClicked(true)
      setSidebarOpen(true)

      const map = mapRef.current?.getMap()
      if (map) {
        const c = centroid(community.geojson).geometry.coordinates
        map.flyTo({ center: [c[0], c[1]], zoom: 14, duration: 600 })
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'An unexpected error occurred')
    }
  }, [mode])

  const handleSelectCommunity = useCallback((c: Community) => {
    setSelectedCommunity(c)
    setBrowseMode(false)
    const map = mapRef.current?.getMap()
    if (map) {
      const [minLng, minLat, maxLng, maxLat] = turfBbox(c.geojson) as [number, number, number, number]
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: { top: 80, bottom: 80, left: 80, right: 360 }, duration: 600, maxZoom: 15 }
      )
    }
  }, [])

  const handleDeleteCommunity = useCallback(async (id: string) => {
    const res = await fetch(`/api/communities/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setCommunities((prev) => prev.filter((c) => c.id !== id))
    setSelectedCommunity(null)
    setSidebarOpen(false)
    setClickMarker(null)
  }, [])

  const isDrawActive = mode.type === 'draw' || mode.type === 'form'
  const isPanelOpen = mode.type === 'form' || sidebarOpen || showAbout || browseMode

  const navBtnClass = 'shrink-0 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer'

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      {/* Tier 2 nudge banner */}
      {communities.length >= TIER2_THRESHOLD && (
        <div className="shrink-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 text-center">
          🏗 {communities.length} communities registered — someone tell Roman to tackle Tier 2 of the project plan to improve speed and security.
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 z-30 flex items-center gap-2 px-4 py-2 bg-white border-b">
        <Link
          href="/"
          onClick={() => { setSelectedCommunity(null); setShowAbout(false); setBrowseMode(false) }}
          className="font-bold text-gray-900 text-base tracking-tight shrink-0 cursor-pointer"
        >
          geographic<span className="text-blue-600">.</span>community
        </Link>
        <div className="flex-1 max-w-sm">
          <AddressSearch onSelect={handleAddressSelect} />
        </div>

        {mode.type === 'explore' && (
          <button
            onClick={() => { setBrowseMode(true); setSidebarOpen(true); setShowAbout(false); setSelectedCommunity(null) }}
            className={`${navBtnClass} border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300`}
          >
            All Communities
          </button>
        )}

        <button
          onClick={() => { setShowAbout(true); setSidebarOpen(true); setBrowseMode(false) }}
          className={`${navBtnClass} border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300`}
        >
          About
        </button>

        {mode.type === 'explore' ? (
          <button
            onClick={() => { setMode({ type: 'draw' }); setSidebarOpen(false); setSelectedCommunity(null); setShowAbout(false); setBrowseMode(false) }}
            className={`${navBtnClass} bg-blue-600 text-white hover:bg-blue-700`}
          >
            + Add A New Community
          </button>
        ) : (
          <button
            onClick={() => { setMode({ type: 'explore' }); setSubmitError(null) }}
            className={`${navBtnClass} bg-red-600 text-white hover:bg-red-700`}
          >
            Cancel
          </button>
        )}
      </header>

      {/* Everything below the header */}
      <div className="flex-1 relative overflow-hidden">
        {/* Draw mode instruction banner */}
        {mode.type === 'draw' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-xl shadow-lg px-4 py-3 text-sm text-gray-700 border max-w-md pointer-events-none">
            {mode.error ? (
              <span className="text-red-600">{mode.error}</span>
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
            onCommunityHover={setHoveredCommunity}
            onReady={() => setMapReady(true)}
            drawActive={isDrawActive}
            onDrawComplete={handleDrawComplete}
            selectedCommunityId={selectedCommunity?.id ?? null}
            clickMarker={clickMarker}
            className="w-full h-full"
          />
        </div>

        {/* Hover tooltip */}
        {hoveredCommunity && mode.type === 'explore' && !selectedCommunity && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/95 shadow-lg rounded-lg px-3 py-1.5 text-sm font-medium pointer-events-none">
            {hoveredCommunity.name}
          </div>
        )}

        {/* Right panel (desktop) */}
        <div
          className={`
            hidden md:flex flex-col absolute right-0 top-0 bottom-0 w-80 bg-white border-l shadow-xl z-20
            transition-transform duration-200
            ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {mode.type === 'form' ? (
            <RegisterSheet
              geojson={mode.geojson}
              onSubmit={handleRegisterSubmit}
              onBack={() => setMode({ type: 'draw' })}
              submitError={submitError}
            />
          ) : (
            <CommunitySidebar
              communities={clickedCommunities}
              allCommunities={communities}
              loading={sidebarLoading}
              clicked={clicked}
              selectedCommunity={selectedCommunity}
              showAbout={showAbout}
              browseMode={browseMode}
              onBrowseModeChange={setBrowseMode}
              onSelectCommunity={handleSelectCommunity}
              onDeleteCommunity={handleDeleteCommunity}
              onBack={() => setSelectedCommunity(null)}
              onClose={closeSidebar}
            />
          )}
        </div>

        {/* Bottom sheet (mobile) */}
        {isPanelOpen && (
          <div className="md:hidden absolute bottom-0 left-0 right-0 z-20 h-1/2 rounded-t-2xl shadow-2xl border-t bg-white overflow-hidden">
            {mode.type === 'form' ? (
              <RegisterSheet
                geojson={mode.geojson}
                onSubmit={handleRegisterSubmit}
                onBack={() => setMode({ type: 'draw' })}
                submitError={submitError}
              />
            ) : (
              <CommunitySidebar
                communities={clickedCommunities}
                allCommunities={communities}
                loading={sidebarLoading}
                clicked={clicked}
                selectedCommunity={selectedCommunity}
                showAbout={showAbout}
                browseMode={browseMode}
                onBrowseModeChange={setBrowseMode}
                onSelectCommunity={handleSelectCommunity}
                onDeleteCommunity={handleDeleteCommunity}
                onBack={() => setSelectedCommunity(null)}
                onClose={closeSidebar}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
