import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-canvas text-center px-4">
      <Link href="/" className="mb-8 hover:opacity-80 transition-opacity">
        <img src="/icon.svg" alt="geographic.community" className="w-12 h-12 rounded-xl mx-auto mb-3" />
        <span className="font-bold text-ink text-lg tracking-tight">
          geographic<span className="text-accent">.</span>community
        </span>
      </Link>
      <h1 className="text-4xl font-bold text-ink mb-2">404</h1>
      <p className="text-ink-3 mb-6">This page doesn't exist.</p>
      <Link
        href="/"
        className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hi transition-colors shadow-sm"
      >
        Back to the map
      </Link>
    </div>
  )
}
