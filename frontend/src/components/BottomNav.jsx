import { NavLink, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/plan', label: 'Plan', icon: '⌖' },
  { to: '/hand', label: 'Your hand', icon: '♧' },
  { to: '/deck', label: 'Collection', icon: '▤' },
]

// Bottom tab bar shown after the Check screen. Keeps ?date= when switching tabs.
export default function BottomNav() {
  const { search } = useLocation()
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to + search}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon" aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
