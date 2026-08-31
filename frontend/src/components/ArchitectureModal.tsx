import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { Database, Network, ShieldCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'

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

type DiagramKey = keyof typeof diagrams

export function ArchitectureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const [active, setActive] = useState<DiagramKey>('system')
  const graph = diagrams[active]
  const nodes = useMemo<Node[]>(() => graph.nodes.map(([id, label, x, y]) => ({
    id: String(id), position: { x: Number(x), y: Number(y) }, data: { label: t(String(label)) },
    className: `architecture-node node-${id}`, sourcePosition: undefined, targetPosition: undefined,
  })), [graph, t])
  const edges = useMemo<Edge[]>(() => graph.edges.map(([source, target], index) => ({
    id: `${source}-${target}-${index}`, source, target, animated: active === 'agent',
    markerEnd: { type: MarkerType.ArrowClosed },
  })), [active, graph])
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="architecture-modal" role="dialog" aria-modal="true" aria-labelledby="architecture-title">
        <header>
          <div><span className="eyebrow"><Network size={14} /> {t('Inspectable by design')}</span><h2 id="architecture-title">{t('CareerTwin architecture')}</h2><p>{t('Six views of the public code, private data, deterministic decisions, and bounded agent layer.')}</p></div>
          <button className="icon-button" onClick={onClose} aria-label={t('Close architecture')}><X /></button>
        </header>
        <nav className="architecture-tabs" aria-label={t('Architecture diagrams')}>
          {(Object.keys(diagrams) as DiagramKey[]).map((key) => <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}>{t(diagrams[key].label)}</button>)}
        </nav>
        <div className="architecture-canvas" aria-label={t('{name} architecture diagram', { name: t(graph.label) })}>
          <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.5} maxZoom={1.5} nodesDraggable={false} nodesConnectable={false} elementsSelectable>
            <Background gap={24} size={1} /><Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <footer><span><ShieldCheck /> {t('Canonical changes require human approval')}</span><span><Database /> {t('Tenant data stays outside Git')}</span><a href="/api/docs" target="_blank" rel="noreferrer">{t('OpenAPI contract')}</a></footer>
      </section>
    </div>
  )
}
