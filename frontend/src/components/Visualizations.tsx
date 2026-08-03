import { SigmaContainer, useLoadGraph, useRegisterEvents, useSetSettings, useSigma } from '@react-sigma/core'
import Graph from 'graphology'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Landscape, MatchRun, OpportunityGraphData, ProfileGraphData } from '../types'
import { EChart } from './EChart'
import { EmptyState } from './Primitives'

const palette: Record<string, string> = {
  profile: '#7c6cff', skill: '#3ddbd9', experience: '#ffb45e', education: '#ed77d4',
  accomplishment: '#f5d76e', evidence: '#6be39a', source: '#84a5ff', requirement: '#ff7d91',
  opportunity: '#7c6cff', employer: '#84a5ff', industry: '#ed77d4', seniority: '#ffb45e',
  location: '#6be39a', work_mode: '#3ddbd9', target_set: '#f5d76e', unknown: '#8090a8',
}

type GraphNode = ProfileGraphData['graph']['nodes'][number]
type GraphEdge = ProfileGraphData['graph']['edges'][number]

function RelationshipGraphLoader({ data }: { data: ProfileGraphData['graph'] }) {
  const loadGraph = useLoadGraph()
  useEffect(() => {
    const graph = new Graph({ multi: true, type: 'undirected' })
    const total = Math.max(data.nodes.length, 1)
    data.nodes.forEach((node, index) => {
      const angle = (index / total) * Math.PI * 2
      const level = node.type === 'profile' ? 0 : 1 + (index % 4) * 0.16
      graph.addNode(node.id, {
        label: node.label,
        nodeType: node.type,
        record: node,
        x: node.type === 'profile' ? 0 : Math.cos(angle) * level,
        y: node.type === 'profile' ? 0 : Math.sin(angle) * level,
        size: node.type === 'profile' ? 18 : node.type === 'opportunity' || node.type === 'target_set' ? 11 : 7 + Number(node['strength'] ?? 0) * 7,
        color: palette[node.type] ?? palette.unknown,
      })
    })
    data.edges.forEach((edge, index) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdgeWithKey(edge.id || `edge-${index}`, edge.source, edge.target, {
          color: '#536079', size: Math.max(0.8, Number(edge['weight'] ?? 1) * 1.5), relation: String(edge['type'] ?? 'related'), record: edge,
        })
      }
    })
    graph.forEachNode((id, attributes) => {
      const degree = graph.degree(id)
      graph.setNodeAttribute(id, 'degree', degree)
      graph.setNodeAttribute(id, 'size', attributes.nodeType === 'profile' ? 19 : attributes.nodeType === 'opportunity' || attributes.nodeType === 'target_set' ? 10 + Math.sqrt(Math.max(1, degree)) * 3 : 6 + Math.sqrt(Math.max(1, degree)) * 3 + Number(attributes.record?.strength ?? 0) * 4)
    })
    loadGraph(graph)
  }, [data, loadGraph])
  return null
}

function RelationshipGraphController({ query, type, selected, onSelect }: { query: string; type: string; selected?: string; onSelect: (id?: string) => void }) {
  const sigma = useSigma()
  const registerEvents = useRegisterEvents()
  const setSettings = useSetSettings()
  const [hovered, setHovered] = useState<string>()
  useEffect(() => registerEvents({
    enterNode: ({ node }) => setHovered(node),
    leaveNode: () => setHovered(undefined),
    clickNode: ({ node }) => onSelect(node),
    clickStage: () => onSelect(undefined),
  }), [onSelect, registerEvents])
  useEffect(() => {
    const graph = sigma.getGraph()
    const neighbors = hovered ? new Set([hovered, ...graph.neighbors(hovered)]) : undefined
    const normalized = query.trim().toLocaleLowerCase()
    setSettings({
      nodeReducer: (node, attributes) => {
        const result = { ...attributes }
        const matchesType = !type || attributes.nodeType === type
        const matchesQuery = !normalized || String(attributes.label ?? '').toLocaleLowerCase().includes(normalized)
        if (!matchesType || !matchesQuery || (neighbors && !neighbors.has(node))) {
          result.color = '#293246'
          result.label = ''
        }
        if (node === hovered || node === selected) {
          result.highlighted = true
          result.size = Number(attributes.size ?? 8) * 1.35
          result.zIndex = 2
        }
        return result
      },
      edgeReducer: (edge, attributes) => {
        const result = { ...attributes }
        if (hovered && !graph.extremities(edge).includes(hovered)) {
          result.hidden = true
        } else if (hovered) {
          result.color = '#8da4cc'
          result.size = Number(attributes.size ?? 1) * 1.8
        }
        return result
      },
    })
    sigma.refresh()
  }, [hovered, query, selected, setSettings, sigma, type])
  return null
}

