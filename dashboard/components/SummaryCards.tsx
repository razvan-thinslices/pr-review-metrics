'use client'

import { MetricsData } from '@/types/metrics'

interface SummaryCardsProps {
  data: MetricsData
}

export default function SummaryCards({ data }: SummaryCardsProps) {
  const totalPRs = data.details.length
  const totalReviews = data.summary.reduce((sum, r) => sum + r.totalReviews, 0)
  const totalAuthors = data.authorSummary.length
  const totalReviewers = data.summary.length
  
  const allResponseTimes = data.summary
    .map(r => r.medianResponseHours)
    .filter((t): t is string => t !== null)
    .map(t => parseFloat(t))
  
  const avgResponseTime = allResponseTimes.length > 0
    ? (allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length).toFixed(1)
    : 'N/A'
  
  const totalApprovals = data.summary.reduce((sum, r) => sum + r.approvals, 0)
  const totalNoCommentApprovals = data.summary.reduce((sum, r) => sum + r.noCommentApprovals, 0)
  const noCommentRate = totalApprovals > 0
    ? ((totalNoCommentApprovals / totalApprovals) * 100).toFixed(1)
    : '0'
  
  // Author metrics
  const avgPrSize = data.authorSummary.length > 0
    ? Math.round(data.authorSummary.reduce((sum, a) => sum + a.authoredPrAvgSize, 0) / data.authorSummary.length)
    : 0
  
  const allCloseTimes = data.authorSummary
    .map(a => parseFloat(a.authoredPrAvgCloseTime))
    .filter(t => !isNaN(t))
  
  const avgCloseTime = allCloseTimes.length > 0
    ? (allCloseTimes.reduce((a, b) => a + b, 0) / allCloseTimes.length).toFixed(1)
    : 'N/A'

  const cards = [
    {
      title: 'Total PRs',
      value: totalPRs,
      subtitle: `${data.repos.length} repositories`
    },
    {
      title: 'Contributors',
      value: `${totalAuthors} / ${totalReviewers}`,
      subtitle: 'authors / reviewers'
    },
    {
      title: 'Avg PR Size',
      value: avgPrSize,
      subtitle: 'lines changed'
    },
    {
      title: 'Avg Time to Merge',
      value: avgCloseTime === 'N/A' ? 'N/A' : `${avgCloseTime}h`,
      subtitle: 'from creation to merge'
    },
    {
      title: 'Total Reviews',
      value: totalReviews,
      subtitle: `${data.summary.length} reviewers`
    },
    {
      title: 'Avg Response Time',
      value: avgResponseTime === 'N/A' ? 'N/A' : `${avgResponseTime}h`,
      subtitle: 'median across reviewers'
    },
    {
      title: 'No-Comment Approvals',
      value: `${noCommentRate}%`,
      subtitle: `${totalNoCommentApprovals} of ${totalApprovals} approvals`
    },
    {
      title: 'Avg Reviews per PR',
      value: totalPRs > 0 ? (totalReviews / totalPRs).toFixed(1) : '0',
      subtitle: 'reviews given per PR'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            {card.title}
          </h3>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {card.value}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {card.subtitle}
          </p>
        </div>
      ))}
    </div>
  )
}
