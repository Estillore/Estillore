// Builds assets/contributions-light.svg and assets/contributions-dark.svg from the
// public contribution calendar of a profile. The public calendar already includes
// private contributions when the owner has "Include private contributions" turned on,
// so no token or secret is needed.
import { writeFileSync, mkdirSync } from 'node:fs'

const user = process.env.PROFILE_USER || 'Estillore'
const res = await fetch(`https://github.com/users/${user}/contributions`, { headers: { 'user-agent': 'profile-contribution-graph' } })
if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
const html = await res.text()

const tips = new Map()
for (const m of html.matchAll(/<tool-tip[^>]*\sfor="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/tool-tip>/g)) {
  const n = /^(No|[\d,]+)\s+contributions?/.exec(m[2])
  if (n) tips.set(m[1], n[1] === 'No' ? 0 : Number(n[1].replace(/,/g, '')))
}
const cells = []
for (const m of html.matchAll(/<td\b[^>]*>/g)) {
  const tag = m[0]
  const date = /data-date="([^"]+)"/.exec(tag)?.[1]
  const id = /id="(contribution-day-component-(\d+)-(\d+))"/.exec(tag)
  const level = /data-level="(\d)"/.exec(tag)?.[1]
  if (!date || !id || level === undefined) continue
  cells.push({ date, row: Number(id[2]), col: Number(id[3]), level: Number(level), count: tips.get(id[1]) ?? 0 })
}
if (cells.length < 300) throw new Error(`Only parsed ${cells.length} days; page layout may have changed`)
const total = cells.reduce((s, c) => s + c.count, 0)
const cols = Math.max(...cells.map((c) => c.col)) + 1

const size = 11, gap = 3, left = 34, top = 44
const width = left + cols * (size + gap) + 16
const height = top + 7 * (size + gap) + 40
const themes = {
  light: { bg: '#ffffff', text: '#1f2328', muted: '#59636e', levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] },
  dark: { bg: '#0d1117', text: '#e6edf3', muted: '#9198a1', levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] },
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmt = (n) => n.toLocaleString('en-US')

function render(t) {
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${fmt(total)} contributions in the last year">`
  out += `<rect width="${width}" height="${height}" rx="6" fill="${t.bg}"/>`
  out += `<g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">`
  out += `<text x="${left}" y="26" font-size="14" font-weight="600" fill="${t.text}">${fmt(total)} contributions in the last year</text>`
  let lastMonth = -1
  const first = cells.filter((c) => c.row === 0).sort((a, b) => a.col - b.col)
  for (const c of first) {
    const mo = Number(c.date.slice(5, 7)) - 1
    if (mo !== lastMonth) {
      if (c.col < cols - 2 || lastMonth === -1) out += `<text x="${left + c.col * (size + gap)}" y="${top - 8}" font-size="10" fill="${t.muted}">${months[mo]}</text>`
      lastMonth = mo
    }
  }
  ;[['Mon', 1], ['Wed', 3], ['Fri', 5]].forEach(([d, r]) => {
    out += `<text x="${left - 8}" y="${top + r * (size + gap) + size - 1}" font-size="10" fill="${t.muted}" text-anchor="end">${d}</text>`
  })
  for (const c of cells) {
    const label = `${c.count === 0 ? 'No' : fmt(c.count)} contribution${c.count === 1 ? '' : 's'} on ${c.date}`
    out += `<rect x="${left + c.col * (size + gap)}" y="${top + c.row * (size + gap)}" width="${size}" height="${size}" rx="2" fill="${t.levels[c.level]}"><title>${label}</title></rect>`
  }
  const ly = top + 7 * (size + gap) + 14
  let lx = width - 16 - (5 * (size + 3)) - 60
  out += `<text x="${lx}" y="${ly + 9}" font-size="10" fill="${t.muted}">Less</text>`
  lx += 28
  t.levels.forEach((col, i) => { out += `<rect x="${lx + i * (size + 3)}" y="${ly}" width="${size}" height="${size}" rx="2" fill="${col}"/>` })
  out += `<text x="${lx + 5 * (size + 3) + 3}" y="${ly + 9}" font-size="10" fill="${t.muted}">More</text>`
  return out + `</g></svg>\n`
}
mkdirSync('assets', { recursive: true })
writeFileSync('assets/contributions-light.svg', render(themes.light))
writeFileSync('assets/contributions-dark.svg', render(themes.dark))
console.log(`Wrote graphs for ${user}: ${fmt(total)} contributions over ${cells.length} days`)
