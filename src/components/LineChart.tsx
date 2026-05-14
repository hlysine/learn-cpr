import { useEffect, useRef } from 'react'

interface LineChartProps {
  data: number[]
  width?: number
  height?: number
  min?: number
  max?: number
  lineColor?: string
  backgroundColor?: string
  padding?: number
}

export default function LineChart({
  data,
  width = 800,
  height = 300,
  min = -50,
  max = 50,
  lineColor = '#ffffff',
  backgroundColor = '#0f172a',
  padding = 16,
}: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<number[]>(data)
  const rafRef = useRef<number | null>(null)
  const dirtyRef = useRef(true)

  // Update data ref without triggering re-render
  dataRef.current = data
  dirtyRef.current = true

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Handle devicePixelRatio for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      // Skip draw if data hasn't changed
      if (!dirtyRef.current) return
      dirtyRef.current = false

      const pts = dataRef.current
      const innerW = width - padding * 2
      const innerH = height - padding * 2

      // Clear
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, width, height)

      if (pts.length < 2) return

      const range = max - min || 1
      const xStep = innerW / (pts.length - 1)

      // Draw line
      ctx.beginPath()
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'

      const x0 = padding
      const y0 = padding + innerH - ((pts[0] - min) / range) * innerH
      ctx.moveTo(x0, y0)

      for (let i = 1; i < pts.length; i++) {
        const x = padding + i * xStep
        const y = padding + innerH - ((pts[i] - min) / range) * innerH
        ctx.lineTo(x, y)
      }

      ctx.stroke()

      // Optional: draw min/max labels
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '11px monospace'
      ctx.fillText(max.toFixed(1), padding + 4, padding + 12)
      ctx.fillText(min.toFixed(1), padding + 4, height - padding - 4)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [width, height, lineColor, backgroundColor, padding])

  return (
    <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 8 }} />
  )
}
