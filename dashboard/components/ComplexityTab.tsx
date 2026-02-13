'use client'

import { MetricsData } from '@/types/metrics'
import { ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { calculateWorkingHours } from '@/lib/utils'

interface ComplexityTabProps {
  data: MetricsData
}

export default function ComplexityTab({ data }: ComplexityTabProps) {
  // PR size vs iterations scatter plot (per PR)
  const sizeVsIterations = data.details.map(pr => ({
    prSize: pr.prodAdditions + pr.prodDeletions,
    iterations: pr.iterationCount,
    pr: `${pr.repo}#${pr.number}`
  }))

  // PR size vs time-to-merge scatter plot (per PR)
  const sizeVsTime = data.details
    .filter(pr => pr.mergedAt)
    .map(pr => {
      const workingHrs = calculateWorkingHours(pr.createdAt, pr.mergedAt)
      return {
        prSize: pr.prodAdditions + pr.prodDeletions,
        timeToMerge: workingHrs >= 0 ? Math.round(workingHrs * 10) / 10 : null,
        pr: `${pr.repo}#${pr.number}`
      }
    })
    .filter(d => d.timeToMerge !== null)

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

  // Authored PR Size Distribution (from AuthorMetrics - stacked prod vs test per author)
  const authorSizeData = data.authorSummary.map(a => ({
    author: a.author,
    prodLines: a.authoredPrAvgProdLines,
    testLines: a.authoredPrAvgTestLines
  })).sort((a, b) => (b.prodLines + b.testLines) - (a.prodLines + a.testLines))

  // PR Review Time Comparison (from AuthorMetrics - time to first review vs time to merge)
  const reviewTimeData = data.authorSummary
    .filter(a => a.authoredPrAvgReviewTime !== null)
    .map(a => ({
      author: a.author,
      timeToFirstReview: parseFloat(a.authoredPrAvgReviewTime || '0'),
      timeToMerge: parseFloat(a.authoredPrAvgCloseTime)
    }))
    .sort((a, b) => b.timeToMerge - a.timeToMerge)

  return (
    <div className="space-y-8">
      {/* Side-by-side scatter plots: Size vs Iterations and Size vs Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            PR Size vs Review Iterations
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="prSize"
                  name="PR Size"
                  label={{ value: 'Source Lines Changed', position: 'insideBottom', offset: -5 }}
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
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            PR Size vs Time to Merge
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="prSize"
                  name="PR Size"
                  label={{ value: 'Source Lines Changed', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  type="number"
                  dataKey="timeToMerge"
                  name="Time to Merge"
                  label={{ value: 'Working Hours', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={sizeVsTime} fill="#14b8a6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
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
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
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

      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Authored PR Size Distribution
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Average PR size per author, broken down by production and test lines
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={authorSizeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="author" angle={-45} textAnchor="end" height={120} />
              <YAxis label={{ value: 'Average Lines Changed', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="prodLines" stackId="a" fill="#3b82f6" name="Production Lines" />
              <Bar dataKey="testLines" stackId="a" fill="#10b981" name="Test Lines" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          PR Review Time Comparison
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Per-author comparison of time to first review vs time to merge (calendar hours)
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={reviewTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="author" angle={-45} textAnchor="end" height={120} />
              <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="timeToFirstReview" fill="#8b5cf6" name="Time to First Review" />
              <Bar dataKey="timeToMerge" fill="#f59e0b" name="Time to Merge" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
