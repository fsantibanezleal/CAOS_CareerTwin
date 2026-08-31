import { SigmaContainer, useLoadGraph, useRegisterEvents, useSetSettings, useSigma } from '@react-sigma/core'
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from 'echarts'
import { graphic } from 'echarts/core'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { Focus, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { NodeHoverDrawingFunction, NodeLabelDrawingFunction } from 'sigma/rendering'
import { useI18n } from '../i18n'
import type { Landscape, MatchRun, OpportunityGraphData, ProfileGraphData } from '../types'
import { EChart, type ChartTokens } from './EChart'
import { EmptyState } from './Primitives'

const palette: Record<string, string> = {
  profile: '#7c6cff', skill: '#3ddbd9', experience: '#ffb45e', education: '#ed77d4',
  accomplishment: '#f5d76e', evidence: '#6be39a', source: '#84a5ff', requirement: '#ff7d91',
  opportunity: '#7c6cff', employer: '#84a5ff', industry: '#ed77d4', seniority: '#ffb45e',
  location: '#6be39a', work_mode: '#3ddbd9', target_set: '#f5d76e', unknown: '#8090a8',
}

type GraphThemeTokens = {
  label: string
  surface: string
  line: string
  edge: string
  focusedEdge: string
  dimmedNode: string
}

// Canvas renderers cannot consume CSS custom properties directly. Keep these values aligned with
// the workbench tokens in styles.css, and observe the root theme so an open graph changes live.
const graphThemes: Record<'dark' | 'light', GraphThemeTokens> = {
  dark: { label: '#edf3fc', surface: '#0e1421', line: '#243149', edge: '#697991', focusedEdge: '#a9bce0', dimmedNode: '#293246' },
  light: { label: '#152036', surface: '#ffffff', line: '#d7e0ec', edge: '#738198', focusedEdge: '#46566f', dimmedNode: '#c7d1df' },
}

function currentGraphTheme(): GraphThemeTokens {
  return graphThemes[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark']
}

function useGraphTheme(): GraphThemeTokens {
  const [tokens, setTokens] = useState(currentGraphTheme)
  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(currentGraphTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return tokens
}

function graphNodeLabel(tokens: GraphThemeTokens): NodeLabelDrawingFunction {
  return (context, data, settings) => {
    if (typeof data.label !== 'string' || !data.label) return
    const limit = 34
    const label = data.label.length > limit ? `${data.label.slice(0, limit - 1).trimEnd()}â€¦` : data.label
    context.fillStyle = tokens.label
    context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`
    context.fillText(label, data.x + data.size + 3, data.y + settings.labelSize / 3)
  }
}

function graphNodeHover(tokens: GraphThemeTokens): NodeHoverDrawingFunction {
  return (context, data, settings) => {
    if (typeof data.label !== 'string' || !data.label) return
    context.save()
    context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`
    const left = data.x + data.size
    const top = data.y - settings.labelSize / 2 - 4
    const width = context.measureText(data.label).width + 10
    const height = settings.labelSize + 8
    context.beginPath()
    context.roundRect(left, top, width, height, 6)
    context.fillStyle = tokens.surface
    context.fill()
    context.strokeStyle = tokens.line
    context.lineWidth = 1
    context.stroke()
    context.fillStyle = tokens.label
    context.fillText(data.label, data.x + data.size + 3, data.y + settings.labelSize / 3)
    context.restore()
  }
}

type GraphNode = ProfileGraphData['graph']['nodes'][number]
type GraphEdge = ProfileGraphData['graph']['edges'][number]

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}

function stablePosition(id: string) {
  let hash = 2166136261
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  const normalized = hash >>> 0
  const angle = (normalized % 3600) / 3600 * Math.PI * 2
  const radius = 0.65 + ((normalized >>> 8) % 1000) / 1000
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

function RelationshipGraphLoader({ data, edgeColor }: { data: ProfileGraphData['graph']; edgeColor: string }) {
  const loadGraph = useLoadGraph()
  useEffect(() => {
    const graph = new Graph({ multi: true, type: 'undirected' })
    data.nodes.forEach((node) => {
      const position = node.type === 'profile' ? { x: 0, y: 0 } : stablePosition(node.id)
      graph.addNode(node.id, {
        label: node.label,
        nodeType: node.type,
        record: node,
        x: position.x,
        y: position.y,
        fixed: node.type === 'profile',
        size: node.type === 'profile' ? 18 : node.type === 'opportunity' || node.type === 'target_set' ? 11 : 7 + Number(node['strength'] ?? 0) * 7,
        color: palette[node.type] ?? palette.unknown,
      })
    })
    data.edges.forEach((edge, index) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdgeWithKey(edge.id || `edge-${index}`, edge.source, edge.target, {
          color: edgeColor, size: Math.max(0.8, Number(edge['weight'] ?? 1) * 1.5), relation: String(edge['type'] ?? 'related'), record: edge,
        })
      }
    })
    if (graph.order > 2 && graph.size > 0 && graph.order <= 350) {
      const inferred = forceAtlas2.inferSettings(graph)
      forceAtlas2.assign(graph, {
        iterations: Math.min(180, 50 + graph.order),
        settings: {
          ...inferred,
          barnesHutOptimize: graph.order > 80,
          gravity: 1.35,
          scalingRatio: Math.max(3, Math.sqrt(graph.order) * 1.4),
          slowDown: 4,
          strongGravityMode: true,
        },
      })
    }
    graph.forEachNode((id, attributes) => {
      const degree = graph.degree(id)
      graph.setNodeAttribute(id, 'degree', degree)
      graph.setNodeAttribute(id, 'size', attributes.nodeType === 'profile' ? 19 : attributes.nodeType === 'opportunity' || attributes.nodeType === 'target_set' ? 10 + Math.sqrt(Math.max(1, degree)) * 3 : 6 + Math.sqrt(Math.max(1, degree)) * 3 + Number(attributes.record?.strength ?? 0) * 4)
    })
    loadGraph(graph)
  }, [data, edgeColor, loadGraph])
  return null
}

function RelationshipGraphController({ query, type, selected, focusSelection, resetSignal, theme, onSelect }: { query: string; type: string; selected?: string; focusSelection: boolean; resetSignal: number; theme: GraphThemeTokens; onSelect: (id?: string) => void }) {
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
    const contextNode = hovered ?? (focusSelection ? selected : undefined)
    const neighbors = contextNode ? new Set([contextNode, ...graph.neighbors(contextNode)]) : undefined
    const normalized = query.trim().toLocaleLowerCase()
    setSettings({
      nodeReducer: (node, attributes) => {
        const result = { ...attributes }
        const matchesType = !type || attributes.nodeType === type
        const matchesQuery = !normalized || String(attributes.label ?? '').toLocaleLowerCase().includes(normalized)
        if (!matchesType || !matchesQuery || (neighbors && !neighbors.has(node))) {
          result.color = theme.dimmedNode
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
        if (contextNode && !graph.extremities(edge).includes(contextNode)) {
          result.hidden = true
        } else if (contextNode) {
          result.color = theme.focusedEdge
          result.size = Number(attributes.size ?? 1) * 1.8
        }
        return result
      },
    })
    sigma.refresh()
  }, [focusSelection, hovered, query, selected, setSettings, sigma, theme, type])
  useEffect(() => {
    void sigma.getCamera().animatedReset({ duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 })
  }, [resetSignal, sigma])
  return null
}

