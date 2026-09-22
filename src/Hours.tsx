import { useEffect, useState } from 'react'
import { clock, HOURS, status } from './openingHours'

// The opening hours, with a live line above them saying whether the door is open at this moment (London time).
export default function Hours({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => status())
  useEffect(() => {
    const id = setInterval(() => setNow(status()), 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={`hours prose ${className}`}>
      <p className={`hours-now${now.open ? ' open' : ''}`}>{now.line}</p>
      <dl className="hours-rows">
        {HOURS.map((h) => (
          <div key={h.days}>
            <dt>{h.days}</dt>
            <dd>{clock(h.open)} – {clock(h.close)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
