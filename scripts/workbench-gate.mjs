/**
 * ADR-0071 gate for the opportunity workbench, run against a live deployment.
 *
 * Binding sizes 1280x800, 1600x900 and 2560x1440, in both themes, across every saved
 * role. See docs/design/opportunity-workbench-adr-0071.md.
 *
 * Why each check exists, because the first version of this gate passed while the
 * screenshots showed three defects:
 *
 * - The brief clips with overflow:hidden so nothing spills into the page. A document
 *   overflow check is therefore blind to requirements that did not fit, so every chip is
 *   checked against the brief's visible box.
 * - `.shell-main` clips horizontally, so a control pushed off the bar never makes the
 *   document scroll: it disappears. Every bar control's edge is checked directly.
 * - A bare `.eligibility` rule elsewhere turned requirement labels grey and uppercase, so
 *   label text transforms are checked.
 * - The gate never read the numbers it guarded, and passed while every role showed
 *   "100%" coverage as if it were fit and one role read "0/18 met" during a load. The fit
 *   shown in the list and the brief is compared with the API, on first paint.
 *
 * Usage (credentials only through the environment; nothing is printed or stored):
 *
 *   npm --prefix frontend install --no-save playwright
 *   npx --prefix frontend playwright install chromium
 *   CAREERTWIN_GATE_BASE=https://<host> CAREERTWIN_GATE_EMAIL=... CAREERTWIN_GATE_PASSWORD=... \
 *     node scripts/workbench-gate.mjs
 *
 * Screenshots go to .run/workbench-gate/, which is ignored.
 */
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const BASE = process.env.CAREERTWIN_GATE_BASE
const EMAIL = process.env.CAREERTWIN_GATE_EMAIL
const PASSWORD = process.env.CAREERTWIN_GATE_PASSWORD
if (!BASE || !EMAIL || !PASSWORD) {
  console.error('Set CAREERTWIN_GATE_BASE, CAREERTWIN_GATE_EMAIL and CAREERTWIN_GATE_PASSWORD.')
  process.exit(2)
}

// Playwright is not a frontend dependency; resolve it from wherever it was installed.
const require = createRequire(process.env.CAREERTWIN_GATE_PLAYWRIGHT ?? new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const OUT = fileURLToPath(new URL('../.run/workbench-gate/', import.meta.url))
mkdirSync(OUT, { recursive: true })

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1600, height: 900 },
  { width: 2560, height: 1440 },
]

const browser = await chromium.launch()
const failures = []