function GraphMatrix({ nodes, edges, onSelect }: { nodes: GraphNode[]; edges: GraphEdge[]; onSelect: (id: string) => void }) {
  const { t } = useI18n()
  const ranked = useMemo(() => [...nodes].sort((left, right) => {
    const degree = (id: string) => edges.filter((edge) => edge.source === id || edge.target === id).length
    return degree(right.id) - degree(left.id) || left.label.localeCompare(right.label)
  }).slice(0, 28), [edges, nodes])
  const edgeMap = useMemo(() => new Map(edges.flatMap((edge) => [[`${edge.source}|${edge.target}`, edge], [`${edge.target}|${edge.source}`, edge]])), [edges])
  return <div className="graph-matrix-shell" role="region" aria-label={t('Degree-ranked adjacency matrix')}><div className="graph-matrix" style={{ gridTemplateColumns: `minmax(150px, 1fr) repeat(${ranked.length}, 18px)` }}><span />{ranked.map((node) => <button key={`head-${node.id}`} className="matrix-node-head" title={node.label} aria-label={t('Inspect {label}', { label: node.label })} onClick={() => onSelect(node.id)}><i style={{ background: palette[node.type] ?? palette.unknown }} /></button>)}{ranked.map((row) => <div className="matrix-line" key={row.id} style={{ gridColumn: `1 / span ${ranked.length + 1}`, gridTemplateColumns: `minmax(150px, 1fr) repeat(${ranked.length}, 18px)` }}><button className="matrix-label" onClick={() => onSelect(row.id)}>{row.label}</button>{ranked.map((column) => { const edge = edgeMap.get(`${row.id}|${column.id}`); const label = edge ? `${row.label} — ${String(edge['type'] ?? 'related')} — ${column.label}` : `${row.label} / ${column.label}`; return <button key={column.id} className={`matrix-cell ${edge ? 'linked' : ''}`} style={edge ? { background: palette[row.type] ?? palette.unknown, opacity: 0.35 + Number(edge['weight'] ?? 0.5) * 0.5 } : undefined} title={label} aria-label={label} onClick={() => onSelect(edge ? row.id : column.id)} /> })}</div>)}</div></div>
}

