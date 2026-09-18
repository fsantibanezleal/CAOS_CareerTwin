/**
 * ADR-0071 gate for the opportunity, matches, profile and pipeline workbenches, run against a live deployment.
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
 * CAREERTWIN_GATE_ONLY=pipeline (or a comma list of opportunities, matches, profile, pipeline)
 * runs only those pages.
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

// CAREERTWIN_GATE_ONLY=opportunities,matches,profile,pipeline runs a subset; all by default.
const ONLY = process.env.CAREERTWIN_GATE_ONLY?.split(',').map((name) => name.trim().toLowerCase())
const phase = (name) => (!ONLY || ONLY.includes(name) ? SIZES : [])

const browser = await chromium.launch()
const failures = []

for (const viewport of phase('opportunities')) {
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


// ---------------------------------------------------------------------------- Matches
// The cross-role workbench: the header row is the ranking and must equal the API's fits
// in best-fit order; every importance tab except "All" must fit its own box, with the gap
// view on and off; and the per-role drawer must open from a header.
const TABS = ['required', 'eligibility', 'preferred', 'all']
for (const viewport of phase('matches')) {
  const page = await browser.newPage({ viewport })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.status() === 200),
    page.click('form button.primary'),
  ])
  await page.locator('.shell-main').waitFor({ state: 'visible' })
  await page.locator('.sidebar a[href="/matches"]').click()
  await page.waitForURL((u) => u.pathname === '/matches')
  await page.locator('.cw-rank-row').first().waitFor({ state: 'visible', timeout: 30000 })

  const expectedHeaders = await page.evaluate(async () => {
    const [runs, opportunities] = await Promise.all([
      fetch('/api/matches', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/opportunities', { credentials: 'include' }).then((r) => r.json()),
    ])
    const latest = new Map()
    for (const run of runs) if (!latest.has(run.opportunity_id)) latest.set(run.opportunity_id, run)
    const employer = new Map(opportunities.map((o) => [o.id, o.employer]))
    return [...latest.values()]
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .map((run) => `${employer.get(run.opportunity_id)} ${Math.round(run.score * 100)}% fit`)
  })

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme)
    for (const gaps of [true, false]) {
      const box = page.locator('.cw-toggle input')
      if ((await box.isChecked()) !== gaps) await box.click()
      for (const tab of TABS) {
        await page.locator('.cw-tabs button').nth(TABS.indexOf(tab)).click()
        await page.waitForTimeout(250)
        const r = await page.evaluate(() => {
          const main = document.querySelector('.shell-main')
          const doc = document.documentElement
          const scroll = document.querySelector('.cw-matrix-scroll')
          const bar = document.querySelector('.workbench-bar')
          const barRight = Math.min(bar.getBoundingClientRect().right, innerWidth)
          const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          return {
            rows: document.querySelectorAll('.cw-matrix tbody tr').length,
            inMatrix: scroll.scrollHeight - scroll.clientHeight,
            scrollY: Math.max(doc.scrollHeight - innerHeight, main.scrollHeight - main.clientHeight),
            scrollX: doc.scrollWidth - innerWidth,
            barClipped: [...bar.children].filter((el) => el.getBoundingClientRect().right > barRight + 1).map((el) => el.textContent.trim().slice(0, 20)),
            controls: Math.round(document.querySelector('.cw-controls').getBoundingClientRect().height),
            tiny: [...document.querySelectorAll('.page-contained *')].filter((el) => hasText(el) && parseFloat(getComputedStyle(el).fontSize) < 12).length,
            headers: [...document.querySelectorAll('thead .cw-rank-row')].map((th) => `${th.querySelector('b')?.textContent} ${th.querySelector('.cw-rank-value')?.textContent}`),
          }
        })
        const problems = []
        if (r.scrollY > 0) problems.push(`page scrolls (${r.scrollY}px)`)
        if (r.scrollX > 0) problems.push(`page scrolls sideways (${r.scrollX}px)`)
        if (r.barClipped.length) problems.push(`bar control cut off: ${r.barClipped.join(' | ')}`)
        if (r.controls > 60) problems.push(`controls wrap (${r.controls}px)`)
        if (r.tiny) problems.push(`${r.tiny} text node(s) under 12px`)
        if (tab !== 'all' && r.inMatrix > 1) problems.push(`${tab} tab needs scrolling (${r.inMatrix}px)`)
        if (JSON.stringify(r.headers) !== JSON.stringify(expectedHeaders)) problems.push(`headers ${JSON.stringify(r.headers)} != API ${JSON.stringify(expectedHeaders)}`)
        const label = `matches ${viewport.width}x${viewport.height} ${theme.padEnd(5)} gaps=${gaps ? 'on ' : 'off'} ${tab.padEnd(11)} ${String(r.rows).padStart(2)} rows`
        if (problems.length) {
          failures.push(label)
          console.log(`FAIL ${label}\n       ${problems.join('\n       ')}`)
        } else {
          console.log(`ok   ${label}`)
        }
      }
    }
    await page.locator('.cw-tabs button').nth(0).click()
    await page.screenshot({ path: `${OUT}matches-${viewport.width}x${viewport.height}-${theme}.png` })
  }

  await page.locator('thead .cw-role').first().click()
  await page.waitForTimeout(400)
  if (!(await page.locator('.role-drawer').count())) {
    failures.push(`matches ${viewport.width}: role drawer did not open`)
    console.log(`FAIL matches ${viewport.width}: role drawer did not open`)
  }
  await page.close()
}


// ---------------------------------------------------------------------------- Profile
// Every tab and artifact sub-tab. The skill map's totals are read against the API, and its
// rows are checked for being visible sideways, because the first version of this check
// counted DOM rows and passed while 42 skills sat off-screen to the right.
const PROFILE_TABS = ['Overview', 'Evidence', 'Career', 'Artifacts', 'GitHub']
const ARTIFACT_TABS = ['Stories', 'Resume versions', 'Communication', 'Import and export']
for (const viewport of phase('profile')) {
  const page = await browser.newPage({ viewport })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.status() === 200),
    page.click('form button.primary'),
  ])
  await page.locator('.shell-main').waitFor({ state: 'visible' })
  await page.locator('.sidebar a[href="/profile"]').click()
  await page.waitForURL((u) => u.pathname === '/profile')
  await page.locator('.bar-tabs button').first().waitFor({ state: 'visible', timeout: 30000 })

  const api = await page.evaluate(async () => {
    const [skills, stories] = await Promise.all([
      fetch('/api/profile/skills', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/artifacts/accomplishments', { credentials: 'include' }).then((r) => r.json()),
    ])
    return { skills: skills.length, unbacked: skills.filter((s) => s.evidence_count === 0).length, stories: stories.length }
  })

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme)
    for (const tab of PROFILE_TABS) {
      await page.locator('.bar-tabs button', { hasText: tab }).first().click()
      await page.waitForTimeout(700)
      for (const sub of tab === 'Artifacts' ? ARTIFACT_TABS : [null]) {
        if (sub) {
          await page.locator('.profile-artifacts .cw-tabs button', { hasText: sub }).first().click()
          await page.waitForTimeout(500)
        }
        const r = await page.evaluate(() => {
          const main = document.querySelector('.shell-main')
          const doc = document.documentElement
          const bar = document.querySelector('.workbench-bar')
          const barRight = Math.min(bar.getBoundingClientRect().right, innerWidth)
          const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          const tabsBox = document.querySelector('.bar-tabs')
          const map = document.querySelector('.sm-columns')
          const mapBox = map?.getBoundingClientRect()
          const card = document.querySelector('.identity')
          return {
            scrollY: Math.max(doc.scrollHeight - innerHeight, main.scrollHeight - main.clientHeight),
            scrollX: doc.scrollWidth - innerWidth,
            barClipped: [...bar.children].filter((el) => el.getBoundingClientRect().right > barRight + 1).length,
            tabsHidden: tabsBox ? tabsBox.scrollWidth - tabsBox.clientWidth : 0,
            tiny: [...document.querySelectorAll('.page-contained *')].filter((el) => hasText(el) && parseFloat(getComputedStyle(el).fontSize) < 12).length,
            skillRows: document.querySelectorAll('.sm-row').length,
            unbackedShown: document.querySelector('.sm-toggle span')?.textContent,
            sideways: map ? [...map.querySelectorAll('.sm-row')].filter((row) => { const b = row.getBoundingClientRect(); return b.right > mapBox.right + 1 || b.left < mapBox.left - 1 }).length : 0,
            factsOverflow: card ? [...card.querySelectorAll('.identity-facts dd')].filter((dd) => dd.getBoundingClientRect().right > card.getBoundingClientRect().right + 1).length : 0,
            collisions: [...document.querySelectorAll('.ct-row')].filter((row) => {
              const label = row.querySelector('.ct-outside')
              const track = row.querySelector('.ct-track')
              const count = row.querySelector('.ct-count')
              if (!label || !track) return false
              const l = label.getBoundingClientRect()
              const t = track.getBoundingClientRect()
              const c = count?.getBoundingClientRect()
              return l.left < t.left - 1 || l.right > t.right + 1 || (c && c.width > 0 && l.right > c.left)
            }).length,
            stories: document.querySelectorAll('.ss-item').length,
          }
        })
        const problems = []
        if (r.scrollY > 0) problems.push(`page scrolls (${r.scrollY}px)`)
        if (r.scrollX > 0) problems.push(`page scrolls sideways (${r.scrollX}px)`)
        if (r.barClipped) problems.push(`${r.barClipped} bar control(s) cut off`)
        if (r.tabsHidden > 1) problems.push(`tabs need horizontal scrolling (${r.tabsHidden}px)`)
        if (r.tiny) problems.push(`${r.tiny} text node(s) under 12px`)
        if (r.sideways) problems.push(`${r.sideways} skill row(s) outside the map sideways`)
        if (r.factsOverflow) problems.push(`${r.factsOverflow} identity fact(s) run past the card`)
        if (r.collisions) problems.push(`${r.collisions} timeline label(s) collide`)
        if (tab === 'Overview' && r.skillRows !== api.skills) problems.push(`skill map shows ${r.skillRows} skills, API holds ${api.skills}`)
        if (tab === 'Overview' && r.unbackedShown !== String(api.unbacked)) problems.push(`unbacked shown ${r.unbackedShown}, API ${api.unbacked}`)
        if (sub === 'Stories' && r.stories !== api.stories) problems.push(`stories ${r.stories}, API ${api.stories}`)
        const label = `profile ${viewport.width}x${viewport.height} ${theme.padEnd(5)} ${tab}${sub ? ` / ${sub}` : ''}`
        if (problems.length) {
          failures.push(label)
          console.log(`FAIL ${label}\n       ${problems.join('\n       ')}`)
        } else {
          console.log(`ok   ${label}`)
        }
      }
    }
    await page.locator('.bar-tabs button', { hasText: 'Overview' }).first().click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}profile-${viewport.width}x${viewport.height}-${theme}.png` })
  }
  await page.close()
}

// --------------------------------------------------------------------------- Pipeline
// Every view, and the board in both of its track modes. The strip's counts, each row's stage,
// fit, reached stages and time segments, each detail pane's history and compensation band, the
// calendar's items per day and the people list are read against the API. Labels, axis ticks
// and provider cards are checked for staying inside their boxes, because at half width a
// Connect button once sat over the neighbouring card while every count passed.
const PIPELINE_VIEWS = ['Board', 'Calendar', 'People', 'Connections']
const OPEN_STAGES = ['saved', 'preparing', 'applied', 'screening', 'interview', 'offer']
for (const viewport of phase('pipeline')) {
  const page = await browser.newPage({ viewport })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.status() === 200),
    page.click('form button.primary'),
  ])
  await page.locator('.shell-main').waitFor({ state: 'visible' })
  await page.locator('.sidebar a[href="/pipeline"]').click()
  await page.waitForURL((u) => u.pathname === '/pipeline')
  await page.locator('.pj-row').first().waitFor({ state: 'visible', timeout: 30000 })

  const api = await page.evaluate(async (open) => {
    const get = (url) => fetch(url, { credentials: 'include' }).then((r) => r.json())
    const [apps, events, runs, opportunities, contacts, tasks] = await Promise.all(
      ['/api/pipeline/applications', '/api/pipeline/events', '/api/matches', '/api/opportunities', '/api/pipeline/contacts', '/api/pipeline/tasks'].map(get),
    )
    const latest = new Map()
    for (const run of runs) if (!latest.has(run.opportunity_id)) latest.set(run.opportunity_id, run)
    const byApp = {}
    for (const app of apps) {
      const own = events.filter((e) => e.application_id === app.id)
      const run = latest.get(app.opportunity_id)
      const role = opportunities.find((o) => o.id === app.opportunity_id)
      const reached = new Set(own.map((e) => e.to_stage).filter((s) => open.includes(s)))
      if (open.includes(app.stage)) reached.add(app.stage)
      byApp[app.id] = {
        stage: app.stage,
        fit: run?.score != null ? String(Math.round(run.score * 100)) : '',
        reached: reached.size,
        history: own.length,
        segments: Math.max(1, own.length),
        title: role?.title ?? '',
        band: role?.compensation?.floor !== undefined,
      }
    }
    // Calendar items by the browser's local day, which is how the page places them.
    const key = (value) => {
      const d = new Date(value)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const days = {}
    const add = (value) => (days[key(value)] = (days[key(value)] ?? 0) + 1)
    events.forEach((e) => add(e.occurred_at))
    tasks.forEach((t) => (t.starts_at ?? t.due_at) && add(t.starts_at ?? t.due_at))
    opportunities.forEach((o) => o.deadline_at && add(o.deadline_at))
    return {
      byApp,
      counts: Object.fromEntries(open.map((s) => [s, apps.filter((a) => a.stage === s).length])),
      open: apps.filter((a) => open.includes(a.stage)).length,
      days,
      contacts: contacts.length,
      openStages: open,
    }
  }, OPEN_STAGES)

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme)
    for (const view of PIPELINE_VIEWS) {
      await page.locator('.bar-tabs button', { hasText: view }).first().click()
      await page.waitForTimeout(view === 'Connections' ? 2500 : 700)
      for (const mode of view === 'Board' ? ['Stages', 'Dates'] : [null]) {
        if (mode) {
          await page.locator('.pj-mode button', { hasText: mode }).click()
          await page.waitForTimeout(400)
        }
        const r = await page.evaluate((expected) => {
          const main = document.querySelector('.shell-main')
          const doc = document.documentElement
          const bar = document.querySelector('.workbench-bar')
          const barRight = Math.min(bar.getBoundingClientRect().right, innerWidth)
          const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          const within = (el, box) => {
            const b = el.getBoundingClientRect()
            return b.width === 0 || (b.left >= box.left - 1 && b.right <= box.right + 1)
          }
          const tabsBox = document.querySelector('.bar-tabs')
          const rowProblems = []
          const rows = [...document.querySelectorAll('.pj-row')]
          for (const row of rows) {
            const want = expected.byApp[row.dataset.application]
            if (!want) {
              rowProblems.push(`row ${row.dataset.application} is not in the API`)
              continue
            }
            const name = want.title.slice(0, 28)
            const shownFit = row.querySelector('.pj-fit')?.textContent.match(/(\d+)%/)?.[1] ?? ''
            if (shownFit !== want.fit) rowProblems.push(`${name}: shows fit ${shownFit || 'none'}, API ${want.fit || 'none'}`)
            const current = row.querySelector('.pj-step.current')
            if (current && !current.classList.contains(`stage-${want.stage}`)) rowProblems.push(`${name}: current step ${current.className}, API stage ${want.stage}`)
            if (row.querySelector('.pj-track') && expected.openStages.includes(want.stage) && !current) rowProblems.push(`${name}: no current step drawn for ${want.stage}`)
            if (row.querySelector('.pj-track') && row.querySelectorAll('.pj-step.reached').length !== want.reached) rowProblems.push(`${name}: ${row.querySelectorAll('.pj-step.reached').length} stages reached drawn, API ${want.reached}`)
            if (row.querySelector('.pj-gantt') && row.querySelectorAll('.pj-seg').length !== want.segments) rowProblems.push(`${name}: ${row.querySelectorAll('.pj-seg').length} time segments, API ${want.segments}`)
            const box = row.getBoundingClientRect()
            const outside = [...row.querySelectorAll('.pj-step small, .pj-seg-label, .pj-fit, .pj-ask, .pj-role b')].filter((el) => !within(el, box)).length
            if (outside) rowProblems.push(`${name}: ${outside} label(s) outside the row`)
          }
          const axis = [...document.querySelectorAll('.pj-axis span')].map((s) => s.getBoundingClientRect())
          const strip = Object.fromEntries([...document.querySelectorAll('.pj-stage')].map((b) => [b.className.match(/stage-(\w+)/)[1], Number(b.querySelector('b')?.textContent)]))
          return {
            scrollY: Math.max(doc.scrollHeight - innerHeight, main.scrollHeight - main.clientHeight),
            scrollX: doc.scrollWidth - innerWidth,
            barClipped: [...bar.children].filter((el) => el.getBoundingClientRect().right > barRight + 1).length,
            tabsHidden: tabsBox ? tabsBox.scrollWidth - tabsBox.clientWidth : 0,
            tiny: [...document.querySelectorAll('.page-contained *')].filter((el) => hasText(el) && parseFloat(getComputedStyle(el).fontSize) < 12).length,
            rows: rows.length,
            rowProblems,
            strip,
            axisOverlap: axis.filter((b, i) => i > 0 && b.left < axis[i - 1].right - 1).length,
            cardOverflow: [...document.querySelectorAll('.provider-connect-grid article, .extension-callout')].filter((card) => {
              const box = card.getBoundingClientRect()
              return [...card.children].some((child) => !within(child, box))
            }).length,
            // Marks drawn plus the "+N more" a full day shows, against the API's items that day.
            calendarMismatch: [...document.querySelectorAll('.cc-day')].filter((cell) => cell.querySelectorAll('.cc-mark').length + Number(cell.querySelector('.cc-more')?.textContent.match(/\d+/)?.[0] ?? 0) !== (expected.days[cell.dataset.day] ?? 0)).map((cell) => cell.dataset.day),
            marksOutside: [...document.querySelectorAll('.cc-mark')].filter((mark) => !within(mark, mark.closest('.cc-day').getBoundingClientRect())).length,
            people: document.querySelectorAll('.pw-item').length,
          }
        }, api)
        const problems = []
        if (r.scrollY > 0) problems.push(`page scrolls (${r.scrollY}px)`)
        if (r.scrollX > 0) problems.push(`page scrolls sideways (${r.scrollX}px)`)
        if (r.barClipped) problems.push(`${r.barClipped} bar control(s) cut off`)
        if (r.tabsHidden > 1) problems.push(`tabs need horizontal scrolling (${r.tabsHidden}px)`)
        if (r.tiny) problems.push(`${r.tiny} text node(s) under 12px`)
        if (view === 'Board') {
          if (r.rows !== api.open) problems.push(`${r.rows} journeys drawn, API has ${api.open} open applications`)
          for (const stage of OPEN_STAGES) if (r.strip[stage] !== api.counts[stage]) problems.push(`strip ${stage} ${r.strip[stage]}, API ${api.counts[stage]}`)
          problems.push(...r.rowProblems)
          if (r.axisOverlap) problems.push(`${r.axisOverlap} axis label(s) overlap`)
        }
        if (view === 'Calendar') {
          if (r.calendarMismatch.length) problems.push(`calendar items differ from the API on ${r.calendarMismatch.join(', ')}`)
          if (r.marksOutside) problems.push(`${r.marksOutside} calendar mark(s) outside their day`)
        }
        if (view === 'People' && r.people !== api.contacts) problems.push(`${r.people} people listed, API has ${api.contacts}`)
        if (view === 'Connections' && r.cardOverflow) problems.push(`${r.cardOverflow} connection card(s) with content outside`)
        const label = `pipeline ${viewport.width}x${viewport.height} ${theme.padEnd(5)} ${view}${mode ? ` / ${mode}` : ''}`
        if (problems.length) {
          failures.push(label)
          console.log(`FAIL ${label}\n       ${problems.join('\n       ')}`)
        } else {
          console.log(`ok   ${label}`)
        }
      }
    }

    // The detail pane follows the selection: every application, its history and its band.
    await page.locator('.bar-tabs button', { hasText: 'Board' }).first().click()
    await page.locator('.pj-mode button', { hasText: 'Stages' }).click()
    const ids = await page.$$eval('.pj-row', (rows) => rows.map((row) => row.dataset.application))
    for (const id of ids) {
      await page.locator(`.pj-row[data-application="${id}"]`).click()
      await page.waitForTimeout(250)
      const d = await page.evaluate(() => ({
        id: document.querySelector('.ad')?.dataset.application,
        title: document.querySelector('.ad h2')?.textContent,
        history: document.querySelectorAll('.ad-history li').length,
        band: Boolean(document.querySelector('.ad .sb-compact')),
        fit: document.querySelector('.ad-figures .fit dd')?.textContent.match(/(\d+)%/)?.[1] ?? '',
      }))
      const want = api.byApp[id]
      const problems = []
      if (d.id !== id) problems.push(`selected ${id}, detail shows ${d.id}`)
      if (d.title !== want.title) problems.push(`title "${d.title}", API "${want.title}"`)
      if (d.history !== want.history) problems.push(`${d.history} history entries, API ${want.history}`)
      if (d.band !== want.band) problems.push(`compensation band ${d.band ? 'shown' : 'missing'}, API ${want.band ? 'has' : 'lacks'} one`)
      if (d.fit !== want.fit) problems.push(`detail shows fit ${d.fit || 'none'}, API ${want.fit || 'none'}`)
      const label = `pipeline ${viewport.width}x${viewport.height} ${theme.padEnd(5)} detail ${want.title.slice(0, 32)}`
      if (problems.length) {
        failures.push(label)
        console.log(`FAIL ${label}\n       ${problems.join('\n       ')}`)
      } else {
        console.log(`ok   ${label}`)
      }
    }
    await page.screenshot({ path: `${OUT}pipeline-${viewport.width}x${viewport.height}-${theme}.png` })
  }

  // "Open role" lands on the same role in Opportunities.
  const role = await page.evaluate(() => document.querySelector('.ad h2')?.textContent)
  await page.locator('.ad-tags .ob-action').click()
  await page.waitForURL((u) => u.pathname === '/opportunities' && u.searchParams.has('role'))
  await page.locator('.ob h2').waitFor({ state: 'visible', timeout: 30000 })
  const opened = await page.evaluate(() => document.querySelector('.ob h2')?.textContent)
  if (opened !== role) {
    failures.push(`pipeline ${viewport.width} open role`)
    console.log(`FAIL pipeline ${viewport.width}: Open role showed "${opened}" for "${role}"`)
  } else {
    console.log(`ok   pipeline ${viewport.width}x${viewport.height} Open role lands on ${role}`)
  }
  await page.close()
}

await browser.close()
console.log(`\n${failures.length ? `${failures.length} FAILURE(S)` : 'workbench gate passed'} across ${SIZES.length} sizes x 2 themes${ONLY ? ` (${ONLY.join(', ')})` : ''}`)
process.exit(failures.length ? 1 : 0)
