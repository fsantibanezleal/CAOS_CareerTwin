const baseInput = document.querySelector('#baseUrl')
const tokenInput = document.querySelector('#token')
const button = document.querySelector('#capture')
const statusOutput = document.querySelector('#status')
const openApp = document.querySelector('#openApp')
const defaultBaseUrl = 'https://careertwin.ml.fasl-work.com'
const allowedOrigins = new Set([
  defaultBaseUrl,
  'http://localhost:8000',
])

function normalizedBaseUrl(value) {
  const parsed = new URL(value)
  if (!allowedOrigins.has(parsed.origin) || parsed.username || parsed.password) {
    throw new Error('Use a CareerTwin origin declared in the extension manifest.')
  }
  return parsed.origin
}

async function initialize() {
  const stored = await chrome.storage.local.get(['baseUrl', 'credential'])
  try {
    baseInput.value = normalizedBaseUrl(stored.baseUrl || defaultBaseUrl)
  } catch {
    baseInput.value = defaultBaseUrl
  }
  tokenInput.value = stored.credential || ''
}

function visiblePageText() {
  const forbidden = ['script', 'style', 'noscript', 'svg', 'canvas', 'iframe']
  const clone = document.body.cloneNode(true)
  clone.querySelectorAll(forbidden.join(',')).forEach((node) => node.remove())
  return {
    url: location.href,
    title: document.title,
    content: (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 500000),
    captured_at: new Date().toISOString(),
  }
}

button.addEventListener('click', async () => {
  let baseUrl
  try {
    baseUrl = normalizedBaseUrl(baseInput.value.trim())
  } catch (error) {
    statusOutput.textContent = error instanceof Error ? error.message : 'Invalid CareerTwin address.'
    return
  }
  const credential = tokenInput.value.trim()
  if (!credential) {
    statusOutput.textContent = 'Enter the app address and the credential issued in CareerTwin.'
    return
  }
  button.disabled = true
  statusOutput.textContent = 'Capturing the visible page...'
  try {
    await chrome.storage.local.set({ baseUrl, credential })
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active page is available.')
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: visiblePageText })
    if (!result.content) throw new Error('The page contains no readable text.')
    const response = await fetch(`${baseUrl}/api/connectors/browser/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
      body: JSON.stringify(result),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.detail || `Capture failed (${response.status})`)
    statusOutput.textContent = 'Captured securely. Extraction is now running in CareerTwin.'
  } catch (error) {
    statusOutput.textContent = error instanceof Error ? error.message : 'Capture failed.'
  } finally {
    button.disabled = false
  }
})

openApp.addEventListener('click', async () => {
  try {
    await chrome.tabs.create({ url: normalizedBaseUrl(baseInput.value.trim()) })
  } catch (error) {
    statusOutput.textContent = error instanceof Error ? error.message : 'Invalid CareerTwin address.'
  }
})

initialize().catch(() => { statusOutput.textContent = 'Extension storage is unavailable.' })
