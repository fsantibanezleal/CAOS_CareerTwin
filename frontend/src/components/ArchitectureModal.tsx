import { ArchitectureModal as SharedArchitectureModal, useLangStore, type ArchitectureConfig } from '@fasl-work/caos-app-shell'
import { useEffect, useLayoutEffect } from 'react'
import { translate, useI18n } from '../i18n'

const diagrams = {
  system: {
    label: 'System',
    nodes: [
      ['skills', 'Repository skills + harness', 20, 45], ['web', 'React workbench', 20, 210],
      ['api', 'FastAPI command layer', 320, 130], ['db', 'SQLite local / PostgreSQL hosted', 650, 35],
      ['worker', 'Database-backed worker', 650, 160], ['blob', 'Encrypted blob store', 650, 285],
      ['provider', 'Managed external AI APIs', 930, 160],
    ],
    edges: [['skills', 'api'], ['web', 'api'], ['api', 'db'], ['api', 'blob'], ['worker', 'db'], ['worker', 'blob'], ['worker', 'provider']],
  },
  evidence: {
    label: 'Evidence',
    nodes: [
      ['source', 'Source snapshot', 30, 120], ['claim', 'Atomic claim', 270, 120],
      ['review', 'Human review', 510, 120], ['graph', 'Profile graph', 750, 55],
      ['score', 'Match evidence', 750, 210],
    ],
    edges: [['source', 'claim'], ['claim', 'review'], ['review', 'graph'], ['review', 'score']],
  },
  agent: {
    label: 'Agent',
    nodes: [
      ['message', 'User message', 30, 110], ['router', 'Intent router', 250, 110],
      ['specialist', 'Bounded specialist', 470, 110], ['critic', 'Evidence critic', 690, 110],
      ['preview', 'Change preview', 690, 260], ['commit', 'Deterministic commit', 470, 260],
    ],
    edges: [['message', 'router'], ['router', 'specialist'], ['specialist', 'critic'], ['critic', 'preview'], ['preview', 'commit']],
  },
  security: {
    label: 'Security',
    nodes: [
      ['cookie', 'Opaque session + CSRF', 40, 90], ['tenant', 'Tenant context', 300, 90],
      ['rls', 'PostgreSQL RLS', 570, 90], ['scan', 'Upload quarantine', 300, 250],
      ['ssrf', 'Pinned public fetch', 570, 250],
    ],
    edges: [['cookie', 'tenant'], ['tenant', 'rls'], ['tenant', 'scan'], ['tenant', 'ssrf']],
  },
  data: {
    label: 'Data',
    nodes: [
      ['person', 'One seeker', 30, 130], ['profile', 'Profile aggregate', 260, 40],
      ['jobs', 'Many opportunities', 260, 220], ['matches', 'Immutable match runs', 530, 130],
      ['actions', 'Pipeline + actions', 770, 130],
    ],
    edges: [['person', 'profile'], ['person', 'jobs'], ['profile', 'matches'], ['jobs', 'matches'], ['matches', 'actions']],
  },
  deploy: {
    label: 'Deploy',
    nodes: [
      ['tls', 'TLS reverse proxy', 40, 130], ['app', 'App container', 280, 130],
      ['worker', 'Worker container', 520, 45], ['postgres', 'Persistent Postgres', 760, 45],
      ['provider', 'Managed external AI', 760, 175], ['storage', 'Encrypted backups', 520, 275],
    ],
    edges: [['tls', 'app'], ['app', 'worker'], ['app', 'postgres'], ['worker', 'postgres'], ['worker', 'provider'], ['postgres', 'storage']],
  },
} as const

const explanations = {
  system: ['The web workbench and repository skills use the same authenticated FastAPI contracts. Native parsing, graph projection, matching and the durable database worker run locally; configured AI uses managed external APIs only. Combined batteries search Get on Board, Himalayas and Jobicy with independent coverage and continuations. Only explicit public terms leave the app, never profile or pay.', 'El panel web y las habilidades del repositorio usan los mismos contratos autenticados de FastAPI. El análisis nativo, los grafos, el ajuste y el trabajador persistente se ejecutan localmente; la IA configurada usa solo API externas gestionadas. Las baterías combinadas consultan Get on Board, Himalayas y Jobicy con cobertura y continuaciones independientes. Solo salen términos públicos explícitos, nunca perfil ni remuneración.'],
  evidence: ['A source snapshot supports an atomic claim with a locator. Proposed claims need a human decision before canonical use. Ready extraction and independent verification are different states: client outcomes may be self-reported, and metadata-only sources must not pretend that an original is attached.', 'Una instantánea respalda una afirmación con un localizador. Las propuestas necesitan una decisión humana antes del uso canónico. La extracción lista no equivale a verificación independiente: los resultados pueden ser autodeclarados, y los metadatos no sustituyen al documento original.'],
  agent: ['Intent routing selects a bounded specialist, followed by an evidence critic and a change preview. Canonical mutation requires explicit approval through deterministic commands. The database retains run state across restarts. An unconfigured provider is an unavailable capability, not a simulated answer.', 'El enrutador elige un especialista acotado, seguido por un crítico de evidencia y una vista previa de cambios. La modificación canónica exige aprobación explícita mediante comandos deterministas. La base conserva el estado entre reinicios. Un proveedor no configurado es una capacidad no disponible, no una respuesta simulada.'],
  security: ['Opaque cookies, independent CSRF tokens and workspace checks precede every private operation. PostgreSQL RLS adds defense in depth. Uploads are bounded, quarantined and malware-scanned; public fetching pins validated IPs. GitHub credentials stay in request memory. Public code contains no seeker profile, runtime key or backup.', 'Cookies opacas, CSRF independiente y comprobaciones de espacio protegen cada operación privada. RLS de PostgreSQL añade otra defensa. Las cargas son acotadas y analizadas contra malware; las consultas públicas fijan IP validadas. Los tokens de GitHub permanecen en memoria. El código público no contiene perfiles, claves ni respaldos.'],
  data: ['One account owns one professional profile and many opportunities. Graphs and matrices are projections of relational evidence, not separate truth stores. Matching uses immutable role/profile versions, separates eligibility from alignment, and does not estimate hiring probability. Explicit discovery saves attributed snapshots; private batteries never poll automatically. Career strategy separates aspirations from experience and compares only compatible fixed pay; benchmarks are not employer offers.', 'Una cuenta posee un perfil y muchas oportunidades. Grafos y matrices proyectan evidencia relacional, no otra verdad. El ajuste usa versiones inmutables, separa elegibilidad y alineación, y no estima probabilidad de contratación. La búsqueda guarda instantáneas atribuidas; las baterías privadas no se ejecutan automáticamente. La estrategia separa aspiraciones y experiencia y compara remuneración fija compatible; referencias no son ofertas del empleador.'],
  deploy: ['The optional VPS packaging runs app, worker, PostgreSQL and malware scanning behind TLS. Blobs and backups remain private and encrypted. Release gates require native tests, final-image scans and live verification. Retention protects the current release and two reviewed compatible rollback pairs; unknown images, containers and volumes are not pruned.', 'El VPS opcional ejecuta aplicación, trabajador, PostgreSQL y análisis de malware detrás de TLS. Documentos y respaldos son privados y cifrados. La entrega exige pruebas nativas, análisis de imágenes y verificación en vivo. La retención protege la versión actual y dos pares compatibles revisados; no elimina recursos ajenos.'],
} satisfies Record<keyof typeof diagrams, [string, string]>

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char)

