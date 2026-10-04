/** Rendered, real-API discovery/strategy acceptance in an explicitly disposable workspace.
 * Set CAREERTWIN_GATE_BASE/EMAIL/PASSWORD, CAREERTWIN_GATE_DISPOSABLE=1 and optionally
 * CAREERTWIN_GATE_PLAYWRIGHT to a package resolution anchor. No source API is mocked.
 * Screenshots contain only this disposable workspace and go to ignored .run/discovery-gate.
 * This mutates its private strategy/batteries; the operator must purge the disposable account.
 */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const { CAREERTWIN_GATE_BASE: base, CAREERTWIN_GATE_EMAIL: email, CAREERTWIN_GATE_PASSWORD: password } = process.env
assert(base && email && password && process.env.CAREERTWIN_GATE_DISPOSABLE === '1', 'Supply an explicitly disposable account through environment variables')
const require = createRequire(process.env.CAREERTWIN_GATE_PLAYWRIGHT ?? new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')
const output = fileURLToPath(new URL('../.run/discovery-gate/', import.meta.url))
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.CAREERTWIN_GATE_BROWSER_CHANNEL || undefined })
const errors = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (error) => errors.push(error.name))
async function language(locale) {
  if (await page.evaluate(() => document.documentElement.lang) === locale) return
  const name = locale === 'es' ? 'Switch to Spanish' : 'Cambiar a inglés'
  const button = page.getByRole('button', { name, exact: true })
  if (await button.count()) await button.first().click()
  else {
    await page.getByRole('button', { name: /^(Account menu|Menú de cuenta)$/ }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  await page.waitForFunction((value) => document.documentElement.lang === value, locale)
}
async function theme(value) {
  if (await page.evaluate(() => document.documentElement.dataset.theme) === value) return
  const name = value === 'light' ? /^(Use light theme|Usar tema claro)$/ : /^(Use dark theme|Usar tema oscuro)$/
  const button = page.getByRole('button', { name })
  if (await button.count()) await button.first().click()
  else {
    await page.getByRole('button', { name: /^(Account menu|Menú de cuenta)$/ }).click()
    await page.getByRole('menuitem', { name }).click()
  }
  await page.waitForFunction((target) => document.documentElement.dataset.theme === target, value)
}
try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/auth/login') && response.status() === 200), page.locator('form button.primary').click()])
  await page.locator('.shell-main').waitFor()
  await language('en')
  const chat = page.getByRole('button', { name: /^(Close chat|Cerrar chat)$/ })
  if (await chat.count()) await chat.click()
  await page.goto(`${base}/opportunities`)
  await page.getByRole('tab', { name: 'Discover', exact: true }).click()
  await page.getByLabel('Search terms, one per line', { exact: true }).fill('Head of Data')
  const request = page.waitForResponse((response) => response.url().endsWith('/api/job-search/battery'))
  await page.getByRole('button', { name: 'Search all selected sources', exact: true }).click()
  const response = await request
  assert.equal(response.status(), 200, 'Real combined search succeeds')
  const payload = response.request().postDataJSON()
  assert.equal(payload.searches.length, 3)
  assert.deepEqual(Object.keys(payload).sort(), ['searches', 'title_only'])
  const results = await response.json()
  assert.equal(results.coverage.length, 3)
  assert(results.coverage.some((item) => item.status === 'ok'), 'At least one actual public source responds')
  assert(results.jobs.length > 0, 'Actual source offers rendered')
  await page.locator('.job-result-row').first().waitFor()
  await page.getByText(/Saved search batteries/).click()
  await page.getByLabel('Search name', { exact: true }).fill('Disposable combined research')
  await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/job-search/batteries') && response.request().method() === 'POST' && response.status() === 201), page.getByRole('button', { name: 'Save battery', exact: true }).click()])
  await page.getByRole('option', { name: 'Disposable combined research' }).last().waitFor({ state: 'attached' })
  await Promise.all([page.waitForResponse((response) => response.url().includes('/api/job-search/batteries/') && response.request().method() === 'DELETE' && response.status() === 204), page.getByRole('button', { name: 'Delete saved battery', exact: true }).click()])
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const mode of ['light', 'dark']) {
      await theme(mode)
      for (const locale of ['en', 'es']) {
        await language(locale)
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal document overflow')
        if (width === 390 && await page.locator('.job-results-back').isVisible()) await page.locator('.job-results-back').click()
        await page.locator('.job-result-row').first().click()
        await page.locator('.job-preview h2').waitFor()
        await page.locator('.job-preview-actions').scrollIntoViewIfNeeded()
        assert(await page.locator('.job-preview-actions a').isVisible(), 'Attributed preview reachable')
        await page.screenshot({ path: `${output}/discovery-${width}-${mode}-${locale}.png` })
        if (width === 390) await page.locator('.job-results-back').click()
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await language('en')
  await page.goto(`${base}/profile`)
  await page.getByRole('button', { name: 'Career strategy', exact: true }).click()
  await page.getByLabel('Target roles, one per line', { exact: true }).fill('Head of Data\nHead of Analytics')
  await page.getByLabel('Compensation basis', { exact: true }).selectOption('gross')
  await page.getByLabel('Current fixed pay', { exact: true }).fill('100')
  await page.getByLabel('Desired increase percent', { exact: true }).fill('25')
  await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/job-search/strategy') && response.request().method() === 'PUT' && response.status() === 200), page.getByRole('button', { name: 'Save career strategy', exact: true }).click()])
  await page.getByLabel('Offer basis', { exact: true }).selectOption('gross')
  await page.getByLabel('Offer period', { exact: true }).selectOption('month')
  await page.getByLabel('Offer fixed minimum', { exact: true }).fill('140')
  await page.getByRole('button', { name: 'Compare fixed pay', exact: true }).click()
  await page.getByRole('heading', { name: 'Meets fixed-pay threshold', exact: true }).waitFor()
  await page.getByLabel('Salary evidence type', { exact: true }).selectOption('benchmark')
  assert.equal(await page.locator('.strategy-result').count(), 0, 'Editing clears stale comparison')
  await page.getByRole('button', { name: 'Compare fixed pay', exact: true }).click()
  await page.getByRole('heading', { name: 'Market benchmark only', exact: true }).waitFor()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const mode of ['light', 'dark']) {
      await theme(mode)
      await page.locator('.strategy-result').scrollIntoViewIfNeeded()
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal strategy overflow')
      await page.locator('.strategy-result li').last().scrollIntoViewIfNeeded()
      const lastNote = await page.locator('.strategy-result li').last().boundingBox()
      assert(lastNote && lastNote.y + lastNote.height <= 900 - (width === 390 ? 64 : 0), `Final explanation reachable at ${width}/${mode}: bottom=${lastNote ? lastNote.y + lastNote.height : 'missing'}`)
      await page.screenshot({ path: `${output}/strategy-${width}-${mode}.png` })
    }
  }
  assert.deepEqual(errors, [], 'No browser page errors')
  console.log(JSON.stringify({ result: 'passed', actual_sources: results.coverage.map((item) => ({ provider: item.search.provider, status: item.status, found: item.found })), unique_offers: results.jobs.length, viewports: [1440, 390], screenshots: 12, private_pay_exported: false }))
} finally { await browser.close() }
