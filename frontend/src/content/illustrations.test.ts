/**
 * The three executive illustrations (public/executive/*.svg; CAOS_MANAGE conventions/problem-context-first.md, "The illustrations"):
 * hand-authored scenes in theme tokens only, with one bilingual label set per file and, for the pain scene, an animation that has
 * its reduced-motion block. The shell gate (G10, G13, G17) measures the rendered scenes at integration; this test holds the source
 * contract on the product's side (boundary B8, contract `executive`).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'

const FRONTEND = process.cwd()
// The shell's animation analysis (gate G17) is not in the package's export map: it is loaded from its installed path.
const areas = (await import(/* @vite-ignore */ pathToFileURL(join(FRONTEND, 'node_modules/@fasl-work/caos-app-shell/gate/areas.mjs')).href)) as {
  analyseSvgAnimation: (text: string) => { animated: boolean; css: boolean; smil: boolean; reducedBlock: boolean; neutralises: boolean; seconds: number }
  animationFailures: (a: unknown, name: string) => string[]
}
const { analyseSvgAnimation, animationFailures } = areas
const NAMES = ['pain', 'situation', 'proposal'] as const
type Name = (typeof NAMES)[number]
const read = (path: string): string => readFileSync(join(FRONTEND, path), 'utf8')
const files = Object.fromEntries(NAMES.map((n) => [n, read(`public/executive/${n}.svg`)])) as Record<Name, string>
const shellCss = read('node_modules/@fasl-work/caos-app-shell/styles.css')
const shellTokens = new Set(shellCss.match(/--color-[a-z0-9-]+/g) ?? [])

interface Tag {
  name: string
  attrs: string
  kind: 'open' | 'close' | 'self'
}

/** Opening and closing tags with their attribute text, enough to prove the file is balanced XML. */
function tags(svg: string): Tag[] {
  const body = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '<style></style>')
  const out: Tag[] = []
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    out.push({ name: m[2] ?? '', attrs: m[3] ?? '', kind: m[1] ? 'close' : m[4] ? 'self' : 'open' })
  }
  return out
}

function attr(attrs: string, name: string): string | undefined {
  return new RegExp(String.raw`(?:^|\s)${name}="([^"]*)"`).exec(attrs)?.[1]
}

const num = (v: string | undefined): number => Number(v ?? 'NaN')

/**
 * The width in px of every label line at size 22 and weight 600, measured in Chromium as the larger of Verdana and DejaVu Sans
 * (the shell gate's wide fonts) and the shell's own sans: a chip needs this plus 16 units of padding (gate G10).
 */
const WIDTH22: Record<string, number> = {
  'Auditor': 92.5,
  'Automated': 137.3,
  'Bolsa de': 105.7,
  'Casi': 51.6,
  'Checklist:': 121.9,
  'Coaching:': 122.6,
  'Cribado': 96,
  'Director de': 139.4,
  'Escrita por': 134.3,
  'Escritura': 111.4,
  'Evidence': 111.2,
  'Evidencia': 118.7,
  'Fewer': 76,
  'Filters read': 143.5,
  'Filtros leen': 140.4,
  'Habilidades:': 154.8,
  'Head of': 96.3,
  'Hiring': 75.8,
  'Jefe': 50.7,
  'Job': 42.7,
  'Lista corta,': 140.4,
  'Lista:': 68.8,
  'Many': 66.8,
  'Menos': 80.7,
  'Muchos': 94.5,
  'Nada se': 99.5,
  'Nearly': 80.9,
  'No exact': 108.7,
  'Nothing': 98.7,
  'Oficina de': 125.2,
  'Openings': 117.1,
  'Paso': 59,
  'Período': 95.4,
  'Profesional': 140.4,
  'Professional': 153.5,
  'Public job': 122,
  'Reclutador': 135.2,
  'Recruiter': 115.3,
  'Registro de': 143.1,
  'Regulador': 127.4,
  'Regulator,': 129.1,
  'Requirements': 173.7,
  'Requisitos': 130.2,
  'Short list,': 122.7,
  'Sin palabra': 141.1,
  'Skills lists:': 134.5,
  'Thin': 53.9,
  'Vacantes': 112.8,
  'Work': 65.6,
  'Writing aid:': 146.3,
  'Written by': 131.6,
  'acumulados': 148.5,
  'asistida:': 106,
  'auditor': 90.3,
  'automático': 140.1,
  'board': 72.3,
  'caro y de': 114.2,
  'clave exacta': 154.7,
  'completas': 127.8,
  'con motivos': 150.1,
  'contratante': 146.5,
  'costly,': 80.9,
  'empleo': 91.2,
  'empleo: puede': 184.6,
  'errar': 62.3,
  'estrecho': 108.1,
  'evidencia': 118.6,
  'faltante': 98.4,
  'gap': 46.3,
  'hand-off': 105.7,
  'indicios': 95.3,
  'keyword': 106.7,
  'machine': 104.6,
  'manager': 109.8,
  'measured': 123,
  'meses': 79,
  'mide': 61.1,
  'misjudge': 113.8,
  'missing': 95.6,
  'modest gains': 166.9,
  'months': 93,
  'mostly talk': 138.7,
  'máquina': 107.2,
  'más anuncio': 156.1,
  'office: may': 137.7,
  'people': 84,
  'personas': 113.3,
  'piled up': 100.6,
  'poco efecto': 144.8,
  'proxies': 91.5,
  'record': 80.5,
  'screen': 82.5,
  'señal débil': 135.2,
  'sin empleo': 135.1,
  'the signal': 123.2,
  'usada y': 96.2,
  'usada y falta': 161.2,
  'used and': 113.3,
  'used, missing': 171.1,
  'weakens': 109,
  'whole': 74.5,
  'with reasons': 159.4,
  'y auditor': 112.3,
}

