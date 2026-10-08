/** Real-API responsive UI acceptance. Credentials through environment only.
 * Requires populated synthetic data in an isolated disposable seeker. No API mocks,
 * no owner screenshots. Use CAREERTWIN_GATE_BASE/EMAIL/PASSWORD and optional
 * CAREERTWIN_GATE_PLAYWRIGHT resolution anchor. All screenshots remain ignored.
 * Pointer clicks and wheel scrolling prove reachability, not just DOM visibility.
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const { CAREERTWIN_GATE_BASE: base, CAREERTWIN_GATE_EMAIL: email, CAREERTWIN_GATE_PASSWORD: password } = process.env
assert(base && email && password && process.env.CAREERTWIN_GATE_DISPOSABLE === '1', 'Supply a disposable populated seeker through environment variables')
const require = createRequire(process.env.CAREERTWIN_GATE_PLAYWRIGHT ?? new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')
const output = fileURLToPath(new URL('../.run/ui-ux-gate/', import.meta.url))
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.CAREERTWIN_GATE_BROWSER_CHANNEL || undefined })
const failures = []
const errors = []
let executed = 0
const axePath = fileURLToPath(new URL('../frontend/node_modules/axe-core/axe.min.js', import.meta.url))
const cases = process.env.CAREERTWIN_GATE_QUICK ? [[1280, 800, 'dark', 'en'], [390, 844, 'light', 'en']] : [
  ...[1280, 1600, 2560].flatMap((width) => ['light', 'dark'].map((theme) => [width, width === 2560 ? 1440 : width === 1600 ? 900 : 800, theme, 'en'])),
  ...[390, 1440].flatMap((width) => ['light', 'dark'].flatMap((theme) => ['en', 'es'].map((locale) => [width, 844, theme, locale]))),
  [320, 568, 'light', 'en'], [844, 390, 'dark', 'en'], [640, 400, 'light', 'en'],
]

async function pointer(page, locator) {
  await locator.waitFor({ state: 'visible', timeout: 20000 })
  // Reveal through the scroll owner, then move the real pointer and verify hit testing.
  await locator.scrollIntoViewIfNeeded()
  let box = await locator.boundingBox()
  assert(box && box.width > 0 && box.height > 0, 'A real pointer target exists')
  let x, y, hit
  for (let attempt = 0; attempt < 8; attempt += 1) {
    box = await locator.boundingBox()
    x = Math.max(1, Math.min(box.x + box.width / 2, page.viewportSize().width - 1))
    y = Math.max(1, Math.min(box.y + box.height / 2, page.viewportSize().height - 1))
    hit = await locator.evaluate((el, p) => ({ ok: el.contains(document.elementFromPoint(p.x, p.y)), target: el.textContent?.trim().slice(0, 70), rect: el.getBoundingClientRect().toJSON(), hit: document.elementFromPoint(p.x, p.y)?.className }), { x, y })
    if (hit.ok) break
    // CDP nearest-scroll ignores fixed/sticky chrome. Reveal the target as a person
    // would, through wheel input inside its actual scroll owner, then hit-test again.
    const owner = await locator.evaluate((el) => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return node.getBoundingClientRect().toJSON()
      }
      return null
    })
    if (!owner) break
    await page.mouse.move(Math.max(4, owner.left + 5), Math.max(80, Math.min(owner.top + owner.height / 2, page.viewportSize().height - 90)))
    await page.mouse.wheel(0, y < 80 ? -180 : 180)
    await page.waitForTimeout(100)
  }
  assert(hit.ok, `Target is not clipped or occluded: ${JSON.stringify(hit)}`)
  await page.mouse.move(x, y, { steps: 8 })
  await page.mouse.click(x, y)
  await page.waitForTimeout(160)
}

async function wheelEnd(page, selector) {
  const region = page.locator(selector).first()
  await region.scrollIntoViewIfNeeded()
  const box = await region.boundingBox()
  assert(box, `Scroll owner ${selector} exists`)
  const visibleTop = Math.max(box.y, 80)
  const visibleBottom = Math.min(box.y + box.height, page.viewportSize().height - (page.viewportSize().width <= 900 ? 78 : 8))
  assert(visibleBottom > visibleTop, `${selector} has a usable visible scroll region`)
  await page.mouse.move(Math.min(box.x + box.width / 2, page.viewportSize().width - 8), (visibleTop + visibleBottom) / 2)
  for (let turn = 0; turn < 12; turn += 1) {
    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(70)
    if (await region.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)) return
  }
  const position = await region.evaluate((el) => ({ top: el.scrollTop, client: el.clientHeight, total: el.scrollHeight, box: el.getBoundingClientRect().toJSON() }))
  assert(position.top + position.client >= position.total - 2, `${selector} reaches its end through wheel input: ${JSON.stringify(position)}`)
}

async function fit(page, label) {
  const state = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }))
  assert.equal(state.width, state.viewportWidth, `${label}: fixed document width`)
  assert.equal(state.height, state.viewportHeight, `${label}: fixed document height`)
  assert(!(await page.getByRole('alert').filter({ hasText: /Something needs attention|Algo requiere atención/ }).count()), `${label}: no broken route`)
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.map((node) => node.target) })))
  assert.equal(violations.length, 0, `${label}: accessibility violations ${JSON.stringify(violations)}`)
}

try {
  for (const [width, height, theme, locale] of cases.filter((item) => !process.env.CAREERTWIN_GATE_CASE_FILTER || new RegExp(process.env.CAREERTWIN_GATE_CASE_FILTER).test(`${item[0]}x${item[1]}-${item[2]}-${item[3]}`))) {
    const id = `${width}x${height}-${theme}-${locale}`
    executed += 1
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
    page.on('pageerror', (error) => errors.push(`${id}: ${error.name}`))
    try {
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.locator('input[type=email]').fill(email)
      await page.locator('input[type=password]').fill(password)
      await pointer(page, page.locator('form button.primary'))
      await page.locator('.shell-main').waitFor()
      if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) {
        await pointer(page, page.locator('.topbar-actions > button').nth(1))
      }
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme)
      if (await page.evaluate(() => document.documentElement.lang) !== locale) {
        const language = page.getByRole('button', { name: /^(Switch to Spanish|Cambiar a inglés)$/ })
        if (await language.isVisible()) await pointer(page, language)
        else { await pointer(page, page.getByRole('button', { name: /^(Account menu|Menú de cuenta)$/ })); await pointer(page, page.getByRole('menuitem', { name: /^(Switch to Spanish|Cambiar a inglés)$/ })) }
      }
      assert.equal(await page.evaluate(() => document.documentElement.lang), locale)
      for (const route of ['/', '/profile', '/opportunities', '/matches', '/pipeline']) {
        await pointer(page, page.locator(`.sidebar nav a[href="${route}"]`))
        await page.waitForTimeout(300)
        await fit(page, `${id} ${route}`)
        const views = page.locator('.workbench-bar .bar-tabs button, .workbench-bar [role=tab]')
        const viewCount = await views.count()
        for (let view = 0; view < Math.max(viewCount, 1); view += 1) {
          if (viewCount) await pointer(page, views.nth(view))
          await page.waitForTimeout(250)
          const name = viewCount ? await views.nth(view).innerText() : 'primary'
          await fit(page, `${id} ${route} ${name}`)
          if (await page.locator('.sm').count()) {
            await pointer(page, page.locator('.sm-toggle input'))
            await pointer(page, page.locator('.sm-toggle input'))
            await pointer(page, page.locator('.sm-controls .ob-action'))
            await page.getByRole('dialog').waitFor()
            await page.keyboard.press('Escape')
            await pointer(page, page.locator('.identity .ob-action'))
            await page.getByRole('dialog').waitFor()
            await wheelEnd(page, '.dialog-sheet')
            await page.keyboard.press('Escape')
          }
          if (await page.locator('.profile-artifacts .cw-tabs').count()) {
            const artifactViews = page.locator('.profile-artifacts .cw-tabs button')
            for (let index = 0; index < await artifactViews.count(); index += 1) {
              await pointer(page, artifactViews.nth(index))
              await fit(page, `${id} artifact ${index}`)
              await page.screenshot({ path: `${output}${id}-artifact-${index}.png` })
            }
          }
          if (await page.locator('.landscape-controls').count()) {
            await pointer(page, page.getByText(/^(Read this landscape as a table|Leer este panorama como tabla)$/))
            const rows = page.locator('.chart-data tbody tr')
            assert(await rows.count() > 18, 'Complete table is not silently truncated at the chart limit')
            await wheelEnd(page, '.workbench-panel')
            const last = await rows.last().boundingBox(), panel = await page.locator('.workbench-panel').boundingBox()
            assert(last.y + last.height <= panel.y + panel.height + 1, 'Last expanded table row is reachable')
            await pointer(page, page.getByRole('button', { name: 'python', exact: true }))
            assert(await page.locator('.landscape-role-list button').count() > 0, 'Facet selection exposes real related saved roles')
            await pointer(page, page.locator('.landscape-role-list button').first())
            await page.locator('.ob').waitFor()
            await pointer(page, page.getByRole('tab', { name: /^(Landscape|Panorama)$/ }))
            await pointer(page, page.getByRole('button', { name: /^(Table|Tabla)$/ , exact: true }))
            assert.equal(await page.locator('.landscape-chart').count(), 0, 'Explicit table lens replaces chart')
            await pointer(page, page.getByRole('button', { name: /^(Chart|Gráfico)$/, exact: true }))
            const field = page.getByRole('textbox', { name: /^(Find a landscape signal|Buscar una señal del panorama)$/ })
            await field.fill('python')
            const chart = page.locator('.landscape-chart')
            await chart.scrollIntoViewIfNeeded()
            const box = await chart.boundingBox()
            await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45, { steps: 8 })
            await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.45)
            await page.locator('.landscape-selection').waitFor({ state: 'visible' })
            assert.equal(await page.locator('.landscape-role-list button').count(), 12, 'Real bar selection resolves all 12 saved Python roles')
            await field.fill('')
          }
          if (await page.locator('.graph-tools').count()) {
            for (const lens of ['Table', 'Matrix', 'Network']) {
              const translated = locale === 'es' ? { Table: 'Tabla', Matrix: 'Matriz', Network: 'Red' }[lens] : lens
              await pointer(page, page.getByRole('button', { name: translated, exact: true }))
              if (lens === 'Table') {
                await pointer(page, page.locator('.graph-table-entity').first())
                assert(await page.locator('.graph-inspector.open').count(), 'Table selects shared inspector')
                await wheelEnd(page, '.graph-alt-layout > .table-scroll')
              }
              await fit(page, `${id} graph ${lens}`)
            }
          }
          await page.screenshot({ path: `${output}${id}-${route.slice(1) || 'today'}-${view}.png` })
        }
      }
      await pointer(page, page.locator('.sidebar nav a[href="/opportunities"]'))
      await pointer(page, page.getByRole('button', { name: /^(Add opportunity|Agregar oportunidad)$/ }))
      const dialog = page.getByRole('dialog')
      assert(await dialog.evaluate((el) => el.contains(document.activeElement)), 'Capture receives keyboard focus')
      await page.keyboard.press('Shift+Tab')
      assert(await dialog.evaluate((el) => el.contains(document.activeElement)), 'Capture traps backward focus')
      await pointer(page, dialog.getByRole('button', { name: /^(Manual)$/ }))
      await wheelEnd(page, '.capture-modal')
      await pointer(page, dialog.getByRole('button', { name: /^(Close capture dialog|Cerrar diálogo de captura)$/ }))
      await pointer(page, page.getByRole('button', { name: /^(Portfolios|Portafolios)$/ }))
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(), 0, 'Escape closes portfolio')
      await pointer(page, page.getByRole('button', { name: /^(Account menu|Menú de cuenta)$/ }))
      await pointer(page, page.getByRole('menuitem', { name: /^(System architecture|Arquitectura del sistema)$/ }))
      const architecture = page.getByRole('dialog')
      const architectureTabs = architecture.getByRole('tab')
      assert.equal(await architectureTabs.count(), 6, 'All six architecture views are available on every viewport')
      for (let index = 0; index < 6; index += 1) {
        await pointer(page, architectureTabs.nth(index))
        assert(await architecture.locator('svg[viewBox]').count(), 'Architecture diagram exists')
        await fit(page, `${id} architecture ${index}`)
      }
      await page.keyboard.press('Escape')
      await pointer(page, page.getByRole('button', { name: /^(Account menu|Menú de cuenta)$/ }))
      await pointer(page, page.getByRole('menuitem', { name: /^(Account administration|Administración de cuentas)$/ }))
      await fit(page, `${id} admin`)
      await page.screenshot({ path: `${output}${id}-admin.png` })
      await page.keyboard.press('Control+k')
      await page.locator('.chat-drawer.open').waitFor()
      assert(await page.getByRole('textbox', { name: /^(Message|Mensaje)$/ }).evaluate((el) => el === document.activeElement), 'Chat command focuses message input')
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.chat-drawer.open').count(), 0, 'Chat closes with Escape')
      assert(await page.locator('.chat-drawer').evaluate((el) => el.inert), 'Closed chat is excluded from keyboard navigation')
      console.log(`PASS ${id}: routes, lenses, expanded table, linked roles, dialogs`)
    } catch (error) { failures.push(`${id}: ${error.message}`); console.error(`FAIL ${failures.at(-1)}`); await page.screenshot({ path: `${output}${id}-failure.png` }) }
    finally { await page.close() }
  }
} finally { await browser.close() }
writeFileSync(`${output}result.json`, JSON.stringify({ cases: executed, diagnosticSubset: Boolean(process.env.CAREERTWIN_GATE_QUICK || process.env.CAREERTWIN_GATE_CASE_FILTER), failures, errors }, null, 2))
assert.equal(errors.length, 0, `Browser errors: ${errors.join(', ')}`)
assert.equal(failures.length, 0, `${failures.length} responsive UI cases failed`)
