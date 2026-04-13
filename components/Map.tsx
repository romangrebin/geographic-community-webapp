'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'maplibre-gl-draw/dist/mapbox-gl-draw.css'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { Community } from '@/lib/types'

export type MapHandle = {
  getMap: () => maplibregl.Map | null
}

type DrawInstance = {
  getAll: () => { features: unknown[] }
  add: (f: unknown) => string[]
  deleteAll: () => void
  changeMode: (mode: string, options?: Record<string, unknown>) => void
}

type Props = {
  communities?: Community[]
  onMapClick?: (lat: number, lng: number) => void
  onCommunityHover?: (communities: Community[]) => void
  onReady?: () => void
  drawActive?: boolean
  onDrawComplete?: (feature: Feature<Polygon | MultiPolygon>) => void
  editGeojson?: Feature<Polygon | MultiPolygon> | null
  /** When set, this community is excluded from the fill layer (draw control renders it instead). */
  editingCommunityId?: string | null
  selectedCommunityId?: string | null
  clickMarker?: { lat: number; lng: number } | null
  className?: string
}

const COMMUNITY_SOURCE = 'communities'
const COMMUNITY_FILL_LAYER = 'community-fills'
const COMMUNITY_OUTLINE_LAYER = 'community-outlines'
const SELECTED_GLOW_LAYER = 'community-selected-glow'
const SELECTED_FILL_LAYER = 'community-selected-fill'
const SELECTED_OUTLINE_LAYER = 'community-selected-outline'
// Sentinel value used as a filter target when nothing is selected.
// We use a filter that will never match anything real.
const NO_SELECTION_FILTER = ['==', ['get', 'communityId'], '__none__'] as unknown as maplibregl.FilterSpecification

const VIEW_STORAGE_KEY = 'gc.mapView'
const DEFAULT_CENTER: [number, number] = [-93.265, 44.9778] // Minneapolis
const DEFAULT_ZOOM = 11

type SavedView = { center: [number, number]; zoom: number }

function loadSavedView(): SavedView | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedView
    if (
      Array.isArray(parsed.center) &&
      parsed.center.length === 2 &&
      typeof parsed.zoom === 'number'
    ) {
      return parsed
    }
  } catch {
    // ignore
  }
  return null
}

