'use client'

import { useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { CommunityCategory } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { area } from '@turf/turf'

type Props = {
  geojson: Feature<Polygon | MultiPolygon>
  onSubmit: (data: {
    name: string
    description: string | null
    category: CommunityCategory
    website: string | null
    email: string | null
    emailPublic: boolean
  }) => Promise<void>
  onBack: () => void
  submitError: string | null
  currentUser?: User | null
}

type UrlResult =
  | { ok: true; value: null }
  | { ok: true; value: string }
  | { ok: false; error: string }

function normalizeUrl(raw: string): UrlResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    if (!url.hostname.includes('.')) {
      return { ok: false, error: 'Please enter a valid website (e.g. example.com)' }
    }
    return { ok: true, value: url.toString() }
  } catch {
    return { ok: false, error: 'Please enter a valid website (e.g. example.com)' }
  }
}

const inputClass = 'w-full border border-line-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent bg-panel text-ink placeholder:text-ink-4 transition-shadow'
const labelClass = 'block text-sm font-medium text-ink-2 mb-1'

export default function RegisterSheet({ geojson, onSubmit, onBack, submitError, currentUser }: Props) {
  const authEmail = currentUser?.email ?? null
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryChoice, setCategoryChoice] = useState<'neighborhood_association' | 'other'>('neighborhood_association')
  const [categoryOther, setCategoryOther] = useState('')
  const [website, setWebsite] = useState('')
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [emailPublic, setEmailPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const category: CommunityCategory =
    categoryChoice === 'neighborhood_association'
      ? 'neighborhood_association'
      : categoryOther.trim() || 'other'

  const hasContact = website.trim() !== '' || !!authEmail
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
    if (!websiteResult.ok) { setWebsiteError(websiteResult.error); return }
    setSubmitting(true)
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      category,
      website: websiteResult.value,
      email: authEmail,
      emailPublic: authEmail ? emailPublic : true,
    })
    setSubmitting(false)
  }

  const areaSqKm = (area(geojson) / 1_000_000).toFixed(2)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-panel">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel-2 shrink-0">
        <button type="button" onClick={onBack} className="text-ink-5 hover:text-ink-2 text-sm cursor-pointer transition-colors">
          ← Redraw
        </button>
        <h2 className="font-semibold text-ink flex-1">Community details</h2>
        <span className="text-xs text-ink-3 bg-chip px-2 py-0.5 rounded-full">{areaSqKm} km²</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className={labelClass}>Name <span className="text-red-500">*</span></label>
          <input
            type="text" required value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Elmwood Neighborhood Association"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Type</label>
          <div className="flex gap-2">
            {(['neighborhood_association', 'other'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setCategoryChoice(val)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                  categoryChoice === val
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-panel text-ink-2 border-line-input hover:bg-panel-2'
                }`}
              >
                {val === 'neighborhood_association' ? 'Neighborhood Association' : 'Other'}
              </button>
            ))}
          </div>
          {categoryChoice === 'other' && (
            <input
              type="text" value={categoryOther}
              onChange={(e) => setCategoryOther(e.target.value)}
              placeholder="e.g. Block Club, Watershed District…"
              className={`mt-2 ${inputClass}`}
              required
            />
          )}
        </div>

        <div>
          <label className={labelClass}>Description <span className="text-ink-5 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does your community do? How can residents get involved?"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="border border-line rounded-xl p-4 space-y-3 bg-panel-2">
          <p className="text-sm font-medium text-ink-2">
            Contact <span className="text-red-500">*</span>
            <span className="font-normal text-ink-5 ml-1">at least one</span>
          </p>
          <div>
            <label className="block text-xs text-ink-4 mb-1">Website</label>
            <input
              type="text" value={website}
              onChange={(e) => { setWebsite(e.target.value); if (websiteError) setWebsiteError(null) }}
              onBlur={validateWebsite}
              placeholder="example.com"
              className={`${inputClass} ${websiteError ? 'border-red-400 focus:ring-red-500 focus:border-red-400' : ''}`}
            />
            {websiteError && <p className="text-xs text-red-500 mt-1">{websiteError}</p>}
          </div>
          {authEmail ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-4 bg-panel border border-line rounded-lg px-3 py-2">
                Email: <span className="font-medium text-ink-3">{authEmail}</span>
                <span className="ml-1 text-accent">(from your account)</span>
              </p>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailPublic}
                  onChange={(e) => setEmailPublic(e.target.checked)}
                  className="rounded border-line-input accent-accent"
                />
                <span className="text-xs text-ink-3">Show email address publicly on this listing</span>
              </label>
            </div>
          ) : (
            <p className="text-xs text-ink-5">
              Sign in to add a contact email to this listing.
            </p>
          )}
          {!hasContact && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              Provide a website or email so residents can reach you.
            </p>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-line shrink-0 space-y-2">
        {!authEmail && (
          <p className="text-xs text-red-400 text-center">
            Tip: sign in first (button above on navbar) so only you can edit or remove this listing.
          </p>
        )}
        <button
          type="submit" disabled={!canSubmit}
          className="w-full bg-accent text-white py-2.5 rounded-xl font-semibold hover:bg-accent-hi transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {submitting ? 'Registering…' : 'Register community'}
        </button>
      </div>
    </form>
  )
}
