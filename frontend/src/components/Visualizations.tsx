import { SigmaContainer, useLoadGraph } from '@react-sigma/core'
import Graph from 'graphology'
import { useEffect, useState } from 'react'
import type { Landscape, MatchRun, ProfileGraphData } from '../types'
import { EChart } from './EChart'
import { EmptyState } from './Primitives'

const palette: Record<string, string> = {
  profile: '#7c6cff', skill: '#3ddbd9', experience: '#ffb45e', education: '#ed77d4',
  evidence: '#6be39a', source: '#84a5ff', requirement: '#ff7d91', unknown: '#8090a8',
}

function ProfileGraphLoader({ data }: { data: ProfileGraphData['graph'] }) {
  const loadGraph = useLoadGraph()
  useEffect(() => {
    const graph = new Graph({ multi: true, type: 'undirected' })
    const total = Math.max(data.nodes.length, 1)
    data.nodes.forEach((node, index) => {
      const angle = (index / total) * Math.PI * 2
      const level = node.type === 'profile' ? 0 : 1 + (index % 4) * 0.16
      graph.addNode(node.id, {
        label: node.label,
        x: node.type === 'profile' ? 0 : Math.cos(angle) * level,
        y: node.type === 'profile' ? 0 : Math.sin(angle) * level,
        size: node.type === 'profile' ? 18 : 7 + Number(node['strength'] ?? 0) * 7,
        color: palette[node.type] ?? palette.unknown,
      })
    })
    data.edges.forEach((edge, index) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdgeWithKey(edge.id || `edge-${index}`, edge.source, edge.target, {
          color: '#536079', size: 1.1,
        })
      }
    })
    loadGraph(graph)
  }, [data, loadGraph])
  return null
}

export function ProfileConstellation({ data }: { data: ProfileGraphData['graph'] }) {
  const [table, setTable] = useState(false)
  if (!data.nodes.length) return <EmptyState title="Your constellation is waiting" description="Confirm evidence and add skills to connect your professional story." />
  return (
    <div className="visual-stack">
      <div className="visual-toolbar"><span>{data.nodes.length} nodes · {data.edges.length} evidence links</span><button className="text-button" onClick={() => setTable(!table)}>{table ? 'Show network' : 'Accessible table'}</button></div>
      {table ? (
        <div className="table-scroll"><table><thead><tr><th>Entity</th><th>Type</th><th>Connections</th></tr></thead><tbody>{data.nodes.map((node) => <tr key={node.id}><td>{node.label}</td><td><span className={`entity-dot type-${node.type}`} />{node.type}</td><td>{data.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length}</td></tr>)}</tbody></table></div>
      ) : (
        <div className="sigma-stage" aria-label="Interactive professional evidence network">
          <SigmaContainer settings={{ renderEdgeLabels: false, labelDensity: 0.08, labelGridCellSize: 90, allowInvalidContainer: true }}><ProfileGraphLoader data={data} /></SigmaContainer>
          <div className="graph-legend">{Object.entries(palette).slice(0, 5).map(([type, color]) => <span key={type}><i style={{ background: color }} />{type}</span>)}</div>
        </div>
      )}
    </div>
  )
}

export function CareerRiver({ rows }: { rows: ProfileGraphData['river'] }) {
  const lanes = ['experience', 'education']
  const data = rows.map((row, index) => ({
    value: [String(row['start'] || 'Unknown'), lanes.indexOf(row.kind), String(row['end'] || ''), row.title],
    name: row.title,
    itemStyle: { color: palette[row.kind] ?? palette.unknown },
    symbolSize: 13 + (index % 3) * 2,
  }))
  if (!rows.length) return <EmptyState title="No career timeline yet" description="Add experience and education to reveal the arc of your career." />
  return <EChart className="echart river-chart" option={{
    animationDuration: 600,
    tooltip: { trigger: 'item', formatter: (value: { data: { value: string[] } }) => `<b>${value.data.value[3]}</b><br/>${value.data.value[0]} – ${value.data.value[2] || 'present'}` },
    grid: { left: 100, right: 30, top: 30, bottom: 60 },
    xAxis: { type: 'time', axisLabel: { color: '#8d9ab0' }, splitLine: { lineStyle: { color: '#253048' } } },
    yAxis: { type: 'category', data: ['Experience', 'Education'], axisLabel: { color: '#aeb9cc' }, axisLine: { show: false } },
    series: [{ type: 'scatter', data, symbol: 'circle', emphasis: { scale: 1.4 } }],
  }} />
}