const Map = forwardRef<MapHandle, Props>(function Map(
  {
    communities = [],
    onMapClick,
    onCommunityHover,
    onReady,
    drawActive = false,
    onDrawComplete,
    editGeojson = null,
    editingCommunityId = null,
    selectedCommunityId = null,
    clickMarker = null,
    className = '',
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawRef = useRef<DrawInstance | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const hoveredIdsRef = useRef<string[]>([])
  const selectedIdRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
  }))

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const saved = loadSavedView()
    const startCenter = saved?.center ?? DEFAULT_CENTER
    const startZoom = saved?.zoom ?? DEFAULT_ZOOM

    const polyFill = '#0d9488'
    const polyOutline = '#0f766e'
    const polyFillOpacity = 0.08
    const polyFillOpacityHover = 0.22

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
          carto: {
            type: 'raster',
            tiles: [
              `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`,
              `https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`,
              `https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`,
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
      },
      center: startCenter,
      zoom: startZoom,
    })

    // Place controls top-LEFT so the right-side panel never obscures them.
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-left'
    )

    map.on('load', () => {
      map.addSource(COMMUNITY_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Base fill — all communities
      map.addLayer({
        id: COMMUNITY_FILL_LAYER,
        type: 'fill',
        source: COMMUNITY_SOURCE,
        paint: {
          'fill-color': polyFill,
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], polyFillOpacityHover, polyFillOpacity],
        },
      })

      // Base outline — all communities
      map.addLayer({
        id: COMMUNITY_OUTLINE_LAYER,
        type: 'line',
        source: COMMUNITY_SOURCE,
        paint: {
          'line-color': polyOutline,
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.5],
        },
      })

      // Selected layers — rendered on top, filtered by communityId property.
      // Filter-based highlighting is more reliable than feature-state for
      // GeoJSON sources with string (UUID) IDs.
      map.addLayer({
        id: SELECTED_GLOW_LAYER,
        type: 'line',
        source: COMMUNITY_SOURCE,
        filter: NO_SELECTION_FILTER,
        paint: {
          'line-color': '#f59e0b',
          'line-width': 12,
          'line-opacity': 0.45,
          'line-blur': 6,
        },
      })

      map.addLayer({
        id: SELECTED_FILL_LAYER,
        type: 'fill',
        source: COMMUNITY_SOURCE,
        filter: NO_SELECTION_FILTER,
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.4,
        },
      })

      map.addLayer({
        id: SELECTED_OUTLINE_LAYER,
        type: 'line',
        source: COMMUNITY_SOURCE,
        filter: NO_SELECTION_FILTER,
        paint: {
          'line-color': '#b45309',
          'line-width': 3.5,
        },
      })

      mapRef.current = map
      setMapReady(true)
      onReady?.()
    })

    // Persist viewport on user movement
    const handleMoveEnd = () => {
      const c = map.getCenter()
      const z = map.getZoom()
      try {
        localStorage.setItem(
          VIEW_STORAGE_KEY,
          JSON.stringify({ center: [c.lng, c.lat], zoom: z })
        )
      } catch {
        // ignore quota / unavailable
      }
    }
    map.on('moveend', handleMoveEnd)

    return () => {
      map.off('moveend', handleMoveEnd)
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync community polygons whenever data changes or map becomes ready.
  // Exclude the community currently being vertex-edited (draw control renders it).
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const source = mapRef.current.getSource(COMMUNITY_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    source.setData({
      type: 'FeatureCollection',
      features: communities
        .filter((c) => c.id !== editingCommunityId)
        .map((c) => ({
          ...c.geojson,
          id: c.id,
          properties: { ...c.geojson.properties, communityId: c.id, communityName: c.name },
        })),
    })
  }, [communities, editingCommunityId, mapReady])

  // Update the selected-layer filter when selectedCommunityId changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const filter = selectedCommunityId
      ? (['==', ['get', 'communityId'], selectedCommunityId] as unknown as maplibregl.FilterSpecification)
      : NO_SELECTION_FILTER

    map.setFilter(SELECTED_GLOW_LAYER, filter)
    map.setFilter(SELECTED_FILL_LAYER, filter)
    map.setFilter(SELECTED_OUTLINE_LAYER, filter)
    selectedIdRef.current = selectedCommunityId
  }, [selectedCommunityId, mapReady])

  // Click marker — shows where the user last queried.
  // Uses MapLibre's built-in SVG pin (teardrop shape, auto-anchored to bottom).
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return

    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }

    if (clickMarker) {
      markerRef.current = new maplibregl.Marker({ color: '#2563eb' })
        .setLngLat([clickMarker.lng, clickMarker.lat])
        .addTo(map)
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    }
  }, [clickMarker, mapReady])


  // Add/remove draw control
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return

    if (drawActive) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const MaplibreDraw = (require('maplibre-gl-draw').default ?? require('maplibre-gl-draw')) as {
        new (options: unknown): DrawInstance
      }
      const draw = new MaplibreDraw({
        displayControlsDefault: false,
        // Suppress trash when editing an existing polygon — deleting the feature
        // would leave the community with no boundary. Trash is only useful when
        // drawing a new polygon from scratch so the user can start over.
        controls: editGeojson ? {} : { trash: true },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addControl(draw as any, 'top-left')
      drawRef.current = draw

      if (editGeojson) {
        // Edit-boundary mode: load existing polygon and enter vertex editing
        const ids = draw.add(editGeojson)
        if (ids.length > 0) {
          draw.changeMode('direct_select', { featureId: ids[0] })
        }
      } else {
        // New polygon mode
        draw.changeMode('draw_polygon')
      }

      const onCreate = (e: { features: unknown[] }) => {
        const feature = e.features[0] as Feature<Polygon | MultiPolygon>
        if (feature) onDrawComplete?.(feature)
      }
      const onUpdate = (e: { features: unknown[] }) => {
        const feature = e.features[0] as Feature<Polygon | MultiPolygon>
        if (feature) onDrawComplete?.(feature)
      }

      map.on('draw.create', onCreate)
      map.on('draw.update', onUpdate)

      return () => {
        map.off('draw.create', onCreate)
        map.off('draw.update', onUpdate)
        if (drawRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.removeControl(draw as any)
          drawRef.current = null
        }
      }
    }
  }, [drawActive, editGeojson, mapReady, onDrawComplete])

  // Map click handler
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !onMapClick) return

    const handler = (e: maplibregl.MapMouseEvent) => {
      if (drawActive) return
      onMapClick(e.lngLat.lat, e.lngLat.lng)
    }
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [onMapClick, drawActive, mapReady])

  // Hover handler — uses queryRenderedFeatures on every mousemove so the tooltip
  // reliably clears when the cursor moves to empty space, and naturally handles
  // multiple overlapping community polygons.
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return

    const mousemoveHandler = (e: maplibregl.MapMouseEvent) => {
      if (drawActive) return

      const features = map.queryRenderedFeatures(e.point, { layers: [COMMUNITY_FILL_LAYER] })

      // Clear all previous hover states
      hoveredIdsRef.current.forEach((id) => {
        map.setFeatureState({ source: COMMUNITY_SOURCE, id }, { hover: false })
      })

      if (features.length > 0) {
        const ids = features
          .map((f) => f.properties?.communityId as string | undefined)
          .filter((id): id is string => !!id)
        hoveredIdsRef.current = ids
        ids.forEach((id) => {
          map.setFeatureState({ source: COMMUNITY_SOURCE, id }, { hover: true })
        })
        map.getCanvas().style.cursor = 'pointer'
        onCommunityHover?.(communities.filter((c) => ids.includes(c.id)))
      } else {
        hoveredIdsRef.current = []
        map.getCanvas().style.cursor = ''
        onCommunityHover?.([])
      }
    }

    map.on('mousemove', mousemoveHandler)
    return () => { map.off('mousemove', mousemoveHandler) }
  }, [communities, onCommunityHover, drawActive, mapReady])

  return <div ref={containerRef} className={`w-full h-full ${className}`} />
})

export default Map
