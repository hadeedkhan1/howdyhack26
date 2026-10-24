import BottomNav from './BottomNav'
import { Link, useLocation } from 'react-router-dom'

const routeSteps = ['/start', '/check', '/plan', '/hand', '/deck']

// Shared shell keeps the trip flow consistent and gives every screen a clear home.
export default function Screen({ title, eyebrow, children, nav = false }) {
  const { pathname, search } = useLocation()
  const step = routeSteps.indexOf(pathname)

  return (
    <main className={`app-shell ${nav ? 'has-nav' : ''}`}>
      <header className="topbar">
        <Link className="brand" to={`/start${search}`} aria-label="Go Fish home">
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span>go fish<span className="brand-period">.</span></span>
        </Link>
      </header>
      {step >= 0 && <div className="flow-progress" aria-label={`Step ${step + 1} of 5`}><span style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>}
      <div className="screen-content">
        {(title || eyebrow) && <div className="page-heading">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {title && <h1>{title}</h1>}
        </div>}
        {children}
      </div>
      {nav && <BottomNav />}
    </main>
  )
}
