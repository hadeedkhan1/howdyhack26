import { NavLink, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/plan', label: 'Plan' },
  { to: '/hand', label: 'Hand' },
  { to: '/deck', label: 'Deck' },
]

// Bottom tab bar shown after the Check screen. Keeps ?date= when switching tabs.
export default function BottomNav() {
  const { search } = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md border-t border-navy/10 bg-white">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to + search}
          className={({ isActive }) =>
            `flex min-h-14 flex-1 items-center justify-center text-base font-semibold ${
              isActive ? 'text-navy' : 'text-navy/50'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
