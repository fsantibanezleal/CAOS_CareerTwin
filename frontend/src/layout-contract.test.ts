import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

describe('viewport ownership contract', () => {
  it('keeps the browser document fixed and gives long content one internal scroll owner', () => {
    expect(stylesheet).toMatch(/html, body, #root \{[^}]*height: 100%[^}]*overflow: hidden/s)
    expect(stylesheet).toMatch(/\.app-shell \{[^}]*height: 100dvh[^}]*grid-template-rows: minmax\(0, 1fr\)[^}]*overflow: hidden/s)
    expect(stylesheet).toMatch(/\.shell-main \{[^}]*min-height: 0[^}]*overflow-x: hidden[^}]*overflow-y: auto/s)
  })

  it('moves mobile navigation clearance into the owned content scroller', () => {
    expect(stylesheet).toMatch(/@media \(max-width: 900px\)[^{]*\{[\s\S]*?\.app-shell \{[^}]*padding-bottom: 0/s)
    expect(stylesheet).toMatch(/\.content \{[^}]*padding:[^;}]*calc\(106px \+ env\(safe-area-inset-bottom\)\)/s)
    expect(stylesheet).toMatch(/@media \(max-width: 620px\)[^{]*\{[\s\S]*?\.content \{[^}]*calc\(101px \+ env\(safe-area-inset-bottom\)\)/s)
  })

  it('keeps login and boot overflow inside their viewport surfaces', () => {
    expect(stylesheet).toMatch(/\.boot-screen \{[^}]*height: 100dvh[^}]*overflow-y: auto/s)
    expect(stylesheet).toMatch(/\.login-page \{[^}]*height: 100dvh[^}]*overflow-y: auto/s)
  })

  it('reveals the skip link only when a keyboard user focuses it', () => {
    expect(stylesheet).toMatch(/\.skip-link \{[^}]*position: fixed[^}]*translateY\(calc\(-100% - 24px\)\)/s)
    expect(stylesheet).toMatch(/\.skip-link:focus \{[^}]*translateY\(0\)/s)
  })
})
