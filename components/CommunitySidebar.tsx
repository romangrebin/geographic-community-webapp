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

  if (showAbout) {
    return <AboutPanel onClose={onClose} />
  }

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
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <button
            onClick={() => { onBrowseModeChange?.(false); setSearchQuery('') }}
            className="text-gray-400 hover:text-gray-600 text-sm shrink-0 cursor-pointer"
          >
            ←
          </button>
          <h2 className="font-semibold text-gray-900 flex-1 ml-3">All Communities</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">
              &times;
            </button>
          )}
        </div>
        <div className="px-4 py-2 border-b shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">No communities match your search.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { onBrowseModeChange?.(false); setSearchQuery(''); onSelectCommunity?.(c) }}
                className="w-full text-left block px-4 py-3 border-b hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-gray-900 leading-snug">{c.name}</span>
                  <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5">
                    {categoryLabel(c.category)}
                  </span>
                </div>
                {c.description && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-gray-900">
          {loading
            ? 'Searching…'
            : !clicked
            ? 'Click the map to explore'
            : communities.length > 0
            ? `${communities.length} communit${communities.length === 1 ? 'y' : 'ies'} here`
            : 'No communities here'}
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">
            &times;
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!loading && clicked && communities.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-gray-500 text-sm mb-1">No registered communities at this location.</p>
            <p className="text-gray-400 text-xs">Know of one? Register it using the button above.</p>
          </div>
        )}

        {!loading &&
          communities.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCommunity?.(c)}
              className="w-full text-left block px-4 py-3 border-b hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-gray-900 leading-snug">{c.name}</span>
                <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5">
                  {categoryLabel(c.category)}
                </span>
              </div>
              {c.description && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
              )}
              <div className="mt-1 flex gap-3 text-xs text-blue-600">
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
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        {onBack && (
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm shrink-0 cursor-pointer">
            ←
          </button>
        )}
        <h2 className="font-semibold text-gray-900 truncate flex-1">{community.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
          {categoryLabel(community.category)}
        </span>

        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Get Involved</p>
          {community.website && (
            <a
              href={community.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm break-all"
            >
              <span>🌐</span>
              <span>{community.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          {community.email && (
            <a
              href={`mailto:${community.email}`}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              <span>✉️</span>
              <span>{community.email}</span>
            </a>
          )}
        </div>

        {community.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{community.description}</p>
        )}

        <p className="text-xs text-gray-400">
          Registered {new Date(community.createdAt).toLocaleDateString()}
        </p>

        {/* Delete section */}
        {onDelete && !confirmingDelete && (
          <div className="pt-2 border-t">
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
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
              className="w-full border border-red-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
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
                className="flex-1 border border-gray-300 text-gray-600 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer"
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
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-gray-900">About</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">
            &times;
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm text-gray-600 leading-relaxed">
        <p>
          <strong>geographic.community</strong> is a map-first public directory for geographically-defined
          communities: neighborhood associations, block clubs, and similar organizations whose membership
          is solely determined by where you live.
        </p>
        <p>
          The product is a discovery tool, not a social network; there are no feeds, posts, or messaging,
          and no account is required to browse.
        </p>
        <p>
          Developed by roman.b.grebin [at] gmail.com. Please reach out!
        </p>
      </div>
    </div>
  )
}
