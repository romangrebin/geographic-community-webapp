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
  submitError?: string | null
  onBack?: () => void
  onClose?: () => void
}

export default function CommunitySidebar({
  communities,
  allCommunities = [],
  loading,
  clicked,
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
  submitError,
  onBack,
  onClose,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')

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
      />
    )
  }

  if (browseMode) {
    const filtered = allCommunities.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    return (
      <div className="flex flex-col h-full bg-panel">
        <div className={panelHeader}>
          <h2 className="font-semibold text-ink flex-1">All Communities</h2>
          {onClose && <button onClick={() => { onClose(); setSearchQuery('') }} className={closeBtn}>&times;</button>}
        </div>
        <div className="px-4 py-2.5 border-b border-line shrink-0 bg-panel">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full border border-line-input rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent bg-panel text-ink placeholder:text-ink-4 transition-shadow"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-ink-5 text-sm">No communities match your search.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { onBrowseModeChange?.(false); setSearchQuery(''); onSelectCommunity?.(c) }}
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
        {!loading && clicked && communities.length === 0 && (
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
              {c.email && <span className="text-accent">Email</span>}
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
}: {
  community: Community
  onBack?: () => void
  onDelete?: (id: string) => void
  onEdit?: () => void
  onClaim?: () => void
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
            {community.email && (
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
          {community.email && (
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
            <p className="text-xs text-ink-4 bg-panel border border-line rounded-lg px-3 py-2">
              Email: <span className="font-medium text-ink-3">{contactEmail}</span>
              {currentUser?.email && <span className="ml-1 text-accent">(from your account)</span>}
            </p>
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
          <strong className="text-ink">geographic.community</strong> is a map-first public directory
          for geographically-defined communities: neighborhood associations, block clubs, and similar
          organizations whose membership is solely determined by where you live.
        </p>
        <p>
          The product is a discovery tool, not a social network; there are no feeds, posts, or
          messaging, and no account is required to browse.
        </p>
        <p>
          Anybody is able to create a community, but any community created by non-authenticated users
          can be edited, claimed, or deleted by anyone. In order to register a stable community,
          sign-in (its easy!) with the public-facing email address that people should use to contact
          the community.
        </p>
        <p>
          Developed by{' '}
          <span className="font-mono text-xs bg-chip text-accent-text px-1.5 py-0.5 rounded border border-line">
            roman.b.grebin [at] gmail.com
          </span>
          {' '}— please reach out!
        </p>
      </div>
    </div>
  )
}
