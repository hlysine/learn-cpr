import { computeActualSamplingRate, computeCPRFeedback } from '#/components/cpr'
import { startAccelerometer } from '#/components/sensor'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import RealtimeChart from 'react-realtime-chart'
import type {
  RealtimeChartData,
  RealtimeChartOptions,
} from 'react-realtime-chart'

export const Route = createFileRoute('/feedback')({
  component: Feedback,
})

function createOptions(min: number, max: number): RealtimeChartOptions {
  return {
    fps: 60,
    timeSlots: 20,
    margin: {
      top: 10,
      right: 25,
      bottom: 25,
      left: 50,
    },
    colors: ['#ffffff'],
    lines: [
      {
        area: false,
        areaColor: '#ffffff',
        areaOpacity: 0,
        color: '#ffffff',
        lineWidth: 2,
        curve: 'linear',
      },
    ],
    yGrid: {
      min,
      max,
      color: '#171717',
      opacity: 1,
      size: 1,
      tickNumber: 5,
      tickPadding: 20,
      tickFontWeight: 400,
      tickFontColor: '#ffffff',
      tickFontSize: 12,
      tickFontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    },
    xGrid: {
      color: '#171717',
      opacity: 1,
      size: 1,
      tickNumber: 2,
      tickFontColor: '#ffffff',
      tickFontSize: 12,
      tickFontWeight: 400,
      tickFontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    },
  }
}
const rateOptions = createOptions(0, 150)
const depthOptions = createOptions(0, 10)

interface FeedbackData {
  depth: RealtimeChartData[][]
  rate: RealtimeChartData[][]
}

type DepthStatus = 'inadequate' | 'adequate' | 'unknown'
type RateStatus = 'slow' | 'adequate' | 'fast' | 'unknown'

const SAMPLE_WINDOW = 2 // seconds
const VIZ_WINDOW = 40 // seconds
const FFT_SIZE = 2048
const NUM_HARMONICS = 5

function getDepthStatus(depthCm: number | null): DepthStatus {
  if (depthCm === null) {
    return 'unknown'
  }
  return depthCm >= 5 ? 'adequate' : 'inadequate'
}

function getRateStatus(rateBpm: number | null): RateStatus {
  if (rateBpm === null) {
    return 'unknown'
  }
  if (rateBpm < 100) {
    return 'slow'
  }
  if (rateBpm > 120) {
    return 'fast'
  }
  return 'adequate'
}

function DepthPill({ status }: { status: DepthStatus }) {
  return (
    <div className="w-52 rounded-full border border-zinc-700 bg-zinc-900 p-1 shadow-md">
      <div className="grid grid-cols-2 gap-1">
        <div
          className={`h-7 rounded-full transition-colors ${
            status === 'inadequate' ? 'bg-red-500' : 'bg-zinc-700'
          }`}
        />
        <div
          className={`h-7 rounded-full transition-colors ${
            status === 'adequate' ? 'bg-green-500' : 'bg-zinc-700'
          }`}
        />
      </div>
    </div>
  )
}

function RatePill({ status }: { status: RateStatus }) {
  return (
    <div className="w-64 rounded-full border border-zinc-700 bg-zinc-900 p-1 shadow-md">
      <div className="grid grid-cols-3 gap-1">
        <div
          className={`h-7 rounded-full transition-colors ${
            status === 'slow' ? 'bg-amber-500' : 'bg-zinc-700'
          }`}
        />
        <div
          className={`h-7 rounded-full transition-colors ${
            status === 'adequate' ? 'bg-green-500' : 'bg-zinc-700'
          }`}
        />
        <div
          className={`h-7 rounded-full transition-colors ${
            status === 'fast' ? 'bg-red-500' : 'bg-zinc-700'
          }`}
        />
      </div>
    </div>
  )
}

function Feedback() {
  const [feedbackData, setFeedbackData] = useState<FeedbackData>(() => ({
    depth: [[]],
    rate: [[]],
  }))

  useEffect(() => {
    let stopAccelerometer: (() => void) | null = null
    let idx = 0
    const mutSensorData: number[] = []
    const timestamps: number[] = []
    startAccelerometer((sensor) => {
      idx += 1
      mutSensorData.push(sensor.z ?? 0)
      timestamps.push(Date.now())
      const samplingRate = computeActualSamplingRate(timestamps)
      if (timestamps.length > SAMPLE_WINDOW * samplingRate) {
        mutSensorData.shift()
        timestamps.shift()
      }
      if (idx % 10 === 0) {
        setFeedbackData((prev) => {
          const cprFeedback = computeCPRFeedback(
            mutSensorData.slice(-SAMPLE_WINDOW * samplingRate),
            FFT_SIZE,
            samplingRate,
            NUM_HARMONICS,
          )
          return {
            ...prev,
            depth: [
              [
                ...prev.depth[0].slice(-VIZ_WINDOW * samplingRate),
                { date: new Date(), value: cprFeedback.depth / 10 },
              ],
            ],
            rate: [
              [
                ...prev.rate[0].slice(-VIZ_WINDOW * samplingRate),
                { date: new Date(), value: cprFeedback.rate },
              ],
            ],
          }
        })
      }
    })
      .then((stop) => {
        stopAccelerometer = stop
      })
      .catch((error) => {
        console.error('Error starting accelerometer sensor:', error)
      })

    return () => {
      stopAccelerometer?.()
    }
  }, [])

  const hasDepthData = feedbackData.depth[0].length > 0
  const hasRateData = feedbackData.rate[0].length > 0

  const latestDepth = hasDepthData
    ? feedbackData.depth[0][feedbackData.depth[0].length - 1].value
    : null
  const latestRate = hasRateData
    ? feedbackData.rate[0][feedbackData.rate[0].length - 1].value
    : null

  const depthStatus = getDepthStatus(latestDepth)
  const rateStatus = getRateStatus(latestRate)

  const latestDepthDisplay = latestDepth?.toFixed(0) ?? 'N/A'
  const latestRateDisplay = latestRate?.toFixed(0) ?? 'N/A'

  return (
    <main className="page-wrap px-2 py-4">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Feedback</h1>
      <div className="flex justify-between items-center">
        <p className="my-4 text-lg">Depth: {latestDepthDisplay} cm</p>
        <DepthPill status={depthStatus} />
      </div>
      <div className="h-60">
        <RealtimeChart data={feedbackData.depth} options={depthOptions} />
      </div>
      <div className="flex justify-between items-center">
        <p className="my-4 text-lg">Rate: {latestRateDisplay}</p>
        <RatePill status={rateStatus} />
      </div>
      <div className="h-60">
        <RealtimeChart data={feedbackData.rate} options={rateOptions} />
      </div>
    </main>
  )
}
