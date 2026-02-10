'use client'

import { MetricsData } from '@/types/metrics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'

interface AuthorMetricsTabProps {
  data: MetricsData
}

export default function AuthorMetricsTab({ data }: AuthorMetricsTabProps) {
  // Authored PR Size Distribution (stacked: prod vs test)
  const prSizeData = data.authorSummary.map(a => ({
    author: a.author,
    prodLines: a.authoredPrAvgProdLines,
    testLines: a.authoredPrAvgTestLines
  })).sort((a, b) => (b.prodLines + b.testLines) - (a.prodLines + a.testLines))

  // PR Review Time Comparison (time to first review vs time to merge)
  const reviewTimeData = data.authorSummary
    .filter(a => a.authoredPrAvgReviewTime !== null)
    .map(a => ({
      author: a.author,
      timeToFirstReview: parseFloat(a.authoredPrAvgReviewTime || '0'),
      timeToMerge: parseFloat(a.authoredPrAvgCloseTime)
    }))
    .sort((a, b) => b.timeToMerge - a.timeToMerge)

  // Reviews Received per Author
  const reviewsReceivedData = data.authorSummary.map(a => ({
    author: a.author,
    avgReviews: parseFloat(a.authoredPrAvgReviewCount)
  })).sort((a, b) => b.avgReviews - a.avgReviews)

  // Author Efficiency Scatter (PR size vs time to merge)
  const efficiencyData = data.authorSummary.map(a => ({
    author: a.author,
    prSize: a.authoredPrAvgSize,
    timeToMerge: parseFloat(a.authoredPrAvgCloseTime),
    prsCount: a.prsAuthored
  }))

  // Top 10 Authors Table
  const topAuthors = data.authorSummary.slice(0, 10)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Authored PR Size Distribution
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={prSizeData}>
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
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          PR Review Time Comparison
        </h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Average Reviews Received
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reviewsReceivedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="author" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgReviews" fill="#ec4899" name="Avg Reviews" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Author Efficiency (Size vs Time)
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="prSize"
                  name="PR Size"
                  label={{ value: 'Avg PR Size (lines)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  type="number"
                  dataKey="timeToMerge"
                  name="Time to Merge"
                  label={{ value: 'Time to Merge (hours)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={efficiencyData} fill="#14b8a6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Top 10 Authors by Activity
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PRs Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Review Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Close Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Reviews
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {topAuthors.map((author, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {author.author}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {author.prsAuthored}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {author.authoredPrAvgSize} lines
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {author.authoredPrAvgReviewTime ? `${author.authoredPrAvgReviewTime}h` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {author.authoredPrAvgCloseTime}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {author.authoredPrAvgReviewCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
