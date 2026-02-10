'use client'

import { MetricsData } from '@/types/metrics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface OverviewTabProps {
  data: MetricsData
}

export default function OverviewTab({ data }: OverviewTabProps) {
  // Prepare data for reviews by reviewer chart
  const reviewsByReviewer = data.summary.map(r => ({
    reviewer: r.reviewer,
    Approved: r.approvals,
    'Changes Requested': r.changesRequested,
    'Comment Only': r.commentOnlyReviews
  }))

  // Prepare data for no-comment approval % chart
  const noCommentData = data.summary
    .map(r => ({
      reviewer: r.reviewer,
      percentage: r.noCommentApprovalPct
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10) // Top 10

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Reviews per Reviewer
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={reviewsByReviewer}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reviewer" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Approved" stackId="a" fill="#10b981" />
              <Bar dataKey="Changes Requested" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Comment Only" stackId="a" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          No-Comment Approval Rate (Top 10)
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={noCommentData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit="%" />
              <YAxis type="category" dataKey="reviewer" width={120} />
              <Tooltip />
              <Bar dataKey="percentage" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
