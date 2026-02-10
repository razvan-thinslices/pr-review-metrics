'use client'

import { MetricsData } from '@/types/metrics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'

interface ResponseTimeTabProps {
  data: MetricsData
}

export default function ResponseTimeTab({ data }: ResponseTimeTabProps) {
  // Prepare response time data
  const responseTimeData = data.summary
    .filter(r => r.medianResponseHours !== null)
    .map(r => ({
      reviewer: r.reviewer,
      median: parseFloat(r.medianResponseHours || '0'),
      p90: parseFloat(r.p90ResponseHours || '0'),
      fastest: parseFloat(r.fastestResponseHours || '0')
    }))
    .sort((a, b) => a.median - b.median)

  // Prepare scatter plot data for response time vs PR size
  const scatterData = data.details.flatMap(pr =>
    pr.reviews
      .filter(review => review.responseHours !== null && review.responseHours >= 0)
      .map(review => ({
        prSize: pr.prodAdditions + pr.prodDeletions,
        responseTime: review.responseHours,
        reviewer: review.reviewer
      }))
  )

  // Find slowest reviews
  const slowestReviews = data.details
    .flatMap(pr =>
      pr.reviews
        .filter(review => review.responseHours !== null && review.responseHours >= 0)
        .map(review => ({
          pr: `${pr.repo}#${pr.number}`,
          title: pr.title,
          reviewer: review.reviewer,
          responseHours: review.responseHours,
          url: pr.url
        }))
    )
    .sort((a, b) => (b.responseHours || 0) - (a.responseHours || 0))
    .slice(0, 10)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Response Time Distribution
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reviewer" angle={-45} textAnchor="end" height={100} />
              <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="fastest" fill="#10b981" name="Fastest" />
              <Bar dataKey="median" fill="#3b82f6" name="Median" />
              <Bar dataKey="p90" fill="#f59e0b" name="P90" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Response Time vs PR Size
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="prSize"
                name="PR Size"
                label={{ value: 'PR Size (lines)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey="responseTime"
                name="Response Time"
                label={{ value: 'Response Time (hours)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={scatterData} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Slowest Reviews (Top 10)
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  PR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reviewer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Response Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {slowestReviews.map((review, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <a
                      href={review.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {review.pr}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-md truncate">
                    {review.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {review.reviewer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {review.responseHours?.toFixed(1)}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
