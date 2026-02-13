'use client'

import { useState, useMemo, useCallback } from 'react'
import { MetricsData } from '@/types/metrics'
import { 
  getTeamSummary, 
  computeTeamStatsForRepo, 
  formatWorkingHours, 
  formatNumber, 
  formatPercent,
  calculateWorkingHours,
  calculateQualityScore
} from '@/lib/utils'

interface DeveloperStatsTabProps {
  data: MetricsData
}

type ViewMode = 'authored' | 'reviewed'
type SortField = string
type SortDirection = 'asc' | 'desc'

interface AuthoredRow {
  developer: string
  prsAuthored: number
  avgSizeProd: number
  avgSizeTest: number
  avgSizeTotal: number
  avgCloseTime: number | null
  avgIterations: number
  churnPct: number
  fileChurn: number
  commitsPerPr: number
  qualityScore: number
  isTeamRow?: boolean
}

interface ReviewedRow {
  developer: string
  prsReviewed: number
  totalReviews: number
  avgSizeProd: number
  avgSizeTest: number
  avgSizeTotal: number
  responseTime: number | null
  noCommentPct: number
  avgComments: number
  avgIterations: number
  isTeamRow?: boolean
}

export default function DeveloperStatsTab({ data }: DeveloperStatsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('authored')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('prsAuthored')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Compute stats for the selected repo
  const teamStats = useMemo(() => {
    if (selectedRepo === 'all') {
      return getTeamSummary(data)
    }
    return computeTeamStatsForRepo(data, selectedRepo)
  }, [data, selectedRepo])

  // Compute per-developer authored stats (filtered by repo if needed)
  const authoredRows = useMemo((): AuthoredRow[] => {
    const filteredPRs = selectedRepo === 'all' 
      ? data.details.filter(p => !p.error)
      : data.details.filter(p => !p.error && p.repo === selectedRepo)
    
    // Aggregate per author
    const authorMap = new Map<string, {
      prsAuthored: number
      totalProd: number
      totalTest: number
      totalSize: number
      totalFiles: number
      totalProdFiles: number
      workingHours: number[]
      totalIterations: number
      totalChurn: number
      churnCount: number
      totalFileChurn: number
      fileChurnCount: number
      totalCommits: number
    }>()
    
    for (const pr of filteredPRs) {
      if (!authorMap.has(pr.author)) {
        authorMap.set(pr.author, {
          prsAuthored: 0,
          totalProd: 0,
          totalTest: 0,
          totalSize: 0,
          totalFiles: 0,
          totalProdFiles: 0,
          workingHours: [],
          totalIterations: 0,
          totalChurn: 0,
          churnCount: 0,
          totalFileChurn: 0,
          fileChurnCount: 0,
          totalCommits: 0
        })
      }
      
      const stats = authorMap.get(pr.author)!
      stats.prsAuthored++
      stats.totalProd += pr.prodAdditions + pr.prodDeletions
      stats.totalTest += pr.testAdditions + pr.testDeletions
      stats.totalSize += pr.totalAdditions + pr.totalDeletions
      stats.totalFiles += pr.filesChanged
      stats.totalProdFiles += pr.prodFilesChanged
      stats.totalIterations += pr.iterationCount
      stats.totalCommits += pr.commitCount || 1
      
      // Compute working hours from raw timestamps
      const workingHrs = calculateWorkingHours(pr.createdAt, pr.mergedAt)
      if (workingHrs > 0) {
        stats.workingHours.push(workingHrs)
      }
      
      if (pr.churnPercentage !== undefined) {
        stats.totalChurn += pr.churnPercentage
        stats.churnCount++
      }
      
      if (pr.fileChurnCount !== undefined) {
        stats.totalFileChurn += pr.fileChurnCount
        stats.fileChurnCount++
      }
    }
    
    const rows: AuthoredRow[] = []
    
    for (const [developer, stats] of authorMap) {
      const avgCloseTime = stats.workingHours.length > 0 
        ? stats.workingHours.reduce((a, b) => a + b, 0) / stats.workingHours.length 
        : null
      const avgIterations = stats.totalIterations / stats.prsAuthored
      const churnPct = stats.churnCount > 0 ? stats.totalChurn / stats.churnCount : 0
      
      // Calculate quality score using source (non-test) lines and files
      const avgSrcSize = stats.totalProd / stats.prsAuthored
      const avgSrcFiles = stats.totalProdFiles / stats.prsAuthored
      const qualityScore = calculateQualityScore(
        {
          avgSrcSize,
          avgSrcFiles,
          avgIterations,
          avgWorkingHoursToClose: avgCloseTime,
          churnPct
        },
        teamStats.authored
      )
      
      rows.push({
        developer,
        prsAuthored: stats.prsAuthored,
        avgSizeProd: Math.round(stats.totalProd / stats.prsAuthored),
        avgSizeTest: Math.round(stats.totalTest / stats.prsAuthored),
        avgSizeTotal: Math.round(stats.totalSize / stats.prsAuthored),
        avgCloseTime,
        avgIterations,
        churnPct,
        fileChurn: stats.fileChurnCount > 0 ? stats.totalFileChurn / stats.fileChurnCount : 0,
        commitsPerPr: stats.totalCommits / stats.prsAuthored,
        qualityScore
      })
    }
    
    return rows
  }, [data, selectedRepo, teamStats])

  // Compute per-developer reviewed stats (filtered by repo if needed)
  const reviewedRows = useMemo((): ReviewedRow[] => {
    const filteredPRs = selectedRepo === 'all' 
      ? data.details.filter(p => !p.error)
      : data.details.filter(p => !p.error && p.repo === selectedRepo)
    
    // Aggregate per reviewer
    const reviewerMap = new Map<string, {
      prsReviewed: Set<string>
      totalReviews: number
      totalProd: number
      totalTest: number
      totalSize: number
      responseTimes: number[]
      totalInlineComments: number
      totalIterations: number
    }>()
    
    for (const pr of filteredPRs) {
      const prKey = `${pr.repo}#${pr.number}`
      const prSize = pr.totalAdditions + pr.totalDeletions
      const prodSize = pr.prodAdditions + pr.prodDeletions
      const testSize = pr.testAdditions + pr.testDeletions
      
      for (const review of pr.reviews) {
        if (!reviewerMap.has(review.reviewer)) {
          reviewerMap.set(review.reviewer, {
            prsReviewed: new Set(),
            totalReviews: 0,
            totalProd: 0,
            totalTest: 0,
            totalSize: 0,
            responseTimes: [],
            totalInlineComments: 0,
            totalIterations: 0
          })
        }
        
        const stats = reviewerMap.get(review.reviewer)!
        stats.totalReviews++
        stats.totalInlineComments += review.inlineCommentCount
        
        // Track response times using firstActivityAt (computed client-side from createdAt)
        if (review.firstActivityAt) {
          const workingHrs = calculateWorkingHours(pr.createdAt, review.firstActivityAt)
          if (workingHrs >= 0) {
            stats.responseTimes.push(workingHrs)
          }
        }
        
        // Track PR-level metrics only once per reviewer
        if (!stats.prsReviewed.has(prKey)) {
          stats.prsReviewed.add(prKey)
          stats.totalProd += prodSize
          stats.totalTest += testSize
          stats.totalSize += prSize
          stats.totalIterations += pr.iterationCount
        }
      }
    }
    
    const rows: ReviewedRow[] = []
    
    for (const [developer, stats] of reviewerMap) {
      const prsCount = stats.prsReviewed.size
      const medianResponse = stats.responseTimes.length > 0
        ? [...stats.responseTimes].sort((a, b) => a - b)[Math.floor(stats.responseTimes.length / 2)]
        : null
      
      rows.push({
        developer,
        prsReviewed: prsCount,
        totalReviews: stats.totalReviews,
        avgSizeProd: prsCount > 0 ? Math.round(stats.totalProd / prsCount) : 0,
        avgSizeTest: prsCount > 0 ? Math.round(stats.totalTest / prsCount) : 0,
        avgSizeTotal: prsCount > 0 ? Math.round(stats.totalSize / prsCount) : 0,
        responseTime: medianResponse,
        noCommentPct: 0, // Computed below
        avgComments: stats.totalReviews > 0 ? stats.totalInlineComments / stats.totalReviews : 0,
        avgIterations: prsCount > 0 ? stats.totalIterations / prsCount : 0
      })
    }
    
    // Compute no-comment approval percentage from original data
    const reviewerApprovals = new Map<string, { approvals: number, noCommentApprovals: number }>()
    
    for (const pr of filteredPRs) {
      for (const review of pr.reviews) {
        if (!reviewerApprovals.has(review.reviewer)) {
          reviewerApprovals.set(review.reviewer, { approvals: 0, noCommentApprovals: 0 })
        }
        
        if (review.state === 'APPROVED') {
          const stats = reviewerApprovals.get(review.reviewer)!
          stats.approvals++
          if (!review.hasComments) {
            stats.noCommentApprovals++
          }
        }
      }
    }
    
    for (const row of rows) {
      const approvalStats = reviewerApprovals.get(row.developer)
      if (approvalStats && approvalStats.approvals > 0) {
        row.noCommentPct = (approvalStats.noCommentApprovals / approvalStats.approvals) * 100
      }
    }
    
    return rows
  }, [data, selectedRepo])

  // Filter rows by search term
  const filteredAuthoredRows = useMemo(() => {
    if (!searchTerm) return authoredRows
    const term = searchTerm.toLowerCase()
    return authoredRows.filter(row => row.developer.toLowerCase().includes(term))
  }, [authoredRows, searchTerm])

  const filteredReviewedRows = useMemo(() => {
    if (!searchTerm) return reviewedRows
    const term = searchTerm.toLowerCase()
    return reviewedRows.filter(row => row.developer.toLowerCase().includes(term))
  }, [reviewedRows, searchTerm])

  // Sort rows
  const sortedAuthoredRows = useMemo(() => {
    const sorted = [...filteredAuthoredRows].sort((a, b) => {
      const aVal = a[sortField as keyof AuthoredRow]
      const bVal = b[sortField as keyof AuthoredRow]
      
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [filteredAuthoredRows, sortField, sortDirection])

  const sortedReviewedRows = useMemo(() => {
    const sorted = [...filteredReviewedRows].sort((a, b) => {
      const aVal = a[sortField as keyof ReviewedRow]
      const bVal = b[sortField as keyof ReviewedRow]
      
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [filteredReviewedRows, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </span>
  )

  const HeaderCell = ({ field, children, className = '' }: { field: string, children: React.ReactNode, className?: string }) => (
    <th 
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
      onClick={() => handleSort(field)}
    >
      {children}
      <SortIcon field={field} />
    </th>
  )

  // Team row for authored view
  const teamAvgQualityScore = useMemo(() => {
    if (authoredRows.length === 0) return 0
    const totalPRs = authoredRows.reduce((sum, r) => sum + r.prsAuthored, 0)
    const weightedSum = authoredRows.reduce((sum, r) => sum + r.qualityScore * r.prsAuthored, 0)
    return totalPRs > 0 ? Math.round(weightedSum / totalPRs) : 0
  }, [authoredRows])

  const authoredTeamRow: AuthoredRow = {
    developer: 'TEAM AVG/TOTAL',
    prsAuthored: teamStats.authored.totalPRs,
    avgSizeProd: teamStats.authored.avgProdLines,
    avgSizeTest: teamStats.authored.avgTestLines,
    avgSizeTotal: teamStats.authored.avgPrSize,
    avgCloseTime: teamStats.authored.avgCloseTime,
    avgIterations: teamStats.authored.avgIterations,
    churnPct: teamStats.authored.avgChurnPct,
    fileChurn: teamStats.authored.avgFileChurn,
    commitsPerPr: teamStats.authored.avgCommitsPerPr,
    qualityScore: teamAvgQualityScore,
    isTeamRow: true
  }

  // Team row for reviewed view
  const reviewedTeamRow: ReviewedRow = {
    developer: 'TEAM AVG/TOTAL',
    prsReviewed: 0, // Not meaningful for team
    totalReviews: teamStats.reviewed.totalReviews,
    avgSizeProd: teamStats.reviewed.avgProdLinesReviewed,
    avgSizeTest: teamStats.reviewed.avgTestLinesReviewed,
    avgSizeTotal: teamStats.reviewed.avgPrSizeReviewed,
    responseTime: teamStats.reviewed.medianResponseTime,
    noCommentPct: teamStats.reviewed.overallNoCommentPct,
    avgComments: teamStats.reviewed.avgInlineComments,
    avgIterations: teamStats.reviewed.avgIterationsPerPr,
    isTeamRow: true
  }

  // Reviewer vs Author Matrix
  const { matrixData, matrixAuthors } = useMemo(() => {
    const filteredPRs = selectedRepo === 'all'
      ? data.details.filter(p => !p.error)
      : data.details.filter(p => !p.error && p.repo === selectedRepo)

    const reviewerAuthorMatrix: { [key: string]: { [key: string]: number } } = {}
    
    filteredPRs.forEach(pr => {
      const author = pr.author
      pr.reviews.forEach(review => {
        const reviewer = review.reviewer
        if (!reviewerAuthorMatrix[reviewer]) {
          reviewerAuthorMatrix[reviewer] = {}
        }
        reviewerAuthorMatrix[reviewer][author] = (reviewerAuthorMatrix[reviewer][author] || 0) + 1
      })
    })

    const allAuthors = Array.from(new Set(filteredPRs.map(pr => pr.author)))
    const matrixRows = Object.entries(reviewerAuthorMatrix).map(([reviewer, authors]) => ({
      reviewer,
      ...authors,
      total: Object.values(authors).reduce((sum, count) => sum + count, 0)
    } as Record<string, number | string>)).sort((a, b) => (b.total as number) - (a.total as number))

    return { matrixData: matrixRows, matrixAuthors: allAuthors }
  }, [data, selectedRepo])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by developer name..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <select
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
          >
            <option value="all">All Repositories</option>
            {data.repos.map(repo => (
              <option key={repo} value={repo}>{repo}</option>
            ))}
          </select>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            viewMode === 'authored'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          onClick={() => {
            setViewMode('authored')
            setSortField('prsAuthored')
            setSortDirection('desc')
          }}
        >
          Authored Stats
        </button>
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            viewMode === 'reviewed'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          onClick={() => {
            setViewMode('reviewed')
            setSortField('totalReviews')
            setSortDirection('desc')
          }}
        >
          Reviewed Stats
        </button>
      </div>

      {/* Authored View */}
      {viewMode === 'authored' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <HeaderCell field="developer">Developer</HeaderCell>
                  <HeaderCell field="prsAuthored">PRs</HeaderCell>
                  <HeaderCell field="avgSizeProd" className="text-center">Src</HeaderCell>
                  <HeaderCell field="avgSizeTest" className="text-center">Test</HeaderCell>
                  <HeaderCell field="avgSizeTotal" className="text-center">Total</HeaderCell>
                  <HeaderCell field="avgCloseTime">Close Time</HeaderCell>
                  <HeaderCell field="avgIterations">Iterations</HeaderCell>
                  <HeaderCell field="churnPct">Churn %</HeaderCell>
                  <HeaderCell field="fileChurn">File Churn</HeaderCell>
                  <HeaderCell field="commitsPerPr">Commits/PR</HeaderCell>
                  <HeaderCell field="qualityScore">Quality</HeaderCell>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {/* Team Row - always at top */}
                <tr className="bg-blue-50 dark:bg-blue-900/30 font-semibold">
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {authoredTeamRow.developer}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {authoredTeamRow.prsAuthored}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200 text-center">
                    {formatNumber(authoredTeamRow.avgSizeProd)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200 text-center">
                    {formatNumber(authoredTeamRow.avgSizeTest)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200 text-center">
                    {formatNumber(authoredTeamRow.avgSizeTotal)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatWorkingHours(authoredTeamRow.avgCloseTime)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatNumber(authoredTeamRow.avgIterations, 2)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatPercent(authoredTeamRow.churnPct)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatNumber(authoredTeamRow.fileChurn, 1)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatNumber(authoredTeamRow.commitsPerPr, 2)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {authoredTeamRow.qualityScore}/100
                  </td>
                </tr>
                
                {/* Individual Rows */}
                {sortedAuthoredRows.map((row) => (
                  <tr key={row.developer} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.developer}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {row.prsAuthored}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                      {formatNumber(row.avgSizeProd)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                      {formatNumber(row.avgSizeTest)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                      {formatNumber(row.avgSizeTotal)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatWorkingHours(row.avgCloseTime)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(row.avgIterations, 2)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatPercent(row.churnPct)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(row.fileChurn, 1)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(row.commitsPerPr, 2)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {row.qualityScore}/100
                    </td>
                  </tr>
                ))}
                
                {sortedAuthoredRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                      No developers found matching &quot;{searchTerm}&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
            Avg Size shows average lines changed per PR (additions + deletions). Close Time is in working hours. Quality = source size (35%) + close time (30%) + iterations (20%) + churn (15%). Size score uses source lines/files only, excluding test code.
          </div>
        </div>
      )}

      {/* Reviewed View */}
      {viewMode === 'reviewed' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <HeaderCell field="developer">Developer</HeaderCell>
                  <HeaderCell field="prsReviewed">PRs</HeaderCell>
                  <HeaderCell field="totalReviews">Reviews</HeaderCell>
                  <HeaderCell field="avgSizeProd" className="text-center">Src</HeaderCell>
                  <HeaderCell field="avgSizeTest" className="text-center">Test</HeaderCell>
                  <HeaderCell field="avgSizeTotal" className="text-center">Total</HeaderCell>
                  <HeaderCell field="responseTime">Response</HeaderCell>
                  <HeaderCell field="noCommentPct">No-Cmt %</HeaderCell>
                  <HeaderCell field="avgComments">Avg Cmts</HeaderCell>
                  <HeaderCell field="avgIterations">Iterations</HeaderCell>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {/* Team Row - always at top */}
                <tr className="bg-blue-50 dark:bg-blue-900/30 font-semibold">
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {reviewedTeamRow.developer}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    --
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {reviewedTeamRow.totalReviews}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200 text-center">
                    {formatNumber(reviewedTeamRow.avgSizeProd)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200 text-center">
                    {formatNumber(reviewedTeamRow.avgSizeTest)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200 text-center">
                    {formatNumber(reviewedTeamRow.avgSizeTotal)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatWorkingHours(reviewedTeamRow.responseTime)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatPercent(reviewedTeamRow.noCommentPct)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatNumber(reviewedTeamRow.avgComments, 2)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-800 dark:text-blue-200">
                    {formatNumber(reviewedTeamRow.avgIterations, 2)}
                  </td>
                </tr>
                
                {/* Individual Rows */}
                {sortedReviewedRows.map((row) => (
                  <tr key={row.developer} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.developer}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {row.prsReviewed}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {row.totalReviews}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                      {formatNumber(row.avgSizeProd)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                      {formatNumber(row.avgSizeTest)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                      {formatNumber(row.avgSizeTotal)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatWorkingHours(row.responseTime)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatPercent(row.noCommentPct)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(row.avgComments, 2)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(row.avgIterations, 2)}
                    </td>
                  </tr>
                ))}
                
                {sortedReviewedRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                      No reviewers found matching &quot;{searchTerm}&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
            Avg Size shows average lines in PRs reviewed. Response time is median working hours from PR open to first activity.
          </div>
        </div>
      )}

      {/* Reviewer vs Author Matrix */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
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
                  {matrixAuthors.map((author) => (
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
                    {matrixAuthors.map((author) => (
                      <td key={author} className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                        {(row[author] as number) || '-'}
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
            Numbers represent the count of reviews given by each reviewer to each author&apos;s PRs{selectedRepo !== 'all' ? ` (filtered to ${selectedRepo})` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
