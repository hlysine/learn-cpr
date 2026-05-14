import { computeActualSamplingRate, computeCPRFeedback } from '#/components/cpr'
import LineChart from '#/components/LineChart'
import { startAccelerometer } from '#/components/sensor'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import RealtimeChart from 'react-realtime-chart'
import type {
  RealtimeChartData,
  RealtimeChartOptions,
} from 'react-realtime-chart'

export const Route = createFileRoute('/debug')({
  component: Debug,
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
const depthOptions = createOptions(0, 100)
const accelerationOptions = createOptions(-25, 25)

interface FeedbackData {
  displacement: number[]
  depth: RealtimeChartData[][]
  rate: RealtimeChartData[][]
  samplingRate: number
}

const SAMPLE_WINDOW = 2 // seconds
const VIZ_WINDOW = 40 // seconds
const FFT_SIZE = 2048
const NUM_HARMONICS = 5

function Debug() {
  const [sensorData, setSensorData] = useState<RealtimeChartData[][]>([[]])
  const [feedbackData, setFeedbackData] = useState<FeedbackData>(() => ({
    displacement: [],
    depth: [[]],
    rate: [[]],
    samplingRate: 0,
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
      setSensorData((prev) => [
        [
          ...prev[0].slice(-VIZ_WINDOW * samplingRate),
          { date: new Date(), value: sensor.z ?? 0 },
        ],
      ])
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
            displacement: cprFeedback.displacement,
            depth: [
              [
                ...prev.depth[0].slice(-VIZ_WINDOW * samplingRate),
                { date: new Date(), value: cprFeedback.depth },
              ],
            ],
            rate: [
              [
                ...prev.rate[0].slice(-VIZ_WINDOW * samplingRate),
                { date: new Date(), value: cprFeedback.rate },
              ],
            ],
            samplingRate: samplingRate,
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

  return (
    <main className="page-wrap px-2 py-4">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Debug</h1>
      <p className="my-4">
        Sampling rate: {feedbackData.samplingRate.toFixed(2)} Hz
      </p>
      <p className="my-4 text-lg">Acceleration</p>
      <div className="h-70">
        <RealtimeChart data={sensorData} options={accelerationOptions} />
      </div>
      <p className="my-4 text-lg">Displacement</p>
      <div className="h-70">
        <LineChart data={feedbackData.displacement} width={350} height={280} />
      </div>
      <p className="my-4 text-lg">
        Depth:{' '}
        {feedbackData.depth[0][feedbackData.depth[0].length - 1]?.value.toFixed(
          2,
        ) ?? 'N/A'}
      </p>
      <div className="h-70">
        <RealtimeChart data={feedbackData.depth} options={depthOptions} />
      </div>
      <p className="my-4 text-lg">
        Rate:{' '}
        {feedbackData.rate[0][feedbackData.rate[0].length - 1]?.value.toFixed(
          2,
        ) ?? 'N/A'}
      </p>
      <div className="h-70">
        <RealtimeChart data={feedbackData.rate} options={rateOptions} />
      </div>
    </main>
  )
}