function GraphMatrix({ nodes, edges, onSelect }: { nodes: GraphNode[]; edges: GraphEdge[]; onSelect: (id: string) => void }) {
  const { t } = useI18n()
  const ranked = useMemo(() => [...nodes].sort((left, right) => {
    const degree = (id: string) => edges.filter((edge) => edge.source === id || edge.target === id).length
    return degree(right.id) - degree(left.id) || left.label.localeCompare(right.label)
  }).slice(0, 28), [edges, nodes])
  const edgeMap = useMemo(() => new Map(edges.flatMap((edge) => [[`${edge.source}|${edge.target}`, edge], [`${edge.target}|${edge.source}`, edge]])), [edges])
  return <div className="graph-matrix-shell" role="region" aria-label={t('Degree-ranked adjacency matrix')}><p>{t('Showing the {count} most connected visible entities. Select a row or cell to inspect it.', { count: ranked.length })}</p><div className="graph-matrix" style={{ gridTemplateColumns: `minmax(170px, 1fr) repeat(${ranked.length}, 26px)` }}><span />{ranked.map((node) => <button key={`head-${node.id}`} className="matrix-node-head" title={node.label} aria-label={t('Inspect {label}', { label: node.label })} onClick={() => onSelect(node.id)}><i style={{ background: palette[node.type] ?? palette.unknown }} /></button>)}{ranked.map((row) => <div className="matrix-line" key={row.id} style={{ gridColumn: `1 / span ${ranked.length + 1}`, gridTemplateColumns: `minmax(170px, 1fr) repeat(${ranked.length}, 26px)` }}><button className="matrix-label" onClick={() => onSelect(row.id)}>{row.label}</button>{ranked.map((column) => { const edge = edgeMap.get(`${row.id}|${column.id}`); const label = edge ? `${row.label} — ${String(edge['type'] ?? 'related')} — ${column.label}` : `${row.label} / ${column.label}`; return <button key={column.id} className={`matrix-cell ${edge ? 'linked' : ''}`} style={edge ? { background: palette[row.type] ?? palette.unknown, opacity: 0.35 + Number(edge['weight'] ?? 0.5) * 0.5 } : undefined} title={label} aria-label={label} onClick={() => onSelect(edge ? row.id : column.id)} /> })}</div>)}</div></div>
}

