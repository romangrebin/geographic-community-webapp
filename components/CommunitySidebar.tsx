'use client'

import type { Community } from '@/lib/types'

const CATEGORY_LABELS: Record<Community['category'], string> = {
  neighborhood_association: 'Neighborhood Association',
  block_club: 'Block Club',
  hoa: 'HOA',
  watershed: 'Watershed',
  parish: 'Parish',
  school_zone: 'School Zone',
  other: 'Other',
}

type Props = {
  communities: Community[]
  loading?: boolean
  clicked?: boolean
  selectedCommunity?: Community | null
  onSelectCommunity?: (c: Community) => void
  onBack?: () => void
  onClose?: () => void
}

export default function CommunitySidebar({
  communities,
  loading,
  clicked,
  selectedCommunity,
  onSelectCommunity,
  onBack,
  onClose,
}: Props) {
  if (selectedCommunity) {
    return <CommunityDetail community={selectedCommunity} onBack={onBack} />
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
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
              className="w-full text-left block px-4 py-3 border-b hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-gray-900 leading-snug">{c.name}</span>
                <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5">
                  {CATEGORY_LABELS[c.category]}
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

function CommunityDetail({ community, onBack }: { community: Community; onBack?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        {onBack && (
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm shrink-0">
            ←
          </button>
        )}
        <h2 className="font-semibold text-gray-900 truncate flex-1">{community.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
          {CATEGORY_LABELS[community.category]}
        </span>

        {community.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{community.description}</p>
        )}

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

        <p className="text-xs text-gray-400">
          Registered {new Date(community.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}