interface Label {
  lang: string
  x: number
  y: number
  size: number
  text: string
}

/** Every text element with its language, anchor, size and content (the content of a tspan line is joined). */
function labels(svg: string): Label[] {
  const body = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  const out: Label[] = []
  for (const m of body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    out.push({
      lang: attr(m[1] ?? '', 'data-lang') ?? '',
      x: num(attr(m[1] ?? '', 'x')),
      y: num(attr(m[1] ?? '', 'y')),
      size: num(attr(m[1] ?? '', 'font-size')),
      text: (m[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}

describe('the executive illustrations of CareerTwin', () => {
  it('each file is balanced XML with a viewBox, a role, an English aria-label and a title', () => {
    for (const n of NAMES) {
      const all = tags(files[n])
      const stack: string[] = []
      for (const t of all) {
        if (t.kind === 'open') stack.push(t.name)
        else if (t.kind === 'close') expect(stack.pop(), `${n}: unbalanced </${t.name}>`).toBe(t.name)
      }
      expect(stack, `${n}: unclosed`).toEqual([])
      const root = all[0] ?? { name: '', attrs: '', kind: 'open' as const }
      expect(root.name).toBe('svg')
      expect(attr(root.attrs, 'viewBox') ?? '', `${n}: viewBox`).toMatch(/^0 0 \d+ \d+$/)
      expect(attr(root.attrs, 'role'), `${n}: role`).toBe('img')
      expect((attr(root.attrs, 'aria-label') ?? '').length, `${n}: aria-label`).toBeGreaterThan(20)
      expect(files[n], `${n}: title`).toMatch(/<title>[^<]{20,}<\/title>/)
      expect(files[n].length, `${n}: under 60 KB`).toBeLessThan(60_000)
    }
  })

  it('every fill and stroke is a theme token, none or currentColor, in attributes and in the style block', () => {
    const ok = /^(var\(--color-[a-z0-9-]+\)|none|currentColor)$/
    for (const n of NAMES) {
      for (const m of files[n].matchAll(/\s(?:fill|stroke|stop-color|flood-color)="([^"]*)"/g)) {
        expect(m[1], `${n}: attribute colour`).toMatch(ok)
      }
      for (const m of files[n].matchAll(/(?:^|[;{\s"])(?:fill|stroke|stop-color|flood-color|color|background|background-color)\s*:\s*([^;}"]+)/g)) {
        expect((m[1] ?? '').trim(), `${n}: style colour`).toMatch(ok)
      }
      expect(files[n].replace(/<title>[\s\S]*?<\/title>/, ''), `${n}: a hex colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(files[n], `${n}: a functional colour`).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/)
    }
  })

  it('every --color-* used is defined by the installed shell', () => {
    for (const n of NAMES) {
      const used = new Set(files[n].match(/--color-[a-z0-9-]+/g) ?? [])
      expect(used.size, `${n}: uses tokens`).toBeGreaterThan(4)
      for (const t of used) expect(shellTokens.has(t), `${n}: ${t} is not a shell token`).toBe(true)
    }
  })

  it('every text carries data-lang en or es, the two sets are equal, sized 22 or more, with no font family', () => {
    for (const n of NAMES) {
      const texts = tags(files[n]).filter((t) => t.name === 'text' && t.kind === 'open')
      expect(texts.length, `${n}: labels`).toBeGreaterThanOrEqual(8)
      const count = { en: 0, es: 0 }
      for (const t of texts) {
        const lang = attr(t.attrs, 'data-lang')
        expect(['en', 'es'], `${n}: data-lang`).toContain(lang)
        count[lang as 'en' | 'es'] += 1
        expect(num(attr(t.attrs, 'font-size')), `${n}: font-size`).toBeGreaterThanOrEqual(22)
        expect(t.attrs, `${n}: font-family`).not.toMatch(/font-family/)
      }
      expect(count.en, `${n}: en and es label counts`).toBe(count.es)
      expect(files[n].replace(/<style[\s\S]*?<\/style>/g, ''), `${n}: font-family`).not.toMatch(/font-family/)
      expect(files[n].match(/<style[\s\S]*?<\/style>/g)?.join('') ?? '', `${n}: font-family in style`).not.toMatch(/font-family/)
    }
  })

  it('no chart marker, raster image, link or event attribute, and no dash or emoji in a label or comment', () => {
    for (const n of NAMES) {
      expect(files[n], `${n}: data-chart`).not.toMatch(/data-chart/)
      expect(files[n], `${n}: image`).not.toMatch(/<image\b|<foreignObject\b|<script\b/i)
      expect(files[n], `${n}: href`).not.toMatch(/\s(?:xlink:)?href=/i)
      expect(files[n], `${n}: event attribute`).not.toMatch(/\son[a-z]+\s*=/i)
      expect(files[n], `${n}: em-dash, arrow or emoji`).not.toMatch(/[—→←↔⇒\u{1F000}-\u{1FFFF}☀-➿]/u)
    }
  })

  it('every label sits on a chip: centred on a rect inside the frame, no chip over another', () => {
    for (const n of NAMES) {
      const all = tags(files[n])
      const view = (attr(all[0]?.attrs ?? '', 'viewBox') ?? '').split(' ').map(Number)
      const vw = view[2] ?? 0
      const vh = view[3] ?? 0
      const chips = all
        .filter((t) => t.name === 'rect' && attr(t.attrs, 'data-chip') !== undefined)
        .map((t) => ({ x: num(attr(t.attrs, 'x')), y: num(attr(t.attrs, 'y')), w: num(attr(t.attrs, 'width')), h: num(attr(t.attrs, 'height')) }))
      const ls = labels(files[n]).filter((l) => l.lang === 'en')
      expect(chips.length, `${n}: chips`).toBe(ls.length)
      for (const c of chips) {
        expect(c.x, `${n}: chip left`).toBeGreaterThanOrEqual(2)
        expect(c.y, `${n}: chip top`).toBeGreaterThanOrEqual(2)
        expect(c.x + c.w, `${n}: chip right`).toBeLessThanOrEqual(vw - 2)
        expect(c.y + c.h, `${n}: chip bottom`).toBeLessThanOrEqual(vh - 2)
      }
      for (let i = 0; i < chips.length; i += 1) {
        for (let j = i + 1; j < chips.length; j += 1) {
          const a = chips[i] as (typeof chips)[number]
          const b = chips[j] as (typeof chips)[number]
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
          expect(apart, `${n}: chips ${i} and ${j} overlap`).toBe(true)
        }
      }
      for (const l of labels(files[n])) {
        expect(chips.some((c) => l.x > c.x && l.x < c.x + c.w && l.y > c.y && l.y < c.y + c.h), `${n}: "${l.text}" is off every chip`).toBe(true)
      }
    }
  })

  it('every chip is wide enough for its widest line plus 16 units and two-line labels are at least 26 units apart', () => {
    for (const n of NAMES) {
      const all = tags(files[n])
      const chips = all.filter((t) => t.name === 'rect' && attr(t.attrs, 'data-chip') !== undefined)
      const body = files[n].replace(/<style[\s\S]*?<\/style>/g, '')
      const texts = [...body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)]
      for (const m of texts) {
        const x = num(attr(m[1] ?? '', 'x'))
        const y = num(attr(m[1] ?? '', 'y'))
        const lines = [...(m[2] ?? '').matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)].map((t) => ({ dy: num(attr(t[1] ?? '', 'dy')), s: t[2] ?? '' }))
        const strings = lines.length ? lines.map((l) => l.s) : [(m[2] ?? '').trim()]
        for (const s of strings) expect(WIDTH22[s], `${n}: "${s}" has no measured width`).toBeGreaterThan(0)
        const need = Math.max(...strings.map((s) => WIDTH22[s] ?? 0)) + 16
        const chip = chips.find((c) => x > num(attr(c.attrs, 'x')) && x < num(attr(c.attrs, 'x')) + num(attr(c.attrs, 'width')) && y > num(attr(c.attrs, 'y')) && y < num(attr(c.attrs, 'y')) + num(attr(c.attrs, 'height')))
        expect(chip, `${n}: "${strings[0]}" has no chip`).toBeDefined()
        expect(num(attr(chip?.attrs ?? '', 'width')), `${n}: chip of "${strings.join(' ')}" is narrower than ${need}`).toBeGreaterThanOrEqual(need - 0.5)
        for (const l of lines.slice(1)) expect(l.dy, `${n}: line spacing of "${strings.join(' ')}"`).toBeGreaterThanOrEqual(26)
        // the last baseline keeps its descenders inside the chip
        const h = num(attr(chip?.attrs ?? '', 'height'))
        const top = num(attr(chip?.attrs ?? '', 'y'))
        const last = y + lines.slice(1).reduce((a, l) => a + l.dy, 0)
        expect(top + h - last, `${n}: "${strings.join(' ')}" descenders`).toBeGreaterThanOrEqual(7)
      }
    }
  })

  it('the three drawings share one layout: every place keeps its position, the core places are in all three', () => {
    const places = (svg: string): Map<string, string> =>
      new Map(
        tags(svg)
          .filter((t) => attr(t.attrs, 'data-place') !== undefined)
          .map((t) => [attr(t.attrs, 'data-place') as string, attr(t.attrs, 'transform') ?? ''] as [string, string]),
      )
    const core = ['calendar', 'professional', 'folder', 'gate-board', 'gate-screen', 'gate-recruiter', 'note', 'table', 'openings', 'flow']
    const all = NAMES.map((n) => places(files[n]))
    for (const [i, m] of all.entries()) for (const c of core) expect(m.has(c), `${NAMES[i]}: place ${c}`).toBe(true)
    for (const c of core) expect(new Set(all.map((m) => m.get(c))).size, `place ${c} moves between drawings`).toBe(1)
    // a place that appears in two drawings sits at the same position in both
    const names = new Set(all.flatMap((m) => [...m.keys()]))
    for (const nm of names) {
      const at = all.map((m) => m.get(nm)).filter((v) => v !== undefined)
      expect(new Set(at).size, `place ${nm} moves between drawings`).toBe(1)
    }
    // the pain and the proposal carry the same places; the situation adds the roles and the approaches
    expect([...(all[0] ?? new Map()).keys()].filter((k) => !(all[2] ?? new Map()).has(k)), 'pain places missing from the proposal').toEqual(['caught'])
    expect(labels(files.pain).filter((l) => l.lang === 'en').length).toBeGreaterThanOrEqual(8)
  })

  it('the pain scene is animated within ten seconds and stops under reduced motion; the others are stills', () => {
    const pain = analyseSvgAnimation(files.pain)
    expect(pain.animated).toBe(true)
    expect(pain.css).toBe(true)
    expect(pain.smil).toBe(false)
    expect(pain.reducedBlock).toBe(true)
    expect(pain.neutralises).toBe(true)
    expect(pain.seconds).toBeGreaterThan(0)
    expect(pain.seconds).toBeLessThanOrEqual(10)
    expect(animationFailures(pain, 'pain')).toEqual([])
    expect(files.pain).toMatch(/@keyframes/)
    expect(files.pain).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    for (const n of ['situation', 'proposal'] as const) {
      expect(animationFailures(analyseSvgAnimation(files[n]), n)).toEqual([])
    }
  })

  it('the Spanish set mirrors the English set position by position and carries the glossary terms', () => {
    for (const n of NAMES) {
      const en = labels(files[n]).filter((l) => l.lang === 'en')
      const es = labels(files[n]).filter((l) => l.lang === 'es')
      expect(es.length).toBe(en.length)
      for (let i = 0; i < en.length; i += 1) {
        expect(es[i]?.x, `${n}: label ${i} x`).toBe(en[i]?.x)
        expect(es[i]?.y, `${n}: label ${i} y`).toBe(en[i]?.y)
      }
    }
    const allEs = NAMES.flatMap((n) => labels(files[n]).filter((l) => l.lang === 'es').map((l) => l.text.toLowerCase())).join(' | ')
    for (const term of ['reclutador', 'vacantes']) expect(allEs, term).toContain(term)
    expect(allEs).toContain('jefe contratante')
  })
})