export function EvidenceMatrix({ rows }: { rows: ProfileGraphData['matrix'] }) {
  if (!rows.length) return <EmptyState title="No evidence matrix yet" description="Link confirmed evidence to skills to distinguish supported capability from unverified claims." />
  return (
    <div className="evidence-matrix" role="table" aria-label="Skill evidence matrix">
      <div className="matrix-head" role="row"><span>Skill</span><span>Level</span><span>Confidence</span><span>Evidence</span></div>
      {rows.map((row) => <div className="matrix-row" role="row" key={row.skill_id}><strong>{row.skill}</strong><span><i style={{ width: `${row.level * 100}%` }} />{Math.round(row.level * 100)}%</span><span><i style={{ width: `${row.confidence * 100}%` }} />{Math.round(row.confidence * 100)}%</span><details><summary>{row.evidence.length} linked claim{row.evidence.length === 1 ? '' : 's'}</summary>{row.evidence.map((item) => <p key={item.id}>{item.statement}</p>)}</details></div>)}
    </div>
  )
}

export function OpportunityLandscape({ data }: { data: Landscape }) {
  const skillEntries = Object.entries(data.skills).slice(0, 14)
  if (!data.denominator) return <EmptyState title="Your opportunity landscape is empty" description="Capture jobs from a URL, file, or manual entry to see patterns across your own search." />
  const seniorityNames = Object.keys(data.seniority)
  const industryNames = Object.keys(data.industries)
  return (
    <div className="visual-stack">
      <EChart className="echart landscape-chart" option={{
        tooltip: { trigger: 'item' },
        grid: [{ left: 140, right: '55%', top: 30, bottom: 45 }, { left: '58%', right: 40, top: 30, bottom: 45 }],
        xAxis: [{ type: 'value', gridIndex: 0, axisLabel: { color: '#8d9ab0' }, splitLine: { lineStyle: { color: '#253048' } } }, { type: 'category', gridIndex: 1, data: seniorityNames, axisLabel: { color: '#8d9ab0', rotate: 28 } }],
        yAxis: [{ type: 'category', gridIndex: 0, data: skillEntries.map(([name]) => name).reverse(), axisLabel: { color: '#aeb9cc' } }, { type: 'value', gridIndex: 1, axisLabel: { color: '#8d9ab0' }, splitLine: { lineStyle: { color: '#253048' } } }],
        series: [
          { name: 'Requirements', type: 'bar', xAxisIndex: 0, yAxisIndex: 0, data: skillEntries.map(([, count]) => count).reverse(), itemStyle: { color: '#3ddbd9', borderRadius: [0, 5, 5, 0] } },
          { name: 'Seniority', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: seniorityNames.map((name) => data.seniority[name]), itemStyle: { color: '#7c6cff', borderRadius: [5, 5, 0, 0] } },
        ],
      }} />
      <div className="insight-strip"><b>{data.denominator} saved opportunities</b><span>{industryNames.length} industries</span><span>{skillEntries.length} recurring skill signals shown</span></div>
      <p className="chart-warning">{data.warning}</p>
    </div>
  )
}

export function MatchWaterfall({ run }: { run: MatchRun }) {
  const categories = Object.entries(run.components.by_category ?? {})
  const values = categories.map(([, value]) => Math.round(value.score * 100))
  return (
    <div className="visual-stack">
      <EChart className="echart match-chart" option={{
        tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value}%` },
        radar: { indicator: categories.map(([name]) => ({ name, max: 100 })), axisName: { color: '#b9c6d9' }, splitLine: { lineStyle: { color: '#2a3650' } }, splitArea: { areaStyle: { color: ['rgba(61,219,217,.02)', 'rgba(124,108,255,.04)'] } } },
        series: [{ type: 'radar', data: [{ value: values, name: 'Evidence alignment', areaStyle: { color: 'rgba(61,219,217,.22)' }, lineStyle: { color: '#3ddbd9' }, itemStyle: { color: '#7c6cff' } }] }],
      }} />
      <div className="uncertainty-band" aria-label={`Alignment interval ${Math.round(run.lower_bound * 100)} to ${Math.round(run.upper_bound * 100)} percent`}><span style={{ left: `${run.lower_bound * 100}%`, width: `${(run.upper_bound - run.lower_bound) * 100}%` }} /><i style={{ left: `${run.coverage * 100}%` }} /><small>Known evidence coverage {Math.round(run.coverage * 100)}% · plausible interval {Math.round(run.lower_bound * 100)}–{Math.round(run.upper_bound * 100)}%</small></div>
    </div>
  )
}
