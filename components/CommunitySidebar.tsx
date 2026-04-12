'use client'

import { useState } from 'react'
import type { Community } from '@/lib/types'

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

// Shared class fragments
const panelHeader = 'flex items-center justify-between px-4 py-3 border-b border-line bg-panel-2 shrink-0'
const closeBtn = 'text-ink-5 hover:text-ink-3 text-xl leading-none cursor-pointer transition-colors'
const backBtn = 'text-ink-5 hover:text-ink-2 text-sm shrink-0 cursor-pointer transition-colors'
const communityRow = 'w-full text-left block pl-3 pr-4 py-3 border-b border-line-sub hover:bg-panel-hover border-l-4 border-l-transparent hover:border-l-accent transition-all cursor-pointer'
const categoryBadge = 'shrink-0 text-xs bg-accent-chip text-accent-text px-2 py-0.5 rounded-full mt-0.5 font-medium'

type Props = {
  communities: Community[]
  allCommunities?: Community[]
  loading?: boolean
  clicked?: boolean
  selectedCommunity?: Community | null
  showAbout?: boolean
  browseMode?: boolean
  onBrowseModeChange?: (active: boolean) => void
  onSelectCommunity?: (c: Community) => void
  onDeleteCommunity?: (id: string) => void
  onBack?: () => void
  onClose?: () => void
}

export default function CommunitySidebar({
  communities,
  allCommunities = [],
  loading,
  clicked,
  selectedCommunity,
  showAbout,
  browseMode = false,
  onBrowseModeChange,
  onSelectCommunity,
  onDeleteCommunity,
  onBack,
  onClose,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')

  if (showAbout) return <AboutPanel onClose={onClose} />

  if (selectedCommunity) {
    return (
      <CommunityDetail
        community={selectedCommunity}
        onBack={onBack}
        onDelete={onDeleteCommunity ? (id) => onDeleteCommunity(id) : undefined}
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
          <button onClick={() => { onBrowseModeChange?.(false); setSearchQuery('') }} className={backBtn}>←</button>
          <h2 className="font-semibold text-ink flex-1 ml-3">All Communities</h2>
          {onClose && <button onClick={onClose} className={closeBtn}>&times;</button>}
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
            <div className="mt-1 flex gap-3 text-xs text-accent font-medium">
              {c.website && <span>Website ↗</span>}
              {c.email && <span>Email</span>}
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
}: {
  community: Community
  onBack?: () => void
  onDelete?: (id: string) => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete?.(community.id)
    setDeleting(false)
  }

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel-2 shrink-0">
        {onBack && <button onClick={onBack} className={backBtn}>←</button>}
        <h2 className="font-semibold text-ink truncate flex-1">{community.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <span className="inline-block text-xs bg-accent-chip text-accent-text px-2.5 py-1 rounded-full font-medium">
          {categoryLabel(community.category)}
        </span>

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

        {onDelete && !confirmingDelete && (
          <div className="pt-2 border-t border-line-sub">
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-ink-5 hover:text-red-500 transition-colors cursor-pointer"
            >
              Delete this community…
            </button>
          </div>
        )}

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
      </div>
    </div>
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
          The product is a discovery tool, not a social network; there are no feeds, posts, or messaging,
          and no account is required to browse.
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
