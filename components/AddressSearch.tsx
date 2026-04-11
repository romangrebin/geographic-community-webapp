'use client'

import { useState, useRef } from 'react'

type NominatimResult = {
  lat: string
  lon: string
  display_name: string
}

type Props = {
  onSelect: (lat: number, lng: number) => void
}

export default function AddressSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = async (q: string) => {
    if (q.length < 3) { setResults([]); return }
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const data: NominatimResult[] = await res.json()
      setResults(data)
      setOpen(true)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => search(val), 400)
  }

  const handleSelect = (r: NominatimResult) => {
    setQuery(r.display_name)
    setOpen(false)
    setResults([])
    onSelect(parseFloat(r.lat), parseFloat(r.lon))
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search for an address…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Searching…</div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(r)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b last:border-b-0 text-gray-800"
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
