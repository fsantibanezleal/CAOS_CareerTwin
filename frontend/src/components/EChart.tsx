import { BarChart, CustomChart, LineChart, RadarChart, ScatterChart } from 'echarts/charts'
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useRef } from 'react'

echarts.use([
  BarChart,
  CustomChart,
  LineChart,
  ScatterChart,
  RadarChart,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
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

/** Narrow selection payload, so call sites never depend on ECharts' own types. */
export type ChartSelection = {
  seriesName?: string
  name?: string
  dataIndex: number
  value: unknown
}

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

/**
 * Interactive chart surface.
 *
 * The previous wrapper accepted only an `option` and rendered its container as
 * `role="img"`, declaring every figure a static picture. It exposed no event
 * handlers, so a click on a bar could never reach the application, and it called
 * `setOption(..., { notMerge: true })` on each update, discarding any zoom or legend
 * state the user had set. `DataZoomComponent` and `LegendComponent` were registered
 * into the bundle and never configured, so the bytes were paid for and the behaviour
 * left switched off.
 *
 * This version emits clicks, preserves state across updates, enables zoom on request,
 * and exposes the canvas as a figure or application rather than an image.
 */
export function EChart({
  option,
  ariaLabel,
  className = '',
  onSelect,
  zoomable = false,
  description,
}: {
  option: ChartOption
  ariaLabel: string
  className?: string
  /** Fired when a data item is clicked; its presence makes the chart focusable. */
  onSelect?: (selection: ChartSelection) => void
  /** Enables wheel/drag zoom plus a slider on the primary axis. */
  zoomable?: boolean
  /** Longer description for assistive technology. */
  description?: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const selectRef = useRef(onSelect)
  // Kept current in an effect, not during render: the click listener is registered once
  // on mount and has to reach whatever handler the latest render supplied.
  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])

  const build = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const resolved = typeof option === 'function' ? option(chartTokens()) : option
    const tokens = chartTokens()

    chart.setOption(
      {
        ...resolved,
        animation: !reduced,
        animationDuration: reduced ? 0 : 260,
        ...(zoomable
          ? {
              dataZoom: [
                { type: 'inside', throttle: 50 },
                {
                  type: 'slider',
                  height: 18,
                  bottom: 4,
                  borderColor: tokens.line,
                  fillerColor: `${tokens.cyan}22`,
                  handleStyle: { color: tokens.cyan },
                  textStyle: { color: tokens.faint },
                },
              ],
            }
          : {}),
        aria: { enabled: true, description: description ?? ariaLabel, decal: { show: true } },
      },
      // Merge instead of replace, so zoom position and legend selection survive a
      // data refresh or theme change rather than being discarded every render.
      { notMerge: false, lazyUpdate: true },
    )
  }, [option, ariaLabel, zoomable, description])

  useEffect(() => {
    if (!container.current) return
    const chart = echarts.init(container.current, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    build()

    const handleClick = (params: {
      seriesName?: string
      name?: string
      dataIndex: number
      value: unknown
    }) => {
      selectRef.current?.({
        seriesName: params.seriesName,
        name: params.name,
        dataIndex: params.dataIndex,
        value: params.value,
      })
    }
    chart.on('click', handleClick)

    const resize = () => chart.resize()
    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(container.current)
    const themeObserver = new MutationObserver(build)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener('change', build)
    window.addEventListener('resize', resize)

    return () => {
      chart.off('click', handleClick)
      sizeObserver.disconnect()
      themeObserver.disconnect()
      motion.removeEventListener('change', build)
      window.removeEventListener('resize', resize)
      chart.dispose()
      chartRef.current = null
    }
    // Mount once; `build` handles every later option change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    build()
  }, [build])

  const interactive = Boolean(onSelect)

  return (
    <div
      ref={container}
      className={className}
      // A chart that answers input is a figure, not a picture. role="img" tells
      // assistive technology the content is static and unreachable.
      role={interactive ? 'application' : 'figure'}
      aria-label={ariaLabel}
      tabIndex={interactive ? 0 : undefined}
    />
  )
}
