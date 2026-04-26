'use client'

import { useState } from 'react'
import type { Community, CommunityInput } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

const KNOWN_CATEGORY_LABELS: Record<string, string> = {
  neighborhood_association: 'Neighborhood Association',
  block_club: 'Block Club',
  hoa: 'HOA',
  watershed: 'Watershed',
  parish: 'Parish',
  school_zone: 'School Zone',
  other: 'Other',
}

function categoryLabel(category: string): string {
  return KNOWN_CATEGORY_LABELS[category] ?? category
}

// Shared components
function StewardBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
      <span aria-hidden>✓</span> Steward
    </span>
  )
}

// Shared class fragments
const panelHeader = 'flex items-center justify-between px-4 py-3 border-b border-line bg-panel-2 shrink-0'
const closeBtn = 'text-ink-5 hover:text-ink-3 text-xl leading-none cursor-pointer transition-colors'
const backBtn = 'text-ink-5 hover:text-ink-2 text-sm shrink-0 cursor-pointer transition-colors'
const communityRow = 'w-full text-left block pl-3 pr-4 py-3 border-b border-line-sub hover:bg-panel-hover border-l-4 border-l-transparent hover:border-l-accent transition-all cursor-pointer'
const categoryBadge = 'shrink-0 text-xs bg-accent-chip text-accent-text px-2 py-0.5 rounded-full mt-0.5 font-medium'
const inputClass = 'w-full border border-line-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent bg-panel text-ink placeholder:text-ink-4 transition-shadow'
const labelClass = 'block text-xs text-ink-4 mb-1'

type Props = {
  communities: Community[]
  allCommunities?: Community[]
  loading?: boolean
  clicked?: boolean
  offline?: boolean
  selectedCommunity?: Community | null
  editingCommunity?: Community | null
  showAbout?: boolean
  browseMode?: boolean
  currentUser?: User | null
  onBrowseModeChange?: (active: boolean) => void
  onSelectCommunity?: (c: Community) => void
  onDeleteCommunity?: (id: string) => void
  onEditCommunity?: (c: Community) => void
  onCancelEdit?: () => void
  onUpdateCommunity?: (id: string, data: Partial<CommunityInput>) => Promise<void>
  onClaimCommunity?: (id: string) => Promise<void>
  onReleaseStewardship?: (id: string) => Promise<void>
  submitError?: string | null
  onBack?: () => void
  onClose?: () => void
}

