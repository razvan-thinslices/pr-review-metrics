'use client'

import { MetricsData } from '@/types/metrics'
import { 
  findMostActiveDeveloper, 
  findFastestVelocity, 
  findMostResponsiveReviewer, 
  calculateAvgChurnRate,
  findTopQualityScore,
  formatWorkingHours,
  getTeamSummary
} from '@/lib/utils'

interface SummaryCardsProps {
  data: MetricsData
}

export default function SummaryCards({ data }: SummaryCardsProps) {
  const totalPRs = data.details.length
  const totalReviews = data.summary.reduce((sum, r) => sum + r.totalReviews, 0)
  const totalAuthors = data.authorSummary.length
  const totalReviewers = data.summary.length
  
  const teamSummary = getTeamSummary(data)
  
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
  
  // Use team summary for accurate weighted averages (working hours)
  const avgPrSize = teamSummary.authored.avgPrSize
  const avgCloseTime = teamSummary.authored.avgCloseTime !== null
    ? teamSummary.authored.avgCloseTime.toFixed(1)
    : 'N/A'

  // Developer-centric metrics
  const mostActive = findMostActiveDeveloper(data)
  const fastestVelocity = findFastestVelocity(data)
  const mostResponsive = findMostResponsiveReviewer(data)
  const avgChurnRate = calculateAvgChurnRate(data)
  const topQuality = findTopQualityScore(data)

  const overviewCards = [
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
      subtitle: 'working hours to merge'
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

  const developerCards = [
    {
      title: 'Most Active Dev',
      value: mostActive?.name ?? 'N/A',
      subtitle: mostActive ? `${mostActive.activity} contributions` : 'No data',
      highlight: true
    },
    {
      title: 'Fastest PR Velocity',
      value: fastestVelocity?.name ?? 'N/A',
      subtitle: fastestVelocity ? formatWorkingHours(fastestVelocity.hours) : 'No data',
      highlight: true
    },
    {
      title: 'Most Responsive',
      value: mostResponsive?.name ?? 'N/A',
      subtitle: mostResponsive ? formatWorkingHours(mostResponsive.hours) : 'No data',
      highlight: true
    },
    {
      title: 'Avg Churn Rate',
      value: `${avgChurnRate.toFixed(1)}%`,
      subtitle: 'code re-work across PRs',
      highlight: true
    },
    {
      title: 'Top Quality Score',
      value: topQuality?.name ?? 'N/A',
      subtitle: topQuality ? `Score: ${topQuality.score}/100` : 'No data',
      highlight: true
    }
  ]

  return (
    <div className="space-y-6 mb-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewCards.map((card, index) => (
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

      {/* Developer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {developerCards.map((card, index) => (
          <div
            key={index}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-md p-4 border border-blue-200 dark:border-blue-800"
          >
            <h3 className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
              {card.title}
            </h3>
            <div className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-0.5 truncate" title={String(card.value)}>
              {card.value}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {card.subtitle}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
