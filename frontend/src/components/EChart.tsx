import { BarChart, CustomChart, RadarChart, ScatterChart } from 'echarts/charts'
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, RadarComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

echarts.use([
  BarChart,
  CustomChart,
  ScatterChart,
  RadarChart,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  AriaComponent,
  CanvasRenderer,
])

export type ChartTokens = {
  background: string
  surface: string
  line: string
  text: string
  muted: string
  faint: string
  cyan: string
  violet: string
  amber: string
  green: string
  red: string
}

type ChartOption = EChartsCoreOption | ((tokens: ChartTokens) => EChartsCoreOption)

function chartTokens(): ChartTokens {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string) => styles.getPropertyValue(name).trim()
  return {
    background: read('--bg'),
    surface: read('--surface'),
    line: read('--line'),
    text: read('--text'),
    muted: read('--muted'),
    faint: read('--faint'),
    cyan: read('--cyan'),
    violet: read('--violet'),
    amber: read('--amber'),
    green: read('--green'),
    red: read('--red'),
  }
}

export function EChart({ option, ariaLabel, className = '' }: { option: ChartOption; ariaLabel: string; className?: string }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const chart = echarts.init(container.current, undefined, { renderer: 'canvas' })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      const resolved = typeof option === 'function' ? option(chartTokens()) : option
      chart.setOption({
        ...resolved,
        animation: !reducedMotion.matches,
        aria: {
          enabled: true,
          description: ariaLabel,
          decal: { show: true },
        },
      }, { notMerge: true })
    }
    update()
    const resize = () => chart.resize()
    const observer = new ResizeObserver(resize)
    const themeObserver = new MutationObserver(update)
    observer.observe(container.current)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('resize', resize)
    reducedMotion.addEventListener('change', update)
    return () => {
      observer.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('resize', resize)
      reducedMotion.removeEventListener('change', update)
      chart.dispose()
    }
  }, [ariaLabel, option])
  return <div ref={container} className={className} role="img" aria-label={ariaLabel} />
}
