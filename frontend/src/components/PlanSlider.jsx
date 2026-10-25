import { useRef, useState } from 'react'

const THUMB = 58
const GUTTER = 5

export default function PlanSlider({ onComplete }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const distance = useRef(0)
  const travel = useRef(0)
  const [position, setPosition] = useState(0)
  const progress = travel.current ? Math.round((distance.current / travel.current) * 100) : 0

  const setDistance = (next, max) => {
    travel.current = max
    distance.current = Math.max(0, Math.min(max, next))
    setPosition(distance.current)
  }

  const updateFromPointer = (event) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    setDistance(event.clientX - rect.left - THUMB / 2 - GUTTER, rect.width - THUMB - GUTTER * 2)
  }

  const finish = () => {
    dragging.current = false
    if (travel.current && distance.current / travel.current >= 0.92) onComplete()
    else {
      distance.current = 0
      setPosition(0)
    }
  }

  const handleKeyDown = (event) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const max = rect.width - THUMB - GUTTER * 2
    if (event.key === 'Home') {
      event.preventDefault()
      setDistance(0, max)
    } else if (event.key === 'End') {
      event.preventDefault()
      setDistance(max, max)
      onComplete()
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.min(max, distance.current + Math.max(20, max / 10))
      setDistance(next, max)
      if (next === max) onComplete()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      setDistance(Math.max(0, distance.current - Math.max(20, max / 10)), max)
    }
  }

  return (
    <section className="plan-slider-section" aria-label="Continue to your fishing plan">
      <div className="plan-slider-heading"><span className="slider-overline">YOUR NEXT STEP</span><h2>Build my fishing plan</h2></div>
      <div className="plan-slider-track" ref={trackRef}>
        <span className="plan-slider-fill" style={{ width: `${GUTTER + THUMB / 2 + position}px` }} />
        <span className="plan-slider-prompt" aria-hidden="true">Drag the fish to continue <span>→</span></span>
        <button
          type="button"
          className={`plan-slider-thumb ${dragging.current ? 'dragging' : ''}`}
          style={{ left: `${GUTTER + position}px` }}
          role="slider"
          aria-orientation="horizontal"
          aria-label="Drag fish to build your fishing plan"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
          aria-valuetext={`${progress}% complete`}
          onPointerDown={(event) => {
            event.preventDefault()
            dragging.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            updateFromPointer(event)
          }}
          onPointerMove={(event) => { if (dragging.current) updateFromPointer(event) }}
          onPointerUp={finish}
          onPointerCancel={() => {
            dragging.current = false
            distance.current = 0
            setPosition(0)
          }}
          onKeyDown={handleKeyDown}
        >
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path d="M33 18C28.9 12.4 20.7 10.3 11.8 14.8L4 9v18l7.8-5.8C20.7 25.7 28.9 23.6 33 18Z" />
            <circle cx="24" cy="16" r="1.35" />
          </svg>
        </button>
      </div>
    </section>
  )
}