function GraphInspector({ data, selectedId, variant, onSelect, onClose }: { data: ProfileGraphData['graph']; selectedId?: string; variant: 'profile' | 'opportunity'; onSelect: (id: string) => void; onClose: () => void }) {
  const { t } = useI18n()
  const selected = data.nodes.find((node) => node.id === selectedId)
  const selectedEdges = selected ? data.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id) : []
  const other = (edge: GraphEdge) => data.nodes.find((node) => node.id === (edge.source === selectedId ? edge.target : edge.source))
  return <aside className={`graph-inspector ${selected ? 'open' : ''}`} aria-live="polite">{selected ? <><header><div><span><i style={{ background: palette[selected.type] ?? palette.unknown }} />{t(selected.type)}</span><h3>{selected.label}</h3></div><button className="icon-button" onClick={onClose} aria-label={t('Close graph inspector')}><X /></button></header><div className="inspector-metrics">{selected['strength'] !== undefined && <span><b>{Math.round(Number(selected['strength']) * 100)}%</b>{t('Strength')}</span>}{selected['confidence'] !== undefined && <span><b>{Math.round(Number(selected['confidence']) * 100)}%</b>{t('Confidence')}</span>}<span><b>{selectedEdges.length}</b>{t('Connections')}</span></div><dl>{Object.entries(selected).filter(([key, value]) => !['id', 'label', 'type', 'strength', 'confidence'].includes(key) && value !== undefined && value !== null && value !== '').map(([key, value]) => <div key={key}><dt>{t(key.replaceAll('_', ' '))}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl><section><h4>{t('Typed relationships')}</h4>{selectedEdges.length ? selectedEdges.map((edge) => { const neighbor = other(edge); return <button key={edge.id} onClick={() => neighbor && onSelect(neighbor.id)}><span>{t(String(edge['type'] ?? 'related'))}</span><b>{neighbor?.label}</b></button> }) : <p>{t('No typed relationships for this entity.')}</p>}</section></> : <div className="inspector-empty"><h3>{t(variant === 'profile' ? 'Inspect an evidence path' : 'Inspect a search relationship')}</h3><p>{t(variant === 'profile' ? 'Select a node to see its exact metadata and typed relationships. Hover to isolate its neighborhood.' : 'Select a node to inspect how roles, requirements, employers, and search scenarios connect.')}</p></div>}</aside>
}

function RelationshipAtlas({ data, variant }: { data: ProfileGraphData['graph']; variant: 'profile' | 'opportunity' }) {
  const { t } = useI18n()
  const graphTheme = useGraphTheme()
  const [lens, setLens] = useState<'network' | 'matrix' | 'table'>('network')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [focusSelection, setFocusSelection] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const types = useMemo(() => [...new Set(data.nodes.map((node) => node.type))].sort(), [data.nodes])
  const visibleNodes = useMemo(() => data.nodes.filter((node) => (!type || node.type === type) && (!query.trim() || node.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))), [data.nodes, query, type])
  const sigmaSettings = useMemo(() => ({ renderEdgeLabels: false, labelDensity: 0.08, labelGridCellSize: 120, labelRenderedSizeThreshold: 8, labelSize: 12, labelWeight: '600', labelColor: { color: graphTheme.label }, defaultEdgeColor: graphTheme.edge, defaultDrawNodeLabel: graphNodeLabel(graphTheme), defaultDrawNodeHover: graphNodeHover(graphTheme), allowInvalidContainer: true, enableEdgeEvents: true, zIndex: true }), [graphTheme])
  const activeSelectedId = selectedId && data.nodes.some((node) => node.id === selectedId) ? selectedId : undefined
  const inspector = <GraphInspector data={data} selectedId={activeSelectedId} variant={variant} onSelect={setSelectedId} onClose={() => { setSelectedId(undefined); setFocusSelection(false) }} />
  if (!data.nodes.length) return <EmptyState title={t(variant === 'profile' ? 'Your constellation is waiting' : 'Your opportunity network is waiting')} description={t(variant === 'profile' ? 'Confirm evidence and add skills to connect your professional story.' : 'Capture opportunities and review their requirements to reveal your search network.')} />
  return (
    <div className="visual-stack">
      <div className="visual-toolbar graph-tools"><label className="graph-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('Search graph entities')} placeholder={t(variant === 'profile' ? 'Find an entity or evidence claim…' : 'Find a role, employer, or requirement…')} /></label><select value={type} onChange={(event) => setType(event.target.value)} aria-label={t('Filter graph by entity type')}><option value="">{t('All entity types')}</option>{types.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select><div className="segmented"><button className={lens === 'network' ? 'active' : ''} aria-pressed={lens === 'network'} onClick={() => setLens('network')}>{t('Network')}</button><button className={lens === 'matrix' ? 'active' : ''} aria-pressed={lens === 'matrix'} onClick={() => setLens('matrix')}>{t('Matrix')}</button><button className={lens === 'table' ? 'active' : ''} aria-pressed={lens === 'table'} onClick={() => setLens('table')}>{t('Table')}</button></div><span aria-live="polite">{t('{visible} of {nodes} nodes · {edges} typed links', { visible: visibleNodes.length, nodes: data.nodes.length, edges: data.edges.length })}</span></div>
      {lens === 'table' ? (
        <div className="graph-alt-layout"><div className="table-scroll"><table><thead><tr><th>{t('Entity')}</th><th>{t('Type')}</th><th>{t('Connections')}</th></tr></thead><tbody>{visibleNodes.map((node) => <tr key={node.id}><td><button className="graph-table-entity" onClick={() => setSelectedId(node.id)}>{node.label}</button></td><td><span className={`entity-dot type-${node.type}`} />{t(node.type)}</td><td>{data.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length}</td></tr>)}</tbody></table>{!visibleNodes.length && <EmptyState title={t('No entities match these filters')} description={t('Clear the search or entity-type filter to restore the graph universe.')} />}</div>{inspector}</div>
      ) : lens === 'matrix' ? <div className="graph-alt-layout"><GraphMatrix nodes={visibleNodes} edges={data.edges} onSelect={setSelectedId} />{inspector}</div> : (
        <div className="graph-workbench">
        <div className="sigma-stage" role="img" aria-label={t(variant === 'profile' ? 'Interactive professional evidence network' : 'Interactive opportunity knowledge network')}>
          <SigmaContainer settings={sigmaSettings}><RelationshipGraphLoader data={data} edgeColor={graphTheme.edge} /><RelationshipGraphController query={query} type={type} selected={activeSelectedId} focusSelection={focusSelection} resetSignal={resetSignal} theme={graphTheme} onSelect={setSelectedId} /></SigmaContainer>
          <div className="graph-camera-controls"><button className="icon-button" onClick={() => setResetSignal((value) => value + 1)} aria-label={t('Fit graph to view')} title={t('Fit graph to view')}><RotateCcw /></button><button className={`icon-button ${focusSelection ? 'active' : ''}`} disabled={!activeSelectedId} aria-pressed={focusSelection} onClick={() => setFocusSelection((value) => !value)} aria-label={t('Focus selected neighborhood')} title={t('Focus selected neighborhood')}><Focus /></button></div>
          <div className="graph-legend">{types.map((item) => <button key={item} className={type === item ? 'active' : ''} aria-pressed={type === item} onClick={() => setType(type === item ? '' : item)}><i style={{ background: palette[item] ?? palette.unknown }} />{t(item)}</button>)}</div>
        </div>
        {inspector}
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
  const { formatDate, t } = useI18n()
  const lanes = ['experience', 'education']
  const [now] = useState(() => Date.now())
  const parseTime = (value: unknown) => {
    const parsed = new Date(String(value ?? '')).getTime()
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const dated = rows.flatMap((row) => {
    const start = parseTime(row['start'])
    if (start === undefined) return []
    const end = parseTime(row['end']) ?? now
    return [{
      name: row.title,
      value: [lanes.indexOf(row.kind), start, Math.max(start + 86400000, end), row.title, row.kind, String(row['organization'] ?? '')],
      itemStyle: { color: palette[row.kind] ?? palette.unknown },
    }]
  })
  const renderRange = (params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
    const lane = Number(api.value(0))
    const [startX = 0, startY = 0] = api.coord([Number(api.value(1)), lane])
    const [endX = 0] = api.coord([Number(api.value(2)), lane])
    const laneSize = api.size?.([0, 1])
    const laneHeight = Array.isArray(laneSize) ? laneSize[1] ?? 28 : laneSize ?? 28
    const height = Math.max(16, Math.min(32, Math.abs(laneHeight) * 0.42))
    const coord = params.coordSys as unknown as { x: number; y: number; width: number; height: number }
    const shape = graphic.clipRectByRect({
      x: startX,
      y: startY - height / 2,
      width: Math.max(6, endX - startX),
      height,
    }, { x: coord.x, y: coord.y, width: coord.width, height: coord.height })
    return shape ? { type: 'rect', shape: { ...shape, r: 8 }, style: api.style() } : undefined
  }
  if (!rows.length) return <EmptyState title={t('No career timeline yet')} description={t('Add experience and education to reveal the arc of your career.')} />
  return <div className="visual-stack"><EChart className="echart river-chart" ariaLabel={t('Career duration timeline chart')} option={(tokens) => ({
    tooltip: { trigger: 'item', backgroundColor: tokens.surface, borderColor: tokens.line, textStyle: { color: tokens.text }, formatter: (value: { data: { value: Array<string | number> } }) => `<b>${escapeHtml(value.data.value[3])}</b><br/>${formatDate(new Date(Number(value.data.value[1])))} – ${Number(value.data.value[2]) >= now - 86400000 ? t('present') : formatDate(new Date(Number(value.data.value[2])))}` },
    grid: { left: 108, right: 28, top: 24, bottom: 68 },
    dataZoom: [{ type: 'inside', filterMode: 'none' }, { type: 'slider', bottom: 14, height: 22, borderColor: tokens.line, textStyle: { color: tokens.muted } }],
    xAxis: { type: 'time', axisLabel: { color: tokens.muted }, axisLine: { lineStyle: { color: tokens.line } }, splitLine: { lineStyle: { color: tokens.line } } },
    yAxis: { type: 'category', data: [t('Experience'), t('Education')], axisLabel: { color: tokens.text }, axisLine: { show: false } },
    series: [{ type: 'custom', renderItem: renderRange, data: dated, encode: { x: [1, 2], y: 0 }, emphasis: { focus: 'series' } }],
  })} /><details className="chart-data"><summary>{t('Read career timeline as a table')}</summary><div className="table-scroll"><table><thead><tr><th>{t('Type')}</th><th>{t('Role or credential')}</th><th>{t('Organization')}</th><th>{t('Start')}</th><th>{t('End')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{t(row.kind)}</td><td>{row.title}</td><td>{String(row['organization'] ?? t('Not recorded'))}</td><td>{String(row['start'] ?? t('Unknown'))}</td><td>{String(row['end'] ?? t('present'))}</td></tr>)}</tbody></table></div></details></div>
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
  const [lens, setLens] = useState<'skills' | 'seniority' | 'industries'>('skills')
  const ranked = (values: Record<string, number>) => Object.entries(values).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  const skillEntries = ranked(data.skills).slice(0, 18)
  const seniorityEntries = ranked(data.seniority)
  const industryEntries = ranked(data.industries)
  if (!data.denominator) return <EmptyState title={t('Your opportunity landscape is empty')} description={t('Capture jobs from a URL, file, or manual entry to see patterns across your own search.')} />
  const activeEntries = lens === 'skills' ? skillEntries : lens === 'seniority' ? seniorityEntries : industryEntries
  const option = (tokens: ChartTokens) => ({
    tooltip: { trigger: 'axis', backgroundColor: tokens.surface, borderColor: tokens.line, textStyle: { color: tokens.text }, valueFormatter: (value: number) => `${value} · ${Math.round(value / data.denominator * 100)}%` },
    grid: { left: 150, right: 30, top: 20, bottom: 42, containLabel: true },
    xAxis: { type: 'value', minInterval: 1, axisLabel: { color: tokens.muted }, axisLine: { lineStyle: { color: tokens.line } }, splitLine: { lineStyle: { color: tokens.line } } },
    yAxis: { type: 'category', data: activeEntries.map(([name]) => name).reverse(), axisLabel: { color: tokens.text, width: 135, overflow: 'truncate' } },
    series: [{ name: t(lens === 'skills' ? 'Recurring requirements' : lens === 'seniority' ? 'Seniority signals' : 'Industry signals'), type: 'bar', data: activeEntries.map(([, count]) => count).reverse(), itemStyle: { color: lens === 'skills' ? tokens.cyan : lens === 'seniority' ? tokens.violet : tokens.amber, borderRadius: [0, 7, 7, 0] }, label: { show: true, position: 'right', color: tokens.text } }],
  })
  return (
    <div className="visual-stack">
      <div className="visual-toolbar"><div className="segmented chart-lens-switcher" aria-label={t('Opportunity landscape lens')}>{(['skills', 'seniority', 'industries'] as const).map((value) => <button key={value} className={lens === value ? 'active' : ''} aria-pressed={lens === value} onClick={() => setLens(value)}>{t(value === 'skills' ? 'Skills' : value === 'seniority' ? 'Seniority' : 'Industries')}</button>)}</div><span>{t('Counts and share of {count} saved roles', { count: data.denominator })}</span></div>
      <EChart className="echart landscape-chart" ariaLabel={t('{lens} across saved opportunity research', { lens: t(lens) })} option={option} />
      <div className="insight-strip"><b>{plural(data.denominator, '{count} saved opportunity', '{count} saved opportunities')}</b><span>{plural(industryEntries.length, '{count} industry', '{count} industries')}</span><span>{plural(skillEntries.length, '{count} recurring skill signal shown', '{count} recurring skill signals shown')}</span></div>
      <details className="chart-data"><summary>{t('Read this landscape as a table')}</summary><div className="table-scroll"><table><thead><tr><th>{t(lens === 'skills' ? 'Skill' : lens === 'seniority' ? 'Seniority' : 'Industry')}</th><th>{t('Saved roles')}</th><th>{t('Share of saved set')}</th></tr></thead><tbody>{activeEntries.map(([name, count]) => <tr key={name}><td>{name}</td><td>{count}</td><td>{Math.round(count / data.denominator * 100)}%</td></tr>)}</tbody></table></div></details>
      <p className="chart-warning">{t(data.warning)}</p>
    </div>
  )
}

export function MatchWaterfall({ run }: { run: MatchRun }) {
  const { t } = useI18n()
  const categories = Object.entries(run.components.by_category ?? {})
  const values = categories.map(([, value]) => Math.round(value.score * 100))
  const rankedGaps = [...categories].sort((left, right) => left[1].score - right[1].score || left[0].localeCompare(right[0]))
  return (
    <div className="visual-stack">
      {categories.length ? <EChart className="echart match-chart" ariaLabel={t('Evidence alignment by requirement category chart')} option={(tokens) => ({
        tooltip: { trigger: 'axis', backgroundColor: tokens.surface, borderColor: tokens.line, textStyle: { color: tokens.text }, valueFormatter: (value: number) => `${value}%` },
        radar: { indicator: categories.map(([name]) => ({ name, max: 100 })), axisName: { color: tokens.text }, axisLine: { lineStyle: { color: tokens.line } }, splitLine: { lineStyle: { color: tokens.line } }, splitArea: { areaStyle: { color: [`${tokens.cyan}08`, `${tokens.violet}10`] } } },
        series: [{ type: 'radar', data: [{ value: values, name: t('Evidence alignment'), areaStyle: { color: `${tokens.cyan}38` }, lineStyle: { color: tokens.cyan, width: 2 }, itemStyle: { color: tokens.violet } }] }],
      })} /> : <EmptyState title={t('No category shape yet')} description={t('Run a match with reviewed requirements to compare alignment by category.')} />}
      {!!rankedGaps.length && <div className="category-breakdown" aria-label={t('Requirement category breakdown')}>{rankedGaps.map(([name, value], index) => <article key={name}><span>{index === 0 ? t('Priority gap') : t('Category')}</span><b>{name}</b><strong>{Math.round(value.score * 100)}%</strong><small>{t('{coverage}% coverage · {requirements} requirements', { coverage: Math.round(value.coverage * 100), requirements: value.requirements })}</small><i style={{ width: `${value.score * 100}%` }} /></article>)}</div>}
      <div className="uncertainty-band" aria-label={t('Alignment interval {lower} to {upper} percent', { lower: Math.round(run.lower_bound * 100), upper: Math.round(run.upper_bound * 100) })}><span style={{ left: `${run.lower_bound * 100}%`, width: `${(run.upper_bound - run.lower_bound) * 100}%` }} /><i style={{ left: `${run.coverage * 100}%` }} /><small>{t('Known evidence coverage {coverage}% · plausible interval {lower}–{upper}%', { coverage: Math.round(run.coverage * 100), lower: Math.round(run.lower_bound * 100), upper: Math.round(run.upper_bound * 100) })}</small></div>
    </div>
  )
}
