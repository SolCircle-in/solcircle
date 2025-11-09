import { useEffect, useState, RefObject } from "react"

interface Dimensions {
  width: number
  height: number
}

export function useDimensions(ref: RefObject<HTMLElement>, debounceMs: number = 100): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 })

  useEffect(() => {
    if (!ref.current) return

    const updateDimensions = () => {
      if (ref.current) {
        setDimensions({
          width: ref.current.offsetWidth,
          height: ref.current.offsetHeight,
        })
      }
    }

    // Initial measurement
    updateDimensions()

    // Create ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })

    resizeObserver.observe(ref.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [ref, debounceMs])

  return dimensions
}
