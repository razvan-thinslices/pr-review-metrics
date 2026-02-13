'use client'

import { MetricsData } from '@/types/metrics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ReviewerActivityTabProps {
  data: MetricsData
}

export default function ReviewerActivityTab({ data }: ReviewerActivityTabProps) {
  // Review Load Analysis (PRs reviewed vs Avg size)
  const reviewLoadData = data.summary.map(r => ({
    reviewer: r.reviewer,
    prsReviewed: r.prsReviewedCount,
    avgSize: r.avgPrSizeReviewed
  })).sort((a, b) => b.prsReviewed - a.prsReviewed)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Review Load Analysis
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Number of PRs reviewed vs average PR size per reviewer
        </p>
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
    </div>
  )
}
