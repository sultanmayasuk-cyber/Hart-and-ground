// The café's opening hours (from its Google listing, 2026-09), and whether the door is open right now, in London time.
export const HOURS = [
  { days: 'Monday to Friday', open: 6, close: 18 },
  { days: 'Saturday and Sunday', open: 9, close: 16 },
]
// by weekday, Sunday first (as Date.getDay counts)
const BY_DAY = [HOURS[1], HOURS[0], HOURS[0], HOURS[0], HOURS[0], HOURS[0], HOURS[1]]

export const clock = (h: number) => (h === 12 ? 'noon' : `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`)

// Now, on the café's clock: weekday and the hour as a decimal (visitors may be anywhere in the world).
function london(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { day: day < 0 ? now.getDay() : day, hour: Number(get('hour')) + Number(get('minute')) / 60 }
}

export function status(now = new Date()): { open: boolean; line: string } {
  const { day, hour } = london(now)
  const today = BY_DAY[day]
  if (hour >= today.open && hour < today.close) {
    const left = today.close - hour
    return { open: true, line: left <= 0.5 ? `Open now, closing at ${clock(today.close)}` : `Open now, until ${clock(today.close)}` }
  }
  if (hour < today.open) return { open: false, line: `Closed now, opens at ${clock(today.open)}` }
  const next = BY_DAY[(day + 1) % 7]
  return { open: false, line: `Closed now, opens tomorrow at ${clock(next.open)}` }
}
