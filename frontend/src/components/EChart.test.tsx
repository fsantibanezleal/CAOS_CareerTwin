import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EChart } from './EChart'

const chart = vi.hoisted(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }))
const init = vi.hoisted(() => vi.fn(() => chart))

vi.mock('echarts/core', () => ({ init, use: vi.fn() }))
vi.mock('echarts/charts', () => ({ BarChart: {}, CustomChart: {}, RadarChart: {}, ScatterChart: {} }))
vi.mock('echarts/components', () => ({ AriaComponent: {}, DataZoomComponent: {}, GridComponent: {}, LegendComponent: {}, RadarComponent: {}, TooltipComponent: {} }))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))

class ResizeObserverStub {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('EChart presentation contract', () => {
  beforeEach(() => {
    chart.setOption.mockClear()
    chart.resize.mockClear()
    chart.dispose.mockClear()
    init.mockClear()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: (name: string) => name === '--cyan' ? '#3ddbd9' : '#abcdef' } as CSSStyleDeclaration)
  })

  it('enables semantic chart description, decals, theme tokens, and reduced motion', () => {
    const option = vi.fn((tokens) => ({ series: [{ color: tokens.cyan }] }))
    const { unmount } = render(<EChart ariaLabel="Opportunity signal chart" option={option} />)

    expect(screen.getByRole('img', { name: 'Opportunity signal chart' })).toBeInTheDocument()
    expect(option).toHaveBeenCalledWith(expect.objectContaining({ cyan: '#3ddbd9' }))
    expect(chart.setOption).toHaveBeenCalledWith(expect.objectContaining({
      animation: false,
      aria: { enabled: true, description: 'Opportunity signal chart', decal: { show: true } },
    }), { notMerge: true })

    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(chart.resize).toHaveBeenCalled()
    unmount()
    expect(chart.dispose).toHaveBeenCalled()
  })
})