/** Code-owned dual-language SVG: no unsafe provider markup or image-generation dependency. */
function diagramSvg(graph: typeof diagrams[keyof typeof diagrams]): string {
  const positions = new Map<string, [number, number]>(graph.nodes.map(([id, , x, y]) => [id, [x, y]]))
  const edges = graph.edges.map(([from, to]) => {
    const a = positions.get(from), b = positions.get(to)
    return a && b ? `<path d="M${a[0] + 200},${a[1] + 40} L${b[0]},${b[1] + 40}" fill="none" stroke="var(--muted)" stroke-width="2" marker-end="url(#arrow)"/>` : ''
  }).join('')
  const nodes = graph.nodes.map(([, label, x, y]) => `<g><rect x="${x}" y="${y}" width="200" height="80" rx="12" fill="var(--surface)" stroke="var(--accent)"/>${(['en', 'es'] as const).map((lang) => {
    const words = translate(lang, label).split(' '), lines: string[] = []
    for (const word of words) { const last = lines.length - 1; if (last < 0 || (lines[last]?.length ?? 0) + word.length > 23) lines.push(word); else lines[last] += ` ${word}` }
    return `<text class="l-${lang}" x="${x + 100}" y="${y + 22}" text-anchor="middle" fill="var(--text)" font-size="14" font-family="sans-serif">${lines.map((line, index) => `<tspan x="${x + 100}" dy="${index ? 19 : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`
  }).join('')}</g>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1160 430" role="img" style="width:100%;height:auto;display:block"><title>${escapeXml(graph.label)}</title><style>[data-arch-lang="en"] .l-es{display:none}[data-arch-lang="es"] .l-en{display:none}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="var(--muted)"/></marker></defs>${edges}${nodes}<a href="https://github.com/fsantibanezleal/CAOS_CareerTwin/tree/main/docs/adr" target="_blank" rel="noopener noreferrer"><text class="l-en" x="30" y="416" fill="var(--text)" font-size="16" text-decoration="underline">Read all architecture decisions</text><text class="l-es" x="30" y="416" fill="var(--text)" font-size="16" text-decoration="underline">Leer todas las decisiones de arquitectura</text></a></svg>`
}

const architectureConfig: ArchitectureConfig = {
  title_en: 'CareerTwin architecture', title_es: 'Arquitectura de CareerTwin',
  tabs: Object.entries(diagrams).map(([id, graph]) => ({ id, en: graph.label, es: translate('es', graph.label),
    body_en: `${explanations[id as keyof typeof explanations][0]}\n\nPublic decision register: github.com/fsantibanezleal/CAOS_CareerTwin/tree/main/docs/adr. Local wiki: docs/README.md. Discovery and career-strategy contracts: ADR 0031 and ADR 0033. Reachable, linked workbenches: ADR 0034.`,
    body_es: `${explanations[id as keyof typeof explanations][1]}\n\nRegistro público de decisiones: github.com/fsantibanezleal/CAOS_CareerTwin/tree/main/docs/adr. Wiki local: docs/README.md. Contratos de búsqueda y estrategia profesional: ADR 0031 y ADR 0033. Paneles accesibles e interconectados: ADR 0034.`,
    svg: diagramSvg(graph) })),
}

export function ArchitectureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = useI18n()
  const setLang = useLangStore((state) => state.setLang)
  useEffect(() => { setLang(locale) }, [locale, setLang])
  useLayoutEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
      if (!dialog) return
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((node) => node.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (!first || !last) return
      if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => { document.removeEventListener('keydown', trap); opener?.focus() }
  }, [open])
  if (!open) return null
  return <SharedArchitectureModal config={architectureConfig} onClose={onClose} />
}
