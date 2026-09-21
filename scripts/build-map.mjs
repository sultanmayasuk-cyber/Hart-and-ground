// Builds public/map/map.json from OpenStreetMap (Overpass): three levels of detail around the café, for the zooming
// map in the Visit section. Run: node scripts/build-map.mjs   (map data © OpenStreetMap contributors, ODbL)
import { writeFileSync } from 'node:fs'
const PIN = [51.466827, -0.266687]
const API = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
mkdirSync('scripts/.cache', { recursive: true })
async function q(name, body) {
  const cache = `scripts/.cache/${name}.json`
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))
  for (let n = 0; n < 4; n++) for (const url of API) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(`[out:json][timeout:90];${body}`), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'hartandground-site-build' } })
      if (r.ok) { const els = (await r.json()).elements; writeFileSync(cache, JSON.stringify(els)); return els }
      console.error(url, r.status)
    } catch (e) { console.error(url, e.message) }
    await new Promise((r) => setTimeout(r, 8000))
  }
  throw new Error('overpass failed')
}
// metres east/north of the pin
const K = 111320, C = Math.cos((PIN[0] * Math.PI) / 180)
const xy = (p) => [Math.round((p.lon - PIN[1]) * K * C), Math.round((p.lat - PIN[0]) * K)]
// Douglas-Peucker
function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const n = pts.length - 1
  if (pts[0][0] === pts[n][0] && pts[0][1] === pts[n][1] && n > 3) {
    // a closed ring: split at the point farthest from the start, simplify each half
    let far = 1
    for (let i = 1; i < n; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i
    return simplify(pts.slice(0, far + 1), tol).concat(simplify(pts.slice(far), tol).slice(1))
  }
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1
  const st = [[0, pts.length - 1]]
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]) }
  }
  return pts.filter((_, i) => keep[i])
}
const lines = (els, tol) => {
  const out = []
  for (const e of els) {
    if (e.type === 'way' && e.geometry) out.push(simplify(e.geometry.map(xy), tol).flat())
    if (e.type === 'relation') {
      // stitch the outer ways end to end into closed rings
      const parts = e.members.filter((m) => m.geometry && m.role !== 'inner').map((m) => m.geometry.map(xy))
      while (parts.length) {
        let ring = parts.shift()
        for (let joined = true; joined; ) {
          joined = false
          const end = ring[ring.length - 1]
          const i = parts.findIndex((p) => (p[0][0] === end[0] && p[0][1] === end[1]) || (p[p.length - 1][0] === end[0] && p[p.length - 1][1] === end[1]))
          if (i >= 0) {
            let p = parts.splice(i, 1)[0]
            if (p[0][0] !== end[0] || p[0][1] !== end[1]) p = p.reverse()
            ring = ring.concat(p.slice(1))
            joined = true
          }
        }
        out.push(simplify(ring, tol).flat())
      }
    }
  }
  return out
}
const pick = (els, f) => els.filter((e) => f(e.tags || {}))

const WIDE = '51.36,-0.52,51.58,0.02'
const MID = '51.440,-0.315,51.492,-0.225'
const NEAR = '51.4640,-0.2715,51.4695,-0.2620'
const wide = await q('wide', `(way[waterway=river][name="River Thames"](${WIDE});way[highway~"^(motorway|trunk|primary)$"](${WIDE});way[leisure~"park|common|nature_reserve"](if:length()>3000)(${WIDE});relation[leisure~"park|common|nature_reserve"][name~"Richmond Park|Bushy Park|Hyde Park|Wimbledon Common|Kew|Regent|Hampstead Heath|Hampton Court|Battersea|Osterley|Syon"](${WIDE}););out geom;`)
console.log('wide', wide.length)
const mid = await q('mid', `(way[highway~"^(primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](${MID});way[railway=rail](${MID});way[leisure~"park|common|nature_reserve|garden|pitch|playground"](${MID});way[landuse~"grass|recreation_ground|cemetery|allotments"](${MID});way[natural~"water|wood"](${MID});way[highway~"path|footway|track"](51.425,-0.30,51.468,-0.24);node[railway=station](${MID}););out geom;`)
console.log('mid', mid.length)
const near = await q('near', `(way[building](${NEAR}););out geom;`)
console.log('near', near.length)

const hw = (re) => (t) => re.test(t.highway || '')
// "the long way home": from Pen Ponds in the park, out by Sheen Gate, up Sheen Lane to the door
const lane = pick(mid, (t) => t.name === 'Sheen Lane').flatMap((e) => e.geometry.map(xy)).filter((p) => p[1] < 0 && p[1] > -1080).sort((a, b) => a[1] - b[1])
const route = [[-640, -2700], [-520, -2250], [-300, -1800], [-210, -1400], [-100, -1090], ...lane.filter((_, i) => i % 3 === 0), [0, 0]].flat()
const data = {
  pin: PIN,
  route,
  wide: {
    river: lines(pick(wide, (t) => t.waterway === 'river'), 25),
    roads: lines(pick(wide, hw(/^(motorway|trunk)$/)), 40).filter((l) => l.length >= 4),
    parks: lines(pick(wide, (t) => t.leisure), 25).filter((l) => l.length > 12),
  },
  mid: {
    major: lines(pick(mid, hw(/^(primary|secondary|tertiary)$/)), 3),
    minor: lines(pick(mid, hw(/residential|unclassified|living_street|pedestrian/)), 3),
    paths: lines(pick(mid, hw(/path|footway|track/)), 5),
    rail: lines(pick(mid, (t) => t.railway === 'rail'), 4),
    green: lines(pick(mid, (t) => t.leisure || t.landuse || t.natural === 'wood'), 4),
    water: lines(pick(mid, (t) => t.natural === 'water'), 4),
    stations: mid.filter((e) => e.type === 'node').map((e) => ({ name: e.tags.name, p: xy(e) })),
    names: Object.values(Object.fromEntries(pick(mid, (t) => t.name && /primary|secondary|tertiary|residential/.test(t.highway || '')).filter((e) => e.geometry).map((e) => { const g = e.geometry.map(xy); const a = g[Math.floor(g.length / 2) - (g.length > 1 ? 1 : 0)], b = g[Math.floor(g.length / 2)]; return [e.tags.name + Math.round(a[0] / 400) , { name: e.tags.name, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], a: Math.atan2(b[1] - a[1], b[0] - a[0]), len: g.length }] }))).filter((n) => Math.hypot(...n.p) < 700),
  },
  near: { buildings: lines(near, 0.6) },
}
writeFileSync('public/map/map.json', JSON.stringify(data))
console.log('written', (JSON.stringify(data).length / 1024).toFixed(0) + ' KB', Object.entries(data.wide).map(([k, v]) => k + ':' + v.length).join(' '), Object.entries(data.mid).map(([k, v]) => k + ':' + v.length).join(' '))
