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

const MAX_AREA_KM2 = 1000

type Mode =
  | { type: 'explore' }
  | { type: 'draw'; error?: string }
  | { type: 'form'; geojson: Feature<Polygon | MultiPolygon> }

type Props = {
  initialCommunities: Community[]
  initialSelectedCommunity?: Community | null
  initialMode?: 'explore' | 'draw'
}

export default function MapPage({
  initialCommunities,
  initialSelectedCommunity = null,
  initialMode = 'explore',
}: Props) {
  const [communities, setCommunities] = useState<Community[]>(initialCommunities)
  const [mode, setMode] = useState<Mode>(
    initialMode === 'draw' ? { type: 'draw' } : { type: 'explore' }
  )
  const [clickMarker, setClickMarker] = useState<{ lat: number; lng: number } | null>(null)

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(Boolean(initialSelectedCommunity))
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [clicked, setClicked] = useState(Boolean(initialSelectedCommunity))
  const [clickedCommunities, setClickedCommunities] = useState<Community[]>(
    initialSelectedCommunity ? [initialSelectedCommunity] : []
  )
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(
    initialSelectedCommunity
  )
  const [hoveredCommunity, setHoveredCommunity] = useState<Community | null>(null)

  // Register state
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<MapHandle>(null)

  // Keep the browser URL in sync with the current app state, without full reload
  useEffect(() => {
    if (typeof window === 'undefined') return
    let target = '/'
    if (mode.type === 'draw' || mode.type === 'form') {
      target = '/register'
    } else if (selectedCommunity) {
      target = `/c/${selectedCommunity.slug}`
    }
    if (window.location.pathname !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [selectedCommunity, mode.type])

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
  }, [handleMapClick, initialSelectedCommunity])

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

      // Fly to the new community
      const map = mapRef.current?.getMap()
      if (map) {
        const c = centroid(community.geojson).geometry.coordinates
        map.flyTo({ center: [c[0], c[1]], zoom: 14, duration: 600 })
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'An unexpected error occurred')
    }
  }, [mode])

  const isDrawActive = mode.type === 'draw' || mode.type === 'form'
  const isPanelOpen = mode.type === 'form' || sidebarOpen

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      {/* Header — natural height, shrink-0 so it never collapses */}
      <header className="shrink-0 z-30 flex items-center gap-3 px-4 py-2 bg-white border-b">
        <Link href="/" onClick={() => setSelectedCommunity(null)} className="font-bold text-gray-900 text-base tracking-tight shrink-0">
          geographic<span className="text-blue-600">.</span>community
        </Link>
        <div className="flex-1 max-w-sm">
          <AddressSearch onSelect={handleAddressSelect} />
        </div>
        {mode.type === 'explore' ? (
          <button
            onClick={() => { setMode({ type: 'draw' }); setSidebarOpen(false); setSelectedCommunity(null) }}
            className="shrink-0 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Register
          </button>
        ) : (
          <button
            onClick={() => { setMode({ type: 'explore' }); setSubmitError(null) }}
            className="shrink-0 text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </header>

      {/* Everything below the header lives in this flex-1 container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Draw mode instruction banner */}
        {mode.type === 'draw' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-xl shadow-lg px-4 py-3 text-sm text-gray-700 border max-w-md pointer-events-none">
            {mode.error ? (
              <span className="text-red-600">{mode.error}</span>
            ) : (
              <ol className="space-y-1 list-decimal list-inside">
                <li>Click the <strong>polygon tool</strong> in the top-left toolbar</li>
                <li>Click the map to place points around your community</li>
                <li>Click the <strong>first point</strong> again (or double-click) to close the shape</li>
              </ol>
            )}
          </div>
        )}

        {/* Map — fills the flex-1 container */}
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
            loading={sidebarLoading}
            clicked={clicked}
            selectedCommunity={selectedCommunity}
            onSelectCommunity={(c) => { setSelectedCommunity(c); setClickMarker(null) }}
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
                loading={sidebarLoading}
                clicked={clicked}
                selectedCommunity={selectedCommunity}
                onSelectCommunity={(c) => { setSelectedCommunity(c); setClickMarker(null) }}
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
