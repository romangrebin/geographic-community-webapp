'use client'

import { useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { CommunityCategory } from '@/lib/types'
import { area } from '@turf/turf'

type Props = {
  /** The drawn polygon — passed in from the parent which owns draw state */
  geojson: Feature<Polygon | MultiPolygon>
  onSubmit: (data: {
    name: string
    description: string | null
    category: CommunityCategory
    website: string | null
    email: string | null
  }) => Promise<void>
  onBack: () => void
  submitError: string | null
}

type UrlResult =
  | { ok: true; value: null }           // empty input — valid, no URL
  | { ok: true; value: string }         // valid URL, normalized
  | { ok: false; error: string }        // invalid URL

/**
 * Accepts a URL with or without protocol, prepends https:// if missing,
 * and verifies that the result parses as a real URL with a proper hostname.
 */
function normalizeUrl(raw: string): UrlResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    // Require at least one dot in the hostname — rules out "foo", "localhost", etc.
    if (!url.hostname.includes('.')) {
      return { ok: false, error: 'Please enter a valid website (e.g. example.com)' }
    }
    return { ok: true, value: url.toString() }
  } catch {
    return { ok: false, error: 'Please enter a valid website (e.g. example.com)' }
  }
}

export default function RegisterSheet({ geojson, onSubmit, onBack, submitError }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryChoice, setCategoryChoice] = useState<'neighborhood_association' | 'other'>('neighborhood_association')
  const [categoryOther, setCategoryOther] = useState('')
  const [website, setWebsite] = useState('')
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const category: CommunityCategory =
    categoryChoice === 'neighborhood_association'
      ? 'neighborhood_association'
      : categoryOther.trim() || 'other'

  const hasContact = website.trim() !== '' || email.trim() !== ''
  const canSubmit = name.trim() !== '' && hasContact && !submitting && !websiteError &&
    (categoryChoice !== 'other' || categoryOther.trim() !== '')

  const validateWebsite = () => {
    const result = normalizeUrl(website)
    setWebsiteError(result.ok ? null : result.error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    const websiteResult = normalizeUrl(website)
    if (!websiteResult.ok) {
      setWebsiteError(websiteResult.error)
      return
    }

    setSubmitting(true)
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      category,
      website: websiteResult.value,
      email: email.trim() || null,
    })
    setSubmitting(false)
  }

  const areaSqKm = (area(geojson) / 1_000_000).toFixed(2)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Redraw
        </button>
        <h2 className="font-semibold text-gray-900 flex-1">Community details</h2>
        <span className="text-xs text-gray-400">{areaSqKm} km²</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Elmwood Neighborhood Association"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCategoryChoice('neighborhood_association')}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                categoryChoice === 'neighborhood_association'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Neighborhood Association
            </button>
            <button
              type="button"
              onClick={() => setCategoryChoice('other')}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                categoryChoice === 'other'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Other
            </button>
          </div>
          {categoryChoice === 'other' && (
            <input
              type="text"
              value={categoryOther}
              onChange={(e) => setCategoryOther(e.target.value)}
              placeholder="e.g. Block Club, Watershed District…"
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does your community do? How can residents get involved?"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Contact <span className="text-red-500">*</span>
            <span className="font-normal text-gray-400 ml-1">at least one</span>
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => { setWebsite(e.target.value); if (websiteError) setWebsiteError(null) }}
              onBlur={validateWebsite}
              placeholder="example.com"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                websiteError ? 'border-red-400 focus:ring-red-500' : 'focus:ring-blue-500'
              }`}
            />
            {websiteError && <p className="text-xs text-red-600 mt-1">{websiteError}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {!hasContact && (
            <p className="text-xs text-amber-600">Provide a website or email so residents can reach you.</p>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}
      </div>

      <div className="px-4 py-3 border-t shrink-0">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Registering…' : 'Register community'}
        </button>
      </div>
    </form>
  )
}
