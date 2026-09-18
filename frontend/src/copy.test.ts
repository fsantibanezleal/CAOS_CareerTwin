import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Product copy rules (ADR-0067): no em-dash and no arrow in anything a person reads.
 *
 * Fifteen em-dashes had reached the interface across five pages, in both languages, among
 * them "Unlinked — add evidence" on every unevidenced skill card. The rule existed and was
 * not enforced in this repository, so it was followed by memory, which is to say not.
 *
 * Comments are exempt: they are for maintainers, not users.
 */

const SRC = join(__dirname)
const FORBIDDEN: Array<[string, string]> = [
  ['—', 'em-dash'],
  ['→', 'arrow'],
]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== 'test') out.push(...sourceFiles(path))
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

function isComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

describe('product copy', () => {
  it('uses no em-dash or arrow in any user-facing line', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (isComment(line)) return
          for (const [char, name] of FORBIDDEN) {
            if (line.includes(char)) offenders.push(`${file.slice(SRC.length + 1)}:${index + 1} ${name}: ${line.trim().slice(0, 90)}`)
          }
        })
    }
    expect(offenders).toEqual([])
  })
})
