import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { spanishMessages, translate } from './i18n'

describe('Spanish coverage', () => {
  it('covers every literal translation key used by the interface', () => {
    const sourceRoot = join(process.cwd(), 'src')
    const files = readdirSync(sourceRoot, { recursive: true })
      .map((entry) => join(sourceRoot, String(entry)))
      .filter((entry) => ['.ts', '.tsx'].includes(extname(entry)) && !entry.endsWith('i18n.tsx'))
    const used = new Set<string>()
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const syntax = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, syntax)
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && node.expression.text === 't'
          && node.arguments[0]
          && ts.isStringLiteralLike(node.arguments[0])
        ) used.add(node.arguments[0].text)
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    const missing = [...used].filter((key) => !(key in spanishMessages)).sort()
    expect(missing).toEqual([])
  })

  it('translates the control-room copy that is visible immediately after login', () => {
    expect(translate('es', 'Your career control room')).toBe('Tu centro de control profesional')
    expect(translate('es', 'Profile completeness')).toBe('Completitud del perfil')
    expect(translate('es', 'Next best moves')).toBe('Próximos mejores pasos')
    expect(translate('es', 'Application flow')).toBe('Flujo de postulaciones')
  })
})
