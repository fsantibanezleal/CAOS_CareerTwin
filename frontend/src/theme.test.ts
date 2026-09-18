import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The redesign shipped and did not render.
 *
 * `tokens.css` defined a warm paper canvas with a single ink-blue accent. `styles.css`
 * still declared the whole previous palette in its own `:root` block, and `main.tsx`
 * imports it after `tokens.css`. At equal specificity the later file wins, so the app
 * kept its slate-navy canvas and neon teal accent through several releases. The one
 * token `styles.css` did not redeclare, `--font-display`, came through, which is why
 * headings turned serif while nothing else moved: the theme half-applied, which is
 * harder to diagnose than a theme that does not apply at all.
 *
 * One file owns the palette. These tests keep it that way.
 */

const SRC = join(__dirname)
const PALETTE = [
  '--bg',
  '--surface',
  '--surface-2',
  '--surface-3',
  '--line',
  '--line-soft',
  '--text',
  '--muted',
  '--faint',
  '--cyan',
  '--violet',
  '--amber',
  '--green',
  '--red',
]

function stylesheets(): string[] {
  return readdirSync(SRC).filter((name) => name.endsWith('.css'))
}

describe('theme ownership', () => {
  it('declares palette tokens in tokens.css and nowhere else', () => {
    const offenders: string[] = []
    for (const name of stylesheets()) {
      if (name === 'tokens.css') continue
      const text = readFileSync(join(SRC, name), 'utf8')
      for (const token of PALETTE) {
        // A declaration, not a `var(--bg)` reference.
        if (new RegExp(`(^|[;{\\s])${token}\\s*:`, 'm').test(text)) {
          offenders.push(`${name} declares ${token}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('defines both themes in tokens.css', () => {
    const tokens = readFileSync(join(SRC, 'tokens.css'), 'utf8')
    // The light theme is the bare :root; the app always sets data-theme explicitly.
    expect(tokens).toMatch(/:root\s*\{/)
    expect(tokens).toMatch(/:root\[data-theme="dark"\]\s*\{/)
    for (const token of PALETTE) {
      expect(tokens.includes(`${token}:`)).toBe(true)
    }
  })

  it('keeps the two themes on separately authored accents', () => {
    // Inverting a light accent for dark use produces unreadable contrast; the previous
    // dark accent sat near 1.7:1 on white. Each theme states its own value.
    const tokens = readFileSync(join(SRC, 'tokens.css'), 'utf8')
    const dark = tokens.slice(tokens.indexOf(':root[data-theme="dark"]'))
    const light = tokens.slice(0, tokens.indexOf(':root[data-theme="dark"]'))
    const accentOf = (text: string) => /--cyan:\s*([^;]+);/.exec(text)?.[1]?.trim()
    expect(accentOf(light)).toBeDefined()
    expect(accentOf(dark)).toBeDefined()
    expect(accentOf(light)).not.toEqual(accentOf(dark))
  })

  it('names no palette hue literally outside tokens.css', () => {
    // Changing a token did nothing for 56 declarations that named the previous hues
    // directly: the neon teal button, the violet avatar, every status tint. They kept
    // rendering the old design whatever tokens.css said, which is most of why the
    // redesign appeared not to have happened. Colours here come from tokens only.
    const offenders: string[] = []
    for (const name of stylesheets()) {
      if (name === 'tokens.css') continue
      const text = readFileSync(join(SRC, name), 'utf8')
      for (const [, property, value] of text.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)) {
        if (!property || !value || property.startsWith('--')) continue
        const hits = value.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g) ?? []
        for (const hit of hits) {
          // Neutral black and white overlays carry no hue and are theme-safe.
          if (/^rgba?\(\s*(0,\s*0,\s*0|255,\s*255,\s*255)/.test(hit)) continue
          offenders.push(`${name}: ${property}: ${hit}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('carries no invalid colour values', () => {
    // `--muted: #4d5a६b` sat in the light palette: a Devanagari digit inside a hex
    // colour, which the browser discards, leaving the token unset.
    for (const name of stylesheets()) {
      const text = readFileSync(join(SRC, name), 'utf8')
      // Only inside declaration values: `#root` is a selector, not a colour.
      for (const [, value] of text.matchAll(/:\s*([^;{}]+);/g)) {
        for (const [, hex] of (value ?? '').matchAll(/#([0-9a-zA-Z]{3,8})\b/g)) {
          expect(/^[0-9a-fA-F]+$/.test(hex ?? ''), `${name}: #${hex} is not a hex colour`).toBe(true)
        }
      }
    }
  })
})
