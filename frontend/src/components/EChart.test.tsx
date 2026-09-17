import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EChart } from './EChart'

type ClickHandler = (params: { seriesName?: string; name?: string; dataIndex: number; value: unknown }) => void

const handlers = vi.hoisted(() => ({ click: [] as ClickHandler[] }))
const chart = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}))
const init = vi.hoisted(() => vi.fn(() => chart))

vi.mock('echarts/core', () => ({ init, use: vi.fn() }))
vi.mock('echarts/charts', () => ({ BarChart: {}, CustomChart: {}, LineChart: {}, RadarChart: {}, ScatterChart: {} }))
vi.mock('echarts/components', () => ({
  AriaComponent: {},
  DataZoomComponent: {},
  GridComponent: {},
  LegendComponent: {},
  MarkLineComponent: {},
  RadarComponent: {},
  TooltipComponent: {},
}))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))

class ResizeObserverStub {
  observe = vi.fn()
  disconnect = vi.fn()
}

class MutationObserverStub {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('EChart presentation contract', () => {
  beforeEach(() => {
    handlers.click = []
    for (const spy of [chart.setOption, chart.resize, chart.dispose, chart.on, chart.off, init]) spy.mockClear()
    chart.on.mockImplementation((event: string, handler: ClickHandler) => {
      if (event === 'click') handlers.click.push(handler)
    })
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('MutationObserver', MutationObserverStub)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) => (name === '--cyan' ? '#3ddbd9' : '#abcdef'),
    } as CSSStyleDeclaration)
  })

  it('enables semantic chart description, decals, theme tokens, and reduced motion', () => {
    const option = vi.fn((tokens) => ({ series: [{ color: tokens.cyan }] }))
    const { unmount } = render(<EChart ariaLabel="Opportunity signal chart" option={option} />)

    expect(option).toHaveBeenCalledWith(expect.objectContaining({ cyan: '#3ddbd9' }))
    expect(chart.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        animation: false,
        aria: { enabled: true, description: 'Opportunity signal chart', decal: { show: true } },
      }),
      // Merged rather than replaced, so a zoom position or legend selection the user set
      // survives a data refresh instead of being discarded on every render.
      { notMerge: false, lazyUpdate: true },
    )

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(chart.resize).toHaveBeenCalled()
    unmount()
    expect(chart.dispose).toHaveBeenCalled()
  })

  it('presents a chart without handlers as a figure, not an image', () => {
    // role="img" tells assistive technology the content is a static picture. A chart is
    // a figure; one that answers input is an application.
    render(<EChart ariaLabel="Static distribution" option={{}} />)
    expect(screen.getByRole('figure', { name: 'Static distribution' })).toBeInTheDocument()
  })

  it('exposes a selectable chart as a focusable application and emits its selection', () => {
    const onSelect = vi.fn()
    render(<EChart ariaLabel="Coverage by requirement" option={{}} onSelect={onSelect} />)

    const surface = screen.getByRole('application', { name: 'Coverage by requirement' })
    expect(surface).toHaveAttribute('tabindex', '0')

    expect(handlers.click).toHaveLength(1)
    act(() => {
      handlers.click[0]?.({ seriesName: 'Coverage', name: 'Data Governance', dataIndex: 3, value: 0.82 })
    })
    expect(onSelect).toHaveBeenCalledWith({
      seriesName: 'Coverage',
      name: 'Data Governance',
      dataIndex: 3,
      value: 0.82,
    })
  })

  it('configures zoom only when the caller asks for it', () => {
    render(<EChart ariaLabel="Zoomable series" option={{}} zoomable />)
    expect(chart.setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dataZoom: expect.arrayContaining([expect.objectContaining({ type: 'inside' })]),
      }),
      expect.anything(),
    )
  })
})
