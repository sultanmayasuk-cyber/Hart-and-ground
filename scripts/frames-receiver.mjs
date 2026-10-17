// `npm run frames`: takes the phones' frame sequences from the dev site (src/render.ts, ?render=dive|cups) and writes
// them under public/frames/<seq>/NNN.webp. Dev only; listens on 5180.
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'frames')
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' }

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
  const m = req.method === 'POST' && /^\/frames\/(dive|cups)\/(\d{1,3}|manifest)$/.exec(req.url ?? '')
  if (!m) return res.writeHead(404, cors).end()
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (m[2] === 'manifest') {
    await mkdir(root, { recursive: true })
    await writeFile(join(root, `${m[1]}.json`), Buffer.concat(chunks))
    console.log(`${m[1]}.json`)
    return res.writeHead(200, cors).end('ok')
  }
  const dir = join(root, m[1])
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${m[2].padStart(3, '0')}.webp`)
  await writeFile(file, Buffer.concat(chunks))
  console.log(`${m[1]} ${m[2].padStart(3, '0')}  ${Math.round(Buffer.concat(chunks).length / 1024)} KB`)
  res.writeHead(200, cors).end('ok')
}).listen(5180, () => console.log(`frames receiver on http://localhost:5180 → ${root}`))