export default function CommunitySidebar({
  communities,
  allCommunities = [],
  loading,
  clicked,
  offline = false,
  selectedCommunity,
  editingCommunity,
  showAbout,
  browseMode = false,
  currentUser,
  onBrowseModeChange,
  onSelectCommunity,
  onDeleteCommunity,
  onEditCommunity,
  onCancelEdit,
  onUpdateCommunity,
  onClaimCommunity,
  onReleaseStewardship,
  submitError,
  onBack,
  onClose,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'neighborhood_association' | 'other'>('all')

  if (showAbout) return <AboutPanel onClose={onClose} />

  if (editingCommunity) {
    return (
      <EditCommunityPanel
        community={editingCommunity}
        currentUser={currentUser}
        onCancel={onCancelEdit}
        onSave={onUpdateCommunity}
        submitError={submitError ?? null}
      />
    )
  }

  if (selectedCommunity) {
    const isOwner = !!(currentUser && selectedCommunity.claimedBy === currentUser.id)
    const canEdit = !selectedCommunity.claimedBy || isOwner
    const canClaim = !selectedCommunity.claimedBy && !!currentUser
    return (
      <CommunityDetail
        community={selectedCommunity}
        onBack={onBack}
        onDelete={canEdit && onDeleteCommunity ? (id) => onDeleteCommunity(id) : undefined}
        onEdit={canEdit && onEditCommunity ? () => onEditCommunity(selectedCommunity) : undefined}
        onClaim={canClaim && onClaimCommunity ? () => onClaimCommunity(selectedCommunity.id) : undefined}
        onReleaseStewardship={isOwner && onReleaseStewardship ? () => onReleaseStewardship(selectedCommunity.id) : undefined}
      />
    )
  }

  if (browseMode) {
    const filtered = allCommunities.filter((c) => {
      if (categoryFilter === 'neighborhood_association' && c.category !== 'neighborhood_association') return false
      if (categoryFilter === 'other' && c.category === 'neighborhood_association') return false
      const q = searchQuery.toLowerCase()
      return c.name.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
    })
    return (
      <div className="flex flex-col h-full bg-panel">
        <div className={panelHeader}>
          <h2 className="font-semibold text-ink flex-1">All Communities</h2>
          {onClose && <button onClick={() => { onClose(); setSearchQuery(''); setCategoryFilter('all') }} className={closeBtn}>&times;</button>}
        </div>
        <div className="px-4 pt-2.5 pb-2 border-b border-line shrink-0 bg-panel space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full border border-line-input rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent bg-panel text-ink placeholder:text-ink-4 transition-shadow"
          />
          <div className="flex gap-1.5">
            {(['all', 'neighborhood_association', 'other'] as const).map((val) => (
              <button
                key={val}
                onClick={() => setCategoryFilter(val)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  categoryFilter === val
                    ? 'bg-accent text-white'
                    : 'bg-chip text-ink-3 hover:bg-panel-hover'
                }`}
              >
                {val === 'all' ? 'All' : val === 'neighborhood_association' ? 'Neighborhood Assoc.' : 'Other'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-ink-5 text-sm">No communities match your search.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSearchQuery(''); onSelectCommunity?.(c) }}
                className={communityRow}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-ink leading-snug">{c.name}</span>
                  <span className={categoryBadge}>{categoryLabel(c.category)}</span>
                </div>
                {c.description && (
                  <p className="text-sm text-ink-4 mt-0.5 line-clamp-2">{c.description}</p>
                )}
                {c.claimedBy && (
                  <div className="mt-1"><StewardBadge /></div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className={panelHeader}>
        <h2 className="font-semibold text-ink">
          {loading
            ? 'Searching…'
            : !clicked
            ? 'Click the map to explore'
            : communities.length > 0
            ? `${communities.length} communit${communities.length === 1 ? 'y' : 'ies'} here`
            : 'No communities here'}
        </h2>
        {onClose && <button onClick={onClose} className={closeBtn}>&times;</button>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!loading && clicked && offline && (
          <div className="p-6 text-center">
            <p className="text-ink-3 text-sm mb-1">You appear to be offline.</p>
            <p className="text-ink-5 text-xs">Reconnect and try again.</p>
          </div>
        )}
        {!loading && clicked && !offline && communities.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-ink-3 text-sm mb-1">No registered communities at this location.</p>
            <p className="text-ink-5 text-xs">Know of one? Add it using the button above.</p>
          </div>
        )}
        {!loading && communities.map((c) => (
          <button key={c.id} onClick={() => onSelectCommunity?.(c)} className={communityRow}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-ink leading-snug">{c.name}</span>
              <span className={categoryBadge}>{categoryLabel(c.category)}</span>
            </div>
            {c.description && (
              <p className="text-sm text-ink-4 mt-0.5 line-clamp-2">{c.description}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs font-medium">
              {c.website && <span className="text-accent">Website ↗</span>}
              {c.email && c.emailPublic && <span className="text-accent">Email</span>}
              {c.claimedBy && <StewardBadge />}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function CommunityDetail({
  community,
  onBack,
  onDelete,
  onEdit,
  onClaim,
  onReleaseStewardship,
}: {
  community: Community
  onBack?: () => void
  onDelete?: (id: string) => void
  onEdit?: () => void
  onClaim?: () => void
  onReleaseStewardship?: () => Promise<void>
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportEmail, setReportEmail] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [confirmingRelease, setConfirmingRelease] = useState(false)
  const [releasing, setReleasing] = useState(false)

  const handleReleaseStewardship = async () => {
    setReleasing(true)
    await onReleaseStewardship?.()
    setReleasing(false)
    setConfirmingRelease(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete?.(community.id)
    setDeleting(false)
  }

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportReason.trim()) return
    setReportSubmitting(true)
    setReportError(null)
    try {
      const res = await fetch(`/api/communities/${community.id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason.trim(), reporter_email: reportEmail.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to submit report')
      }
      setReportDone(true)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setReportSubmitting(false)
    }
  }

  const handleClaim = async () => {
    setClaiming(true)
    await onClaim?.()
    setClaiming(false)
  }

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-panel-2 shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="shrink-0 flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink px-2 py-1 rounded-lg hover:bg-panel-hover transition-colors cursor-pointer"
          >
            ← Back
          </button>
        )}
        <h2 className="font-semibold text-ink truncate flex-1">{community.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block text-xs bg-accent-chip text-accent-text px-2.5 py-1 rounded-full font-medium">
            {categoryLabel(community.category)}
          </span>
          {community.claimedBy && <StewardBadge />}
        </div>

        {/* Steward trust card */}
        {community.claimedBy && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Active Steward</p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              This community has a verified steward who keeps its listing accurate and up to date.
            </p>
            {community.email && community.emailPublic && (
              <p className="text-xs text-emerald-600 font-medium pt-0.5">{community.email}</p>
            )}
          </div>
        )}

        {/* Get Involved */}
        <div className="bg-accent-dim border border-accent-rim rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-accent-text uppercase tracking-wider">Get Involved</p>
          {community.website && (
            <a
              href={community.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-accent-text hover:text-accent-hi text-sm break-all font-medium transition-colors"
            >
              <span>🌐</span>
              <span>{community.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          {community.email && community.emailPublic && (
            <a
              href={`mailto:${community.email}`}
              className="flex items-center gap-2 text-accent-text hover:text-accent-hi text-sm font-medium transition-colors"
            >
              <span>✉️</span>
              <span>{community.email}</span>
            </a>
          )}
        </div>

        {community.description && (
          <p className="text-sm text-ink-3 leading-relaxed">{community.description}</p>
        )}

        <p className="text-xs text-ink-5">
          Registered {new Date(community.createdAt).toLocaleDateString()}
          {community.updatedAt && (
            <> &middot; Last updated {new Date(community.updatedAt).toLocaleDateString()}</>
          )}
        </p>

        {/* Edit / Delete / Claim actions */}
        <div className="pt-2 border-t border-line-sub space-y-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="block text-xs text-accent hover:text-accent-hi transition-colors cursor-pointer font-medium"
            >
              Edit this community…
            </button>
          )}

          {onClaim && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="block text-xs text-accent hover:text-accent-hi transition-colors cursor-pointer font-medium disabled:opacity-50"
            >
              {claiming ? 'Claiming…' : 'Claim this community…'}
            </button>
          )}

          {onReleaseStewardship && !confirmingRelease && (
            <button
              onClick={() => setConfirmingRelease(true)}
              className="block text-xs text-ink-5 hover:text-red-500 transition-colors cursor-pointer"
            >
              Release stewardship…
            </button>
          )}

          {onDelete && !confirmingDelete && (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="block text-xs text-ink-5 hover:text-red-500 transition-colors cursor-pointer"
            >
              Delete this community…
            </button>
          )}
        </div>

        {confirmingDelete && (
          <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50">
            <p className="text-sm font-medium text-red-700">Delete community?</p>
            <p className="text-xs text-red-600">
              This is permanent. Type <strong>{community.name}</strong> to confirm.
            </p>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={community.name}
              className="w-full border border-red-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white text-stone-900"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={confirmName !== community.name || deleting}
                className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => { setConfirmingDelete(false); setConfirmName('') }}
                className="flex-1 border border-line text-ink-2 py-1.5 rounded-lg text-sm hover:bg-panel-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {confirmingRelease && (
          <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50">
            <p className="text-sm font-medium text-red-700">Release stewardship?</p>
            <p className="text-xs text-red-600 leading-relaxed">
              You will no longer be the steward of this community. Anyone will be able to edit it until a new steward claims it.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReleaseStewardship}
                disabled={releasing}
                className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {releasing ? 'Releasing…' : 'Release stewardship'}
              </button>
              <button
                onClick={() => setConfirmingRelease(false)}
                className="flex-1 border border-line text-ink-2 py-1.5 rounded-lg text-sm hover:bg-panel-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Report section */}
        <div className="pt-2 border-t border-line-sub">
          {!reportOpen && !reportDone && (
            <button
              onClick={() => setReportOpen(true)}
              className="block text-xs text-ink-5 hover:text-ink-3 transition-colors cursor-pointer"
            >
              Report this listing…
            </button>
          )}

          {reportDone && (
            <p className="text-xs text-ink-4 bg-panel-2 border border-line rounded-lg px-3 py-2">
              Thanks — we'll review this listing.
            </p>
          )}

          {reportOpen && !reportDone && (
            <form onSubmit={handleReport} className="space-y-2 mt-2">
              <p className="text-xs font-medium text-ink-3">Report this listing</p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="What's the issue? (spam, inaccurate info, impersonation…)"
                rows={3}
                maxLength={2000}
                required
                className={`${inputClass} resize-none text-xs`}
              />
              <input
                type="email"
                value={reportEmail}
                onChange={(e) => setReportEmail(e.target.value)}
                placeholder="Your email (optional)"
                className={`${inputClass} text-xs`}
              />
              {reportError && (
                <p className="text-xs text-red-600">{reportError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!reportReason.trim() || reportSubmitting}
                  className="flex-1 bg-accent text-white py-1.5 rounded-lg text-xs font-medium hover:bg-accent-hi transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {reportSubmitting ? 'Submitting…' : 'Submit report'}
                </button>
                <button
                  type="button"
                  onClick={() => { setReportOpen(false); setReportReason(''); setReportEmail(''); setReportError(null) }}
                  className="flex-1 border border-line text-ink-2 py-1.5 rounded-lg text-xs hover:bg-panel-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function EditCommunityPanel({
  community,
  currentUser,
  onCancel,
  onSave,
  submitError,
}: {
  community: Community
  currentUser?: User | null
  onCancel?: () => void
  onSave?: (id: string, data: Partial<CommunityInput>) => Promise<void>
  submitError: string | null
}) {
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description ?? '')
  const [category, setCategory] = useState(community.category)
  const [categoryOther, setCategoryOther] = useState(
    community.category === 'neighborhood_association' ? '' : community.category
  )
  const [categoryChoice, setCategoryChoice] = useState<'neighborhood_association' | 'other'>(
    community.category === 'neighborhood_association' ? 'neighborhood_association' : 'other'
  )
  const [website, setWebsite] = useState(community.website ?? '')
  const [emailPublic, setEmailPublic] = useState(community.emailPublic)
  const [saving, setSaving] = useState(false)

  // Email: use auth email if signed in, otherwise preserve existing community email
  const contactEmail = currentUser?.email ?? community.email ?? null

  const resolvedCategory = categoryChoice === 'neighborhood_association'
    ? 'neighborhood_association'
    : categoryOther.trim() || 'other'

  const hasContact = website.trim() !== '' || !!contactEmail
  const canSave = name.trim() !== '' && hasContact && !saving &&
    (categoryChoice !== 'other' || categoryOther.trim() !== '')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave || !onSave) return
    setSaving(true)
    await onSave(community.id, {
      name: name.trim(),
      description: description.trim() || null,
      category: resolvedCategory,
      website: website.trim() || null,
      email: contactEmail,
      emailPublic: contactEmail ? emailPublic : true,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full bg-panel">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel-2 shrink-0">
        {onCancel && <button type="button" onClick={onCancel} className={backBtn}>← Cancel</button>}
        <h2 className="font-semibold text-ink flex-1">Edit Community</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className={labelClass}>Name <span className="text-red-500">*</span></label>
          <input
            type="text" required value={name}
            onChange={(e) => setName(e.target.value)}
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
                {val === 'neighborhood_association' ? 'Neighborhood Assoc.' : 'Other'}
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
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="border border-line rounded-xl p-4 space-y-3 bg-panel-2">
          <p className="text-sm font-medium text-ink-2">
            Contact <span className="text-red-500">*</span>
            <span className="font-normal text-ink-5 ml-1">at least one</span>
          </p>
          <div>
            <label className={labelClass}>Website</label>
            <input
              type="text" value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.com"
              className={inputClass}
            />
          </div>
          {contactEmail ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-4 bg-panel border border-line rounded-lg px-3 py-2">
                Email: <span className="font-medium text-ink-3">{contactEmail}</span>
                {currentUser?.email && <span className="ml-1 text-accent">(from your account)</span>}
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
            <p className="text-xs text-ink-5">Sign in to add a contact email.</p>
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
        <p className="text-xs text-ink-5 text-center">
          Drag the boundary vertices on the map to adjust the shape.
        </p>
        <button
          type="submit" disabled={!canSave}
          className="w-full bg-accent text-white py-2.5 rounded-xl font-semibold hover:bg-accent-hi transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function AboutPanel({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-panel">
      <div className={panelHeader}>
        <h2 className="font-semibold text-ink">About</h2>
        {onClose && <button onClick={onClose} className={closeBtn}>&times;</button>}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm text-ink-3 leading-relaxed">
        <p> 
          Click a point on the map, enter an address, or browse All Communities to discover communities.
        </p>
        <p>
          <strong className="text-ink">geographic.community</strong> is a map-first public directory
          for discovering geographically-defined communities: neighborhood associations, block clubs,
          and similar organizations whose membership is solely determined by where you live (or work).
        </p>
        <p>
          The product is a discovery tool, not a social network; there are no feeds, posts, or
          messaging, and no account is required to browse.
        </p>
        <p>
          Anybody can register a community, but only communities registered or claimed by a signed-in user
          are stable and safe from anonymous edits or updates. If registering your community, sign-in (its easy!)
          with the public-facing email address that members should use to contact community steward(s).
        </p>
        <p>
          Developed by{' '}
          <span className="font-mono text-xs bg-chip text-accent-text px-1.5 py-0.5 rounded border border-line">
            roman.b.grebin [at] gmail.com
          </span>
          {' '}— please reach out!
        </p>
        <p>
          <a
            href="https://github.com/romangrebin/geographic-community-webapp"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-accent hover:text-accent-hi font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            View source on GitHub
          </a>
        </p>
      </div>
    </div>
  )
}
