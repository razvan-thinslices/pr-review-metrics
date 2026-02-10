'use client'

import { MetricsData } from '@/types/metrics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface ReviewerActivityTabProps {
  data: MetricsData
}

export default function ReviewerActivityTab({ data }: ReviewerActivityTabProps) {
  // PRs Reviewed Count
  const prsReviewedData = data.summary
    .map(r => ({
      reviewer: r.reviewer,
      prsReviewed: r.prsReviewedCount
    }))
    .sort((a, b) => b.prsReviewed - a.prsReviewed)

  // Average PR Close Time for Reviewed PRs
  const closeTimeData = data.summary
    .filter(r => r.avgReviewedPrCloseTime !== null)
    .map(r => ({
      reviewer: r.reviewer,
      avgCloseTime: parseFloat(r.avgReviewedPrCloseTime || '0')
    }))
    .sort((a, b) => b.avgCloseTime - a.avgCloseTime)

  // Review Load Analysis (PRs reviewed vs Avg size)
  const reviewLoadData = data.summary.map(r => ({
    reviewer: r.reviewer,
    prsReviewed: r.prsReviewedCount,
    avgSize: r.avgPrSizeReviewed
  })).sort((a, b) => b.prsReviewed - a.prsReviewed)

  // Reviewer vs Author Matrix
  const reviewerAuthorMatrix: { [key: string]: { [key: string]: number } } = {}
  
  data.details.forEach(pr => {
    if (pr.error) return
    const author = pr.author
    pr.reviews.forEach(review => {
      const reviewer = review.reviewer
      if (!reviewerAuthorMatrix[reviewer]) {
        reviewerAuthorMatrix[reviewer] = {}
      }
      reviewerAuthorMatrix[reviewer][author] = (reviewerAuthorMatrix[reviewer][author] || 0) + 1
    })
  })

  // Convert matrix to table data
  const allAuthors = Array.from(new Set(data.details.map(pr => pr.author)))
  const matrixData = Object.entries(reviewerAuthorMatrix).map(([reviewer, authors]) => ({
    reviewer,
    ...authors,
    total: Object.values(authors).reduce((sum, count) => sum + count, 0)
  })).sort((a, b) => b.total - a.total)

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          PRs Reviewed Count
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={prsReviewedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reviewer" angle={-45} textAnchor="end" height={120} />
              <YAxis label={{ value: 'Number of PRs Reviewed', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="prsReviewed" name="PRs Reviewed">
                {prsReviewedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Average PR Close Time for Reviewed PRs
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={closeTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reviewer" angle={-45} textAnchor="end" height={120} />
              <YAxis label={{ value: 'Average Hours to Merge', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="avgCloseTime" fill="#f59e0b" name="Avg Close Time (hours)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Review Load Analysis
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={reviewLoadData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reviewer" angle={-45} textAnchor="end" height={120} />
              <YAxis yAxisId="left" label={{ value: 'PRs Reviewed', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg PR Size', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="prsReviewed" fill="#3b82f6" name="PRs Reviewed" />
              <Bar yAxisId="right" dataKey="avgSize" fill="#10b981" name="Avg PR Size" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Reviewer vs Author Matrix
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-900">
                    Reviewer
                  </th>
                  {allAuthors.map((author) => (
                    <th key={author} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {author}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-gray-800">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {matrixData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800">
                      {row.reviewer}
                    </td>
                    {allAuthors.map((author) => (
                      <td key={author} className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                        {row[author] || '-'}
                      </td>
                    ))}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
            Numbers represent the count of reviews given by each reviewer to each author's PRs
          </div>
        </div>
      </div>
    </div>
  )
}
