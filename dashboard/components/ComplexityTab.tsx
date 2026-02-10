'use client'

import { MetricsData } from '@/types/metrics'
import { ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ComplexityTabProps {
  data: MetricsData
}

export default function ComplexityTab({ data }: ComplexityTabProps) {
  // PR size vs iterations scatter plot
  const sizeVsIterations = data.details.map(pr => ({
    prSize: pr.prodAdditions + pr.prodDeletions,
    iterations: pr.iterationCount,
    pr: `${pr.repo}#${pr.number}`
  }))

  // Test vs prod lines stacked bar (top 20 PRs by size)
  const prsBySize = data.details
    .map(pr => ({
      pr: `${pr.repo}#${pr.number}`,
      prodLines: pr.prodAdditions + pr.prodDeletions,
      testLines: pr.testAdditions + pr.testDeletions,
      totalSize: pr.totalAdditions + pr.totalDeletions
    }))
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 20)

  // PR size distribution
  const sizeDistribution = [
    { range: '0-100', count: 0 },
    { range: '101-300', count: 0 },
    { range: '301-500', count: 0 },
    { range: '501-1000', count: 0 },
    { range: '1000+', count: 0 }
  ]

  data.details.forEach(pr => {
    const size = pr.totalAdditions + pr.totalDeletions
    if (size <= 100) sizeDistribution[0].count++
    else if (size <= 300) sizeDistribution[1].count++
    else if (size <= 500) sizeDistribution[2].count++
    else if (size <= 1000) sizeDistribution[3].count++
    else sizeDistribution[4].count++
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          PR Size vs Review Iterations
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="prSize"
                name="PR Size"
                label={{ value: 'Production Lines Changed', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey="iterations"
                name="Iterations"
                label={{ value: 'Review Iterations', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={sizeVsIterations} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Test vs Production Lines (Top 20 PRs)
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={prsBySize}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pr" angle={-45} textAnchor="end" height={100} />
              <YAxis label={{ value: 'Lines Changed', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="prodLines" stackId="a" fill="#3b82f6" name="Production Lines" />
              <Bar dataKey="testLines" stackId="a" fill="#10b981" name="Test Lines" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          PR Size Distribution
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sizeDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis label={{ value: 'Number of PRs', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
