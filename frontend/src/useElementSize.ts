import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The rendered size of an element, kept current as its container resizes. Charts drawn in
 * pixels use it rather than a scaled viewBox, so their text stays at its set size.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      const next = { width: Math.round(box.width), height: Math.round(box.height) }
      setSize((previous) => (previous.width === next.width && previous.height === next.height ? previous : next))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}
