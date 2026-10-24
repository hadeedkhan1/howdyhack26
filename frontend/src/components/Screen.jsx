import BottomNav from './BottomNav'

// Shared page wrapper: title, padding, optional bottom nav.
export default function Screen({ title, children, nav = false }) {
  return (
    <main className={`px-4 pt-6 ${nav ? 'pb-24' : 'pb-8'}`}>
      {title && <h1 className="mb-4 text-3xl font-bold">{title}</h1>}
      {children}
      {nav && <BottomNav />}
    </main>
  )
}
