'use client'

import { MetricsData, PRDetail } from '@/types/metrics'
import { useState, useMemo } from 'react'
import { calculateWorkingHours, formatWorkingHours, calculateQualityScore, getTeamSummary } from '@/lib/utils'
import Tooltip from './Tooltip'

interface DetailTableProps {
  data: MetricsData
  excludedPRs: Set<string>
  onExcludedPRsChange: (excluded: Set<string>) => void
}

type SortField = 'number' | 'title' | 'author' | 'repo' | 'mergedAt' | 'totalSize' | 'srcSize' | 'testSize' | 'filesChanged' | 'churnPercentage' | 'iterationCount' | 'comments' | 'firstResponseTime' | 'closeTime' | 'qualityScore'
type SortDirection = 'asc' | 'desc'

// Computed row data for display and sorting
interface ComputedPR extends PRDetail {
  totalSize: number
  srcSize: number
  testSize: number
  totalComments: number
  firstResponseTime: number | null
  closeTime: number
  qualityScore: number
}

export default function DetailTable({ data, excludedPRs, onExcludedPRsChange }: DetailTableProps) {
  const [sortField, setSortField] = useState<SortField>('mergedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [repoFilter, setRepoFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const togglePRExclusion = (prKey: string) => {
    const next = new Set(excludedPRs)
    if (next.has(prKey)) {
      next.delete(prKey)
    } else {
      next.add(prKey)
    }
    onExcludedPRsChange(next)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Get team summary for quality score calculation
  const teamSummary = useMemo(() => getTeamSummary(data), [data])

  // Compute derived fields for each PR
  const computedData = useMemo((): ComputedPR[] => {
    return data.details.map(pr => {
      // Total comments across all reviews (inline + conversation)
      const totalComments = pr.reviews.reduce(
        (sum, r) => sum + r.inlineCommentCount + (r.conversationCommentCount || 0),
        0
      )
      
      // First response time (working hours from PR open to first activity)
      const firstResponseTime = pr.firstResponseAt
        ? calculateWorkingHours(pr.createdAt, pr.firstResponseAt)
        : null
      
      // Close time (working hours from PR open to merge)
      const closeTime = calculateWorkingHours(pr.createdAt, pr.mergedAt)

      // Per-PR quality score (uses source lines/files only, excluding test code)
      const totalSize = pr.totalAdditions + pr.totalDeletions
      const srcSize = pr.prodAdditions + pr.prodDeletions
      const qualityScore = calculateQualityScore(
        {
          avgSrcSize: srcSize,
          avgSrcFiles: pr.prodFilesChanged,
          avgIterations: pr.iterationCount,
          avgWorkingHoursToClose: closeTime >= 0 ? closeTime : null,
          churnPct: pr.churnPercentage ?? 0
        },
        teamSummary.authored
      )
      
      return {
        ...pr,
        totalSize,
        srcSize: pr.prodAdditions + pr.prodDeletions,
        testSize: pr.testAdditions + pr.testDeletions,
        totalComments,
        firstResponseTime,
        closeTime,
        qualityScore
      }
    })
  }, [data.details, teamSummary])

  const filteredAndSortedData = useMemo(() => {
    let filtered = computedData

    // Apply repo filter
    if (repoFilter !== 'all') {
      filtered = filtered.filter(pr => pr.repo === repoFilter)
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        pr =>
          pr.title.toLowerCase().includes(query) ||
          pr.author.toLowerCase().includes(query) ||
          pr.number.toString().includes(query)
      )
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'totalSize':
          aVal = a.totalSize
          bVal = b.totalSize
          break
        case 'srcSize':
          aVal = a.srcSize
          bVal = b.srcSize
          break
        case 'testSize':
          aVal = a.testSize
          bVal = b.testSize
          break
        case 'churnPercentage':
          aVal = a.churnPercentage ?? 0
          bVal = b.churnPercentage ?? 0
          break
        case 'comments':
          aVal = a.totalComments
          bVal = b.totalComments
          break
        case 'firstResponseTime':
          aVal = a.firstResponseTime ?? Infinity
          bVal = b.firstResponseTime ?? Infinity
          break
        case 'closeTime':
          aVal = a.closeTime
          bVal = b.closeTime
          break
        case 'qualityScore':
          aVal = a.qualityScore
          bVal = b.qualityScore
          break
        default:
          aVal = a[sortField as keyof PRDetail]
          bVal = b[sortField as keyof PRDetail]
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [computedData, repoFilter, searchQuery, sortField, sortDirection])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400 ml-1">⇅</span>
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const HeaderCell = ({ field, children, className = '' }: { field: SortField, children: React.ReactNode, className?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
    >
      {children}
      <SortIcon field={field} />
    </th>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, author, or PR number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Repositories</option>
            {data.repos.map(repo => (
              <option key={repo} value={repo}>{repo}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                  <Tooltip content="Check to exclude PRs from all calculations">
                    <span className="cursor-help">Excl</span>
                  </Tooltip>
                </th>
                <HeaderCell field="repo">PR</HeaderCell>
                <HeaderCell field="author">Author</HeaderCell>
                <HeaderCell field="totalSize">Size</HeaderCell>
                <HeaderCell field="srcSize">Src</HeaderCell>
                <HeaderCell field="testSize">Test</HeaderCell>
                <HeaderCell field="filesChanged">Files</HeaderCell>
                <HeaderCell field="churnPercentage">Churn</HeaderCell>
                <HeaderCell field="iterationCount">Review</HeaderCell>
                <HeaderCell field="firstResponseTime">1st Response</HeaderCell>
                <HeaderCell field="closeTime">Close Time</HeaderCell>
                <HeaderCell field="qualityScore">Quality</HeaderCell>
                <HeaderCell field="mergedAt">Merged</HeaderCell>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedData.map((pr) => {
                const prKey = `${pr.repo}#${pr.number}`
                const isExcluded = excludedPRs.has(prKey)
                return (
                <tr key={prKey} className={
                  isExcluded
                    ? 'bg-gray-100 dark:bg-gray-800/50 opacity-50'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }>
                  {/* Exclude checkbox */}
                  <td className="px-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={isExcluded}
                      onChange={() => togglePRExclusion(prKey)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500 cursor-pointer accent-red-500"
                    />
                  </td>
                  {/* PR: Repo + Number (with title tooltip) */}
                  <td className="px-3 py-3 text-sm">
                    <div className="text-gray-500 dark:text-gray-400 text-xs">{pr.repo}</div>
                    <Tooltip content={pr.title}>
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={isExcluded
                          ? 'text-gray-400 dark:text-gray-500 line-through font-medium'
                          : 'text-blue-600 dark:text-blue-400 hover:underline font-medium'
                        }
                      >
                        #{pr.number}
                      </a>
                    </Tooltip>
                  </td>
                  
                  {/* Author */}
                  <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {pr.author}
                  </td>
                  
                  {/* Size: Total +/- */}
                  <td className="px-3 py-3 text-sm whitespace-nowrap">
                    <span className="text-green-600 dark:text-green-400">+{pr.totalAdditions}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-red-600 dark:text-red-400">-{pr.totalDeletions}</span>
                  </td>
                  
                  {/* Src changes */}
                  <td className="px-3 py-3 text-sm whitespace-nowrap">
                    <span className="text-green-600 dark:text-green-400">+{pr.prodAdditions}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-red-600 dark:text-red-400">-{pr.prodDeletions}</span>
                  </td>
                  
                  {/* Test changes */}
                  <td className="px-3 py-3 text-sm whitespace-nowrap">
                    <span className="text-green-600 dark:text-green-400">+{pr.testAdditions}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-red-600 dark:text-red-400">-{pr.testDeletions}</span>
                  </td>
                  
                  {/* Files */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                    {pr.filesChanged}
                  </td>
                  
                  {/* Churn: % + File count */}
                  <td className="px-3 py-3 text-sm">
                    <div className="text-gray-900 dark:text-gray-100">
                      {pr.churnPercentage !== undefined ? `${pr.churnPercentage}%` : '-'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {pr.fileChurnCount !== undefined && pr.fileChurnCount > 0 ? `${pr.fileChurnCount} files` : ''}
                    </div>
                  </td>
                  
                  {/* Review: Iterations + Comments */}
                  <td className="px-3 py-3 text-sm">
                    <div className="text-gray-900 dark:text-gray-100">
                      {pr.iterationCount} {pr.iterationCount === 1 ? 'iteration' : 'iterations'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {pr.totalComments > 0 ? `${pr.totalComments} comments` : 'no comments'}
                    </div>
                  </td>
                  
                  {/* First Response Time */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {pr.firstResponseTime !== null ? formatWorkingHours(pr.firstResponseTime) : '-'}
                  </td>
                  
                  {/* Close Time */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatWorkingHours(pr.closeTime)}
                  </td>
                  
                  {/* Quality Score */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-center font-medium">
                    <span className={
                      pr.qualityScore >= 75 ? 'text-green-600 dark:text-green-400' :
                      pr.qualityScore >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }>
                      {pr.qualityScore}
                    </span>
                  </td>
                  
                  {/* Merged Date */}
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {new Date(pr.mergedAt).toLocaleDateString()}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No PRs found matching your filters
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredAndSortedData.length} of {data.details.length} PRs
        {excludedPRs.size > 0 && (
          <span className="ml-2">
            ({excludedPRs.size} excluded from calculations —{' '}
            <button
              onClick={() => onExcludedPRsChange(new Set())}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              clear all
            </button>
            )
          </span>
        )}
      </div>
    </div>
  )
}