for (const viewport of SIZES) {
  const page = await browser.newPage({ viewport })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  // Wait for the sign-in itself. `networkidle` can resolve before the login request has
  // finished, so the first requests race it, fail with 401, and sit in a retry: the
  // measurement then records a loading spinner as the page.
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.status() === 200),
    page.click('form button.primary'),
  ])
  await page.locator('.shell-main').waitFor({ state: 'visible' })
  await page.getByRole('link', { name: /opportunit|oportunidad/i }).first().click()
  await page.locator('.opp-row').first().waitFor({ state: 'visible', timeout: 30000 })
  const roles = await page.locator('.opp-row').count()

  const expected = await page.evaluate(async () => {
    const [runs, opportunities] = await Promise.all([
      fetch('/api/matches', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/opportunities', { credentials: 'include' }).then((r) => r.json()),
    ])
    const latest = new Map()
    for (const run of runs) if (!latest.has(run.opportunity_id)) latest.set(run.opportunity_id, run)
    const out = {}
    for (const item of opportunities) {
      const run = latest.get(item.id)
      out[item.title] = run?.score != null ? `${Math.round(run.score * 100)}%` : null
    }
    return out
  })

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme)
    for (let index = 0; index < roles; index += 1) {
      await page.locator('.opp-row').nth(index).click()
      const instant = await page.evaluate(() => document.querySelector('.ob-verdict dd.fit')?.textContent)
      await page.waitForTimeout(600)
      const r = await page.evaluate(() => {
        const doc = document.documentElement
        const main = document.querySelector('.shell-main')
        const brief = document.querySelector('.ob')
        const bar = document.querySelector('.workbench-bar')
        const box = brief.getBoundingClientRect()
        const pad = parseFloat(getComputedStyle(brief).paddingBottom)
        const chips = [...document.querySelectorAll('.ob-chip')]
        const labels = [...document.querySelectorAll('.ob-chip-label')]
        const barRight = Math.min(bar.getBoundingClientRect().right, innerWidth)
        const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        const salary = document.querySelector('.sb-strip')
        return {
          role: document.querySelector('.ob-identity h2')?.textContent,
          chips: chips.length,
          hiddenChips: chips.filter((c) => c.getBoundingClientRect().bottom > box.bottom - pad + 1).map((c) => c.textContent),
          clipped: labels.filter((el) => el.scrollHeight > el.clientHeight + 1).map((el) => el.textContent),
          shouting: labels.filter((el) => getComputedStyle(el).textTransform !== 'none').length,
          tiny: [...document.querySelectorAll('.page-contained *')].filter((el) => hasText(el) && parseFloat(getComputedStyle(el).fontSize) < 12).length,
          scrollY: Math.max(doc.scrollHeight - innerHeight, main.scrollHeight - main.clientHeight),
          scrollX: doc.scrollWidth - innerWidth,
          barClipped: [...bar.children].filter((el) => el.getBoundingClientRect().right > barRight + 1).map((el) => el.textContent.trim().slice(0, 24)),
          titleClipped: [...document.querySelectorAll('.opp-row-title')].filter((el) => el.scrollHeight > el.clientHeight + 1).map((el) => el.textContent),
          salaryWraps: salary ? salary.getBoundingClientRect().height >= 80 : false,
          fit: document.querySelector('.ob-verdict dd.fit')?.textContent,
          rowFit: document.querySelector('.opp-row.selected .opp-row-figures b')?.textContent,
          briefShare: Math.round(((box.width * box.height) / (innerWidth * innerHeight)) * 100),
        }
      })

      const problems = []
      if (r.scrollY > 0) problems.push(`page scrolls (${r.scrollY}px)`)
      if (r.scrollX > 0) problems.push(`page scrolls sideways (${r.scrollX}px)`)
      if (r.hiddenChips.length) problems.push(`${r.hiddenChips.length} requirement(s) cut off: ${r.hiddenChips.slice(0, 3).join(' | ')}`)
      if (r.clipped.length) problems.push(`label clipped: ${r.clipped.slice(0, 2).join(' | ')}`)
      if (r.shouting) problems.push(`${r.shouting} requirement label(s) forced to a text transform`)
      if (r.tiny) problems.push(`${r.tiny} text node(s) under 12px`)
      if (r.barClipped.length) problems.push(`bar control cut off: ${r.barClipped.join(' | ')}`)
      if (r.titleClipped.length) problems.push(`role title cut off in list: ${r.titleClipped.join(' | ')}`)
      if (r.salaryWraps) problems.push('salary strip wraps')
      const want = expected[r.role]
      if (want) {
        if (instant !== want) problems.push(`verdict on first paint "${instant}" instead of ${want}`)
        if (r.fit !== want) problems.push(`brief shows fit "${r.fit}", API holds ${want}`)
        if (!r.rowFit?.startsWith(want)) problems.push(`list shows "${r.rowFit}", API holds ${want}`)
      }

      const label = `${viewport.width}x${viewport.height} ${theme.padEnd(5)} ${String(r.chips).padStart(2)} req  ${r.role}`
      if (problems.length) {
        failures.push(label)
        console.log(`FAIL ${label}\n       ${problems.join('\n       ')}`)
      } else {
        console.log(`ok   ${label}  fit ${r.fit}  (brief ${r.briefShare}% of screen)`)
      }
    }
    await page.locator('.opp-row').first().click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}${viewport.width}x${viewport.height}-${theme}.png` })
  }
  await page.close()
}

await browser.close()
console.log(`\n${failures.length ? `${failures.length} FAILURE(S)` : 'workbench gate passed'} across ${SIZES.length} sizes x 2 themes`)
process.exit(failures.length ? 1 : 0)