function RelationshipAtlas({ data, variant }: { data: ProfileGraphData['graph']; variant: 'profile' | 'opportunity' }) {
  const { t } = useI18n()
  const [lens, setLens] = useState<'network' | 'matrix' | 'table'>('network')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const types = useMemo(() => [...new Set(data.nodes.map((node) => node.type))].sort(), [data.nodes])
  const visibleNodes = useMemo(() => data.nodes.filter((node) => (!type || node.type === type) && (!query.trim() || node.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))), [data.nodes, query, type])
  const selected = data.nodes.find((node) => node.id === selectedId)
  const selectedEdges = selected ? data.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id) : []
  const other = (edge: GraphEdge) => data.nodes.find((node) => node.id === (edge.source === selectedId ? edge.target : edge.source))
  if (!data.nodes.length) return <EmptyState title={t(variant === 'profile' ? 'Your constellation is waiting' : 'Your opportunity network is waiting')} description={t(variant === 'profile' ? 'Confirm evidence and add skills to connect your professional story.' : 'Capture opportunities and review their requirements to reveal your search network.')} />
  return (
    <div className="visual-stack">
      <div className="visual-toolbar graph-tools"><label className="graph-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('Search graph entities')} placeholder={t(variant === 'profile' ? 'Find an entity or evidence claim…' : 'Find a role, employer, or requirement…')} /></label><select value={type} onChange={(event) => setType(event.target.value)} aria-label={t('Filter graph by entity type')}><option value="">{t('All entity types')}</option>{types.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select><div className="segmented"><button className={lens === 'network' ? 'active' : ''} aria-pressed={lens === 'network'} onClick={() => setLens('network')}>{t('Network')}</button><button className={lens === 'matrix' ? 'active' : ''} aria-pressed={lens === 'matrix'} onClick={() => setLens('matrix')}>{t('Matrix')}</button><button className={lens === 'table' ? 'active' : ''} aria-pressed={lens === 'table'} onClick={() => setLens('table')}>{t('Table')}</button></div><span aria-live="polite">{t('{visible} of {nodes} nodes · {edges} typed links', { visible: visibleNodes.length, nodes: data.nodes.length, edges: data.edges.length })}</span></div>
      {lens === 'table' ? (
        <div className="table-scroll"><table><thead><tr><th>{t('Entity')}</th><th>{t('Type')}</th><th>{t('Connections')}</th></tr></thead><tbody>{visibleNodes.map((node) => <tr key={node.id}><td>{node.label}</td><td><span className={`entity-dot type-${node.type}`} />{t(node.type)}</td><td>{data.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length}</td></tr>)}</tbody></table></div>
      ) : lens === 'matrix' ? <GraphMatrix nodes={visibleNodes} edges={data.edges} onSelect={setSelectedId} /> : (
        <div className="graph-workbench">
        <div className="sigma-stage" role="img" aria-label={t(variant === 'profile' ? 'Interactive professional evidence network' : 'Interactive opportunity knowledge network')}>
          <SigmaContainer settings={{ renderEdgeLabels: false, labelDensity: 0.09, labelGridCellSize: 80, allowInvalidContainer: true, enableEdgeEvents: true, zIndex: true }}><RelationshipGraphLoader data={data} /><RelationshipGraphController query={query} type={type} selected={selectedId} onSelect={setSelectedId} /></SigmaContainer>
          <div className="graph-legend">{types.map((item) => <button key={item} className={type === item ? 'active' : ''} aria-pressed={type === item} onClick={() => setType(type === item ? '' : item)}><i style={{ background: palette[item] ?? palette.unknown }} />{t(item)}</button>)}</div>
        </div>
        <aside className={`graph-inspector ${selected ? 'open' : ''}`}>{selected ? <><header><div><span><i style={{ background: palette[selected.type] ?? palette.unknown }} />{t(selected.type)}</span><h3>{selected.label}</h3></div><button className="icon-button" onClick={() => setSelectedId(undefined)} aria-label={t('Close graph inspector')}><X /></button></header><div className="inspector-metrics">{selected['strength'] !== undefined && <span><b>{Math.round(Number(selected['strength']) * 100)}%</b>{t('Strength')}</span>}{selected['confidence'] !== undefined && <span><b>{Math.round(Number(selected['confidence']) * 100)}%</b>{t('Confidence')}</span>}<span><b>{selectedEdges.length}</b>{t('Connections')}</span></div><dl>{Object.entries(selected).filter(([key, value]) => !['id', 'label', 'type', 'strength', 'confidence'].includes(key) && value !== undefined && value !== null && value !== '').map(([key, value]) => <div key={key}><dt>{t(key.replaceAll('_', ' '))}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl><section><h4>{t('Typed relationships')}</h4>{selectedEdges.map((edge) => <button key={edge.id} onClick={() => setSelectedId(other(edge)?.id)}><span>{t(String(edge['type'] ?? 'related'))}</span><b>{other(edge)?.label}</b></button>)}</section></> : <div className="inspector-empty"><h3>{t(variant === 'profile' ? 'Inspect an evidence path' : 'Inspect a search relationship')}</h3><p>{t(variant === 'profile' ? 'Select a node to see its exact metadata and typed relationships. Hover to isolate its neighborhood.' : 'Select a node to inspect how roles, requirements, employers, and search scenarios connect.')}</p></div>}</aside>
        </div>
      )}
    </div>
  )
}

export function ProfileConstellation({ data }: { data: ProfileGraphData['graph'] }) {
  return <RelationshipAtlas data={data} variant="profile" />
}

export function OpportunityNetwork({ data }: { data: OpportunityGraphData['graph'] }) {
  return <RelationshipAtlas data={data} variant="opportunity" />
}

export function CareerRiver({ rows }: { rows: ProfileGraphData['river'] }) {
  const { t } = useI18n()
  const lanes = ['experience', 'education']
  const data = rows.map((row, index) => ({
    value: [String(row['start'] || t('Unknown')), lanes.indexOf(row.kind), String(row['end'] || ''), row.title],
    name: row.title,
    itemStyle: { color: palette[row.kind] ?? palette.unknown },
    symbolSize: 13 + (index % 3) * 2,
  }))
  if (!rows.length) return <EmptyState title={t('No career timeline yet')} description={t('Add experience and education to reveal the arc of your career.')} />
  return <EChart className="echart river-chart" ariaLabel={t('Career timeline chart')} option={{
    animationDuration: 600,
    tooltip: { trigger: 'item', formatter: (value: { data: { value: string[] } }) => `<b>${value.data.value[3]}</b><br/>${value.data.value[0]} – ${value.data.value[2] || t('present')}` },
    grid: { left: 100, right: 30, top: 30, bottom: 60 },
    xAxis: { type: 'time', axisLabel: { color: '#8d9ab0' }, splitLine: { lineStyle: { color: '#253048' } } },
    yAxis: { type: 'category', data: [t('Experience'), t('Education')], axisLabel: { color: '#aeb9cc' }, axisLine: { show: false } },
    series: [{ type: 'scatter', data, symbol: 'circle', emphasis: { scale: 1.4 } }],
  }} />
}

export function EvidenceMatrix({ rows }: { rows: ProfileGraphData['matrix'] }) {
  const { plural, t } = useI18n()
  if (!rows.length) return <EmptyState title={t('No evidence matrix yet')} description={t('Link confirmed evidence to skills to distinguish supported capability from unverified claims.')} />
  return (
    <div className="evidence-matrix" role="table" aria-label={t('Skill evidence matrix')}>
      <div className="matrix-head" role="row"><span>{t('Skill')}</span><span>{t('Level')}</span><span>{t('Confidence')}</span><span>{t('Evidence')}</span></div>
      {rows.map((row) => <div className="matrix-row" role="row" key={row.skill_id}><strong>{row.skill}</strong><span><i style={{ width: `${row.level * 100}%` }} />{Math.round(row.level * 100)}%</span><span><i style={{ width: `${row.confidence * 100}%` }} />{Math.round(row.confidence * 100)}%</span><details><summary>{plural(row.evidence.length, '{count} linked claim', '{count} linked claims')}</summary>{row.evidence.map((item) => <p key={item.id}>{item.statement}</p>)}</details></div>)}
    </div>
  )
}

export function OpportunityLandscape({ data }: { data: Landscape }) {
  const { plural, t } = useI18n()
  const skillEntries = Object.entries(data.skills).slice(0, 14)
  if (!data.denominator) return <EmptyState title={t('Your opportunity landscape is empty')} description={t('Capture jobs from a URL, file, or manual entry to see patterns across your own search.')} />
  const seniorityNames = Object.keys(data.seniority)
  const industryNames = Object.keys(data.industries)
  return (
    <div className="visual-stack">
      <EChart className="echart landscape-chart" ariaLabel={t('Opportunity requirements and seniority chart')} option={{
        tooltip: { trigger: 'item' },
        grid: [{ left: 140, right: '55%', top: 30, bottom: 45 }, { left: '58%', right: 40, top: 30, bottom: 45 }],
        xAxis: [{ type: 'value', gridIndex: 0, axisLabel: { color: '#8d9ab0' }, splitLine: { lineStyle: { color: '#253048' } } }, { type: 'category', gridIndex: 1, data: seniorityNames, axisLabel: { color: '#8d9ab0', rotate: 28 } }],
        yAxis: [{ type: 'category', gridIndex: 0, data: skillEntries.map(([name]) => name).reverse(), axisLabel: { color: '#aeb9cc' } }, { type: 'value', gridIndex: 1, axisLabel: { color: '#8d9ab0' }, splitLine: { lineStyle: { color: '#253048' } } }],
        series: [
          { name: t('Requirements'), type: 'bar', xAxisIndex: 0, yAxisIndex: 0, data: skillEntries.map(([, count]) => count).reverse(), itemStyle: { color: '#3ddbd9', borderRadius: [0, 5, 5, 0] } },
          { name: t('Seniority'), type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: seniorityNames.map((name) => data.seniority[name]), itemStyle: { color: '#7c6cff', borderRadius: [5, 5, 0, 0] } },
        ],
      }} />
      <div className="insight-strip"><b>{plural(data.denominator, '{count} saved opportunity', '{count} saved opportunities')}</b><span>{plural(industryNames.length, '{count} industry', '{count} industries')}</span><span>{plural(skillEntries.length, '{count} recurring skill signal shown', '{count} recurring skill signals shown')}</span></div>
      <p className="chart-warning">{t(data.warning)}</p>
    </div>
  )
}

export function MatchWaterfall({ run }: { run: MatchRun }) {
  const { t } = useI18n()
  const categories = Object.entries(run.components.by_category ?? {})
  const values = categories.map(([, value]) => Math.round(value.score * 100))
  return (
    <div className="visual-stack">
      <EChart className="echart match-chart" ariaLabel={t('Evidence alignment by requirement category chart')} option={{
        tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value}%` },
        radar: { indicator: categories.map(([name]) => ({ name, max: 100 })), axisName: { color: '#b9c6d9' }, splitLine: { lineStyle: { color: '#2a3650' } }, splitArea: { areaStyle: { color: ['rgba(61,219,217,.02)', 'rgba(124,108,255,.04)'] } } },
        series: [{ type: 'radar', data: [{ value: values, name: t('Evidence alignment'), areaStyle: { color: 'rgba(61,219,217,.22)' }, lineStyle: { color: '#3ddbd9' }, itemStyle: { color: '#7c6cff' } }] }],
      }} />
      <div className="uncertainty-band" aria-label={t('Alignment interval {lower} to {upper} percent', { lower: Math.round(run.lower_bound * 100), upper: Math.round(run.upper_bound * 100) })}><span style={{ left: `${run.lower_bound * 100}%`, width: `${(run.upper_bound - run.lower_bound) * 100}%` }} /><i style={{ left: `${run.coverage * 100}%` }} /><small>{t('Known evidence coverage {coverage}% · plausible interval {lower}–{upper}%', { coverage: Math.round(run.coverage * 100), lower: Math.round(run.lower_bound * 100), upper: Math.round(run.upper_bound * 100) })}</small></div>
    </div>
  )
}
