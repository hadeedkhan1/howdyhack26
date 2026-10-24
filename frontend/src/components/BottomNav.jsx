import { NavLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

let previousTabIndex = null
let previousTabTimer

const tabs = [
  { to: '/plan', label: 'Plan', icon: '⌖' },
  { to: '/hand', label: 'Your hand', icon: '♧' },
  { to: '/deck', label: 'Collection', icon: '▤' },
]

// Bottom tab bar shown after the Check screen. Keeps ?date= when switching tabs.
export default function BottomNav() {
  const { pathname, search } = useLocation()
  const activeIndex = Math.max(0, tabs.findIndex((tab) => pathname.startsWith(tab.to)))
  const fromIndex = previousTabIndex ?? activeIndex

  useEffect(() => {
    window.clearTimeout(previousTabTimer)
    previousTabTimer = window.setTimeout(() => {
      previousTabIndex = activeIndex
    }, 560)
  }, [activeIndex])

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <span
        className={`nav-indicator ${fromIndex !== activeIndex ? 'is-sliding' : ''}`}
        aria-hidden="true"
        style={{
          '--from-position': `${fromIndex * 100}%`,
          '--active-position': `${activeIndex * 100}%`,
        }}
      />
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to + search}
          onClick={() => { previousTabIndex = activeIndex }}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon" aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
