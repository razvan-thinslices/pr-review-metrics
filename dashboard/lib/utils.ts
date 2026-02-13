import { MetricsData, TeamSummary, PRDetail, AuthorSummary, ReviewerSummary } from '@/types/metrics'

// Format working hours as decimal string
export function formatWorkingHours(hours: number | string | null | undefined): string {
  if (hours === null || hours === undefined) return 'N/A'
  const num = typeof hours === 'string' ? parseFloat(hours) : hours
  if (isNaN(num)) return 'N/A'
  return `${num.toFixed(1)} hrs`
}

// Format a number with optional decimal places
export function formatNumber(value: number | string | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined) return 'N/A'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'N/A'
  return decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString()
}

// Format percentage
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'N/A'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'N/A'
  return `${num.toFixed(1)}%`
}

// Calculate working hours between two timestamps (client-side fallback)
// Removes: 16 hours per night (6pm-10am) and full weekends
export function calculateWorkingHours(startISO: string | null | undefined, endISO: string | null | undefined): number {
  if (!startISO || !endISO) return 0
  
  const start = new Date(startISO)
  const end = new Date(endISO)
  
  if (end <= start) return 0
  
  const MS_PER_HOUR = 1000 * 60 * 60
  const totalCalendarHours = (end.getTime() - start.getTime()) / MS_PER_HOUR
  
  let hoursToRemove = 0
  
  const currentDay = new Date(start)
  currentDay.setHours(0, 0, 0, 0)
  
  while (currentDay < end) {
    const dayOfWeek = currentDay.getDay()
    const dayStart = new Date(currentDay)
    const dayEnd = new Date(currentDay)
    dayEnd.setDate(dayEnd.getDate() + 1)
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const overlapStart = Math.max(start.getTime(), dayStart.getTime())
      const overlapEnd = Math.min(end.getTime(), dayEnd.getTime())
      if (overlapEnd > overlapStart) {
        hoursToRemove += (overlapEnd - overlapStart) / MS_PER_HOUR
      }
    } else {
      const eveningStart = new Date(currentDay)
      eveningStart.setHours(18, 0, 0, 0)
      const eveningEnd = new Date(dayEnd)
      
      const eveningOverlapStart = Math.max(start.getTime(), eveningStart.getTime())
      const eveningOverlapEnd = Math.min(end.getTime(), eveningEnd.getTime())
      if (eveningOverlapEnd > eveningOverlapStart) {
        hoursToRemove += (eveningOverlapEnd - eveningOverlapStart) / MS_PER_HOUR
      }
      
      const morningStart = new Date(dayStart)
      const morningEnd = new Date(currentDay)
      morningEnd.setHours(10, 0, 0, 0)
      
      const morningOverlapStart = Math.max(start.getTime(), morningStart.getTime())
      const morningOverlapEnd = Math.min(end.getTime(), morningEnd.getTime())
      if (morningOverlapEnd > morningOverlapStart) {
        hoursToRemove += (morningOverlapEnd - morningOverlapStart) / MS_PER_HOUR
      }
    }
    
    currentDay.setDate(currentDay.getDate() + 1)
  }
  
  return Math.max(0, totalCalendarHours - hoursToRemove)
}

// Calculate team summary from data (fallback for old data files)
export function computeTeamSummaryFallback(data: MetricsData): TeamSummary {
  const validPRs = data.details.filter(p => !p.error)
  
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0
  const median = (arr: number[]) => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  
  const weightedAvg = (items: ReviewerSummary[], valueField: keyof ReviewerSummary, weightField: keyof ReviewerSummary): number => {
    let totalWeight = 0
    let weightedSum = 0
    for (const item of items) {
      const value = parseFloat(String(item[valueField])) || 0
      const weight = (item[weightField] as number) || 0
      weightedSum += value * weight
      totalWeight += weight
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }
  
  const totalPRs = validPRs.length
  const prSizes = validPRs.map(p => p.totalAdditions + p.totalDeletions)
  const prodLines = validPRs.map(p => p.prodAdditions + p.prodDeletions)
  const testLines = validPRs.map(p => p.testAdditions + p.testDeletions)
  const iterations = validPRs.map(p => p.iterationCount)
  
  // Compute working hours to close from raw timestamps
  const workingHoursCloseTimes = validPRs
    .map(p => calculateWorkingHours(p.createdAt, p.mergedAt))
    .filter(h => h > 0)
  
  const churnPercentages = validPRs
    .filter(p => p.churnPercentage !== undefined)
    .map(p => p.churnPercentage!)
  
  const fileChurnCounts = validPRs
    .filter(p => p.fileChurnCount !== undefined)
    .map(p => p.fileChurnCount!)
  
  const commitCounts = validPRs.map(p => p.commitCount || 1)
  
  // Compute response times from firstResponseAt
  const allResponseTimes: number[] = validPRs
    .filter(p => p.firstResponseAt)
    .map(p => calculateWorkingHours(p.createdAt, p.firstResponseAt!))
    .filter(h => h >= 0)
  
  let totalReviews = 0
  let totalApprovals = 0
  let totalNoCommentApprovals = 0
  let totalInlineComments = 0
  
  for (const pr of validPRs) {
    for (const review of pr.reviews) {
      totalReviews++
      totalInlineComments += review.inlineCommentCount
      
      if (review.state === 'APPROVED') {
        totalApprovals++
        if (!review.hasComments) {
          totalNoCommentApprovals++
        }
      }
    }
  }
  
  return {
    authored: {
      totalPRs,
      totalDevelopers: data.authorSummary.length,
      avgPrSize: Math.round(avg(prSizes)),
      avgProdLines: Math.round(avg(prodLines)),
      avgTestLines: Math.round(avg(testLines)),
      avgCloseTime: workingHoursCloseTimes.length > 0 ? parseFloat(avg(workingHoursCloseTimes).toFixed(2)) : null,
      avgIterations: parseFloat(avg(iterations).toFixed(2)),
      avgChurnPct: churnPercentages.length > 0 ? parseFloat(avg(churnPercentages).toFixed(1)) : 0,
      avgFileChurn: fileChurnCounts.length > 0 ? parseFloat(avg(fileChurnCounts).toFixed(1)) : 0,
      avgCommitsPerPr: parseFloat(avg(commitCounts).toFixed(2))
    },
    reviewed: {
      totalReviews,
      totalReviewers: data.summary.length,
      avgPrSizeReviewed: Math.round(weightedAvg(data.summary, 'avgPrSizeReviewed', 'prsReviewedCount')),
      avgProdLinesReviewed: Math.round(weightedAvg(data.summary, 'avgPrProdLinesReviewed', 'prsReviewedCount')),
      avgTestLinesReviewed: Math.round(weightedAvg(data.summary, 'avgPrTestLinesReviewed', 'prsReviewedCount')),
      medianResponseTime: allResponseTimes.length > 0 ? parseFloat(median(allResponseTimes)!.toFixed(2)) : null,
      overallNoCommentPct: totalApprovals > 0 ? parseFloat((totalNoCommentApprovals / totalApprovals * 100).toFixed(1)) : 0,
      avgInlineComments: totalReviews > 0 ? parseFloat((totalInlineComments / totalReviews).toFixed(2)) : 0,
      avgIterationsPerPr: parseFloat(avg(iterations).toFixed(2))
    }
  }
}

// Get team summary (use provided or compute fallback)
export function getTeamSummary(data: MetricsData): TeamSummary {
  return data.teamSummary || computeTeamSummaryFallback(data)
}

// Find most active developer (PRs authored + reviews done)
export function findMostActiveDeveloper(data: MetricsData): { name: string; activity: number } | null {
  const activityMap = new Map<string, number>()
  
  for (const author of data.authorSummary) {
    activityMap.set(author.author, (activityMap.get(author.author) || 0) + author.prsAuthored)
  }
  
  for (const reviewer of data.summary) {
    activityMap.set(reviewer.reviewer, (activityMap.get(reviewer.reviewer) || 0) + reviewer.totalReviews)
  }
  
  let maxActivity = 0
  let mostActive: string | null = null
  
  for (const [name, activity] of activityMap) {
    if (activity > maxActivity) {
      maxActivity = activity
      mostActive = name
    }
  }
  
  return mostActive ? { name: mostActive, activity: maxActivity } : null
}

// Find developer with fastest PR velocity (lowest avg working hours to close)
export function findFastestVelocity(data: MetricsData): { name: string; hours: number } | null {
  const validPRs = data.details.filter(p => !p.error)
  
  // Group PRs by author and compute working hours close time
  const authorStats = new Map<string, number[]>()
  
  for (const pr of validPRs) {
    if (!authorStats.has(pr.author)) {
      authorStats.set(pr.author, [])
    }
    const workingHours = calculateWorkingHours(pr.createdAt, pr.mergedAt)
    if (workingHours > 0) {
      authorStats.get(pr.author)!.push(workingHours)
    }
  }
  
  let fastest: { name: string; hours: number } | null = null
  
  for (const [author, hours] of authorStats) {
    if (hours.length >= 2) { // minimum 2 PRs
      const avgHours = hours.reduce((a, b) => a + b, 0) / hours.length
      if (!fastest || avgHours < fastest.hours) {
        fastest = { name: author, hours: avgHours }
      }
    }
  }
  
  return fastest
}

// Find most responsive reviewer (lowest median working hours response)
export function findMostResponsiveReviewer(data: MetricsData): { name: string; hours: number } | null {
  const validPRs = data.details.filter(p => !p.error)
  
  // Group response times by reviewer using firstActivityAt
  const reviewerStats = new Map<string, number[]>()
  
  for (const pr of validPRs) {
    for (const review of pr.reviews) {
      if (review.firstActivityAt) {
        if (!reviewerStats.has(review.reviewer)) {
          reviewerStats.set(review.reviewer, [])
        }
        const workingHours = calculateWorkingHours(pr.createdAt, review.firstActivityAt)
        if (workingHours >= 0) {
          reviewerStats.get(review.reviewer)!.push(workingHours)
        }
      }
    }
  }
  
  let mostResponsive: { name: string; hours: number } | null = null
  
  for (const [reviewer, times] of reviewerStats) {
    if (times.length >= 2) { // minimum 2 reviews
      const sorted = [...times].sort((a, b) => a - b)
      const medianHours = sorted[Math.floor(sorted.length / 2)]
      if (!mostResponsive || medianHours < mostResponsive.hours) {
        mostResponsive = { name: reviewer, hours: medianHours }
      }
    }
  }
  
  return mostResponsive
}

// Calculate average churn rate across all PRs
export function calculateAvgChurnRate(data: MetricsData): number {
  const validPRs = data.details.filter(p => !p.error && p.churnPercentage !== undefined)
  if (validPRs.length === 0) return 0
  
  const sum = validPRs.reduce((acc, pr) => acc + (pr.churnPercentage || 0), 0)
  return parseFloat((sum / validPRs.length).toFixed(1))
}

// Calculate quality score for a developer (0-100)
// Weights: source size (35%), close time (30%), iterations (20%), churn (15%)
// Size uses source (non-test) lines and files only — test code is excluded.
export function calculateQualityScore(
  dev: {
    avgSrcSize: number            // avg source (non-test) lines changed per PR
    avgSrcFiles: number           // avg source (non-test) files changed per PR
    avgIterations: number
    avgWorkingHoursToClose: number | null
    churnPct: number
  },
  teamAvg: TeamSummary['authored']
): number {
  // 1. Source size score (35%): smaller source PRs are better — average of lines + files sub-scores
  //    Source lines: <=100 = 100, >=400 = 0, linear between
  const linesScore = Math.max(0, Math.min(100, 100 * (1 - (dev.avgSrcSize - 100) / 300)))
  //    Source files: <=4 = 100, >=10 = 0, linear between
  const filesScore = Math.max(0, Math.min(100, 100 * (1 - (dev.avgSrcFiles - 4) / 6)))
  const sizeScore = (linesScore + filesScore) / 2
  
  // 2. Close time score (30%): linear from 2h (100) to 8h (0)
  const closeTimeScore = dev.avgWorkingHoursToClose !== null
    ? Math.max(0, Math.min(100, 100 * (1 - (dev.avgWorkingHoursToClose - 2) / 6)))
    : 50 // default if no data
  
  // 3. Iteration score (20%): fewer iterations is better (1 = perfect, 4+ = 0)
  const iterationScore = Math.max(0, Math.min(100, 100 * (1 - Math.max(0, dev.avgIterations - 1) / 3)))
  
  // 4. Churn score (15%): less churn is better (50% churn = 0 score)
  const churnScore = Math.max(0, 100 * (1 - dev.churnPct / 50))
  
  return Math.round(
    sizeScore * 0.35 +
    closeTimeScore * 0.30 +
    iterationScore * 0.20 +
    churnScore * 0.15
  )
}

// Find top quality developer
export function findTopQualityScore(data: MetricsData): { name: string; score: number } | null {
  const teamSummary = getTeamSummary(data)
  const validPRs = data.details.filter(p => !p.error)
  
  // Group PRs by author
  const authorPRs = new Map<string, PRDetail[]>()
  for (const pr of validPRs) {
    if (!authorPRs.has(pr.author)) {
      authorPRs.set(pr.author, [])
    }
    authorPRs.get(pr.author)!.push(pr)
  }
  
  let topDev: { name: string; score: number } | null = null
  
  for (const [author, prs] of authorPRs) {
    if (prs.length < 2) continue // minimum 2 PRs
    
    // Compute stats from raw PR data (source lines/files only for size score)
    const totalSrcSize = prs.reduce((sum, p) => sum + p.prodAdditions + p.prodDeletions, 0)
    
    const avgSrcSize = totalSrcSize / prs.length
    const avgSrcFiles = prs.reduce((sum, p) => sum + p.prodFilesChanged, 0) / prs.length
    const avgIterations = prs.reduce((sum, p) => sum + p.iterationCount, 0) / prs.length
    
    const workingHoursToClose = prs
      .map(p => calculateWorkingHours(p.createdAt, p.mergedAt))
      .filter(h => h > 0)
    const avgWorkingHoursToClose = workingHoursToClose.length > 0
      ? workingHoursToClose.reduce((a, b) => a + b, 0) / workingHoursToClose.length
      : null
    
    const churnPcts = prs.filter(p => p.churnPercentage !== undefined).map(p => p.churnPercentage!)
    const churnPct = churnPcts.length > 0 ? churnPcts.reduce((a, b) => a + b, 0) / churnPcts.length : 0
    
    const score = calculateQualityScore(
      { avgSrcSize, avgSrcFiles, avgIterations, avgWorkingHoursToClose, churnPct },
      teamSummary.authored
    )
    
    if (!topDev || score > topDev.score) {
      topDev = { name: author, score }
    }
  }
  
  return topDev
}

// Recompute team stats for a filtered repo
export function computeTeamStatsForRepo(data: MetricsData, repo: string): TeamSummary {
  const filteredPRs = data.details.filter(p => !p.error && p.repo === repo)
  
  if (filteredPRs.length === 0) {
    return getTeamSummary(data) // fallback to full stats
  }
  
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0
  const median = (arr: number[]) => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  
  const totalPRs = filteredPRs.length
  const prSizes = filteredPRs.map(p => p.totalAdditions + p.totalDeletions)
  const prodLines = filteredPRs.map(p => p.prodAdditions + p.prodDeletions)
  const testLines = filteredPRs.map(p => p.testAdditions + p.testDeletions)
  const iterations = filteredPRs.map(p => p.iterationCount)
  
  // Compute working hours to close from raw timestamps
  const workingHoursCloseTimes = filteredPRs
    .map(p => calculateWorkingHours(p.createdAt, p.mergedAt))
    .filter(h => h > 0)
  
  const churnPercentages = filteredPRs
    .filter(p => p.churnPercentage !== undefined)
    .map(p => p.churnPercentage!)
  
  const fileChurnCounts = filteredPRs
    .filter(p => p.fileChurnCount !== undefined)
    .map(p => p.fileChurnCount!)
  
  const commitCounts = filteredPRs.map(p => p.commitCount || 1)
  
  // Get unique developers
  const authors = new Set(filteredPRs.map(p => p.author))
  const reviewers = new Set<string>()
  
  // Compute response times from firstResponseAt
  const allResponseTimes: number[] = filteredPRs
    .filter(p => p.firstResponseAt)
    .map(p => calculateWorkingHours(p.createdAt, p.firstResponseAt!))
    .filter(h => h >= 0)
  
  let totalReviews = 0
  let totalApprovals = 0
  let totalNoCommentApprovals = 0
  let totalInlineComments = 0
  
  for (const pr of filteredPRs) {
    for (const review of pr.reviews) {
      totalReviews++
      reviewers.add(review.reviewer)
      totalInlineComments += review.inlineCommentCount
      
      if (review.state === 'APPROVED') {
        totalApprovals++
        if (!review.hasComments) {
          totalNoCommentApprovals++
        }
      }
    }
  }
  
  // Compute reviewer stats for the filtered repo
  const reviewerStatsMap = new Map<string, { prSizes: number[], prodLines: number[], testLines: number[] }>()
  
  for (const pr of filteredPRs) {
    const prSize = pr.totalAdditions + pr.totalDeletions
    const prodSize = pr.prodAdditions + pr.prodDeletions
    const testSize = pr.testAdditions + pr.testDeletions
    
    const reviewersForPr = new Set(pr.reviews.map(r => r.reviewer))
    for (const reviewer of reviewersForPr) {
      if (!reviewerStatsMap.has(reviewer)) {
        reviewerStatsMap.set(reviewer, { prSizes: [], prodLines: [], testLines: [] })
      }
      const stats = reviewerStatsMap.get(reviewer)!
      stats.prSizes.push(prSize)
      stats.prodLines.push(prodSize)
      stats.testLines.push(testSize)
    }
  }
  
  // Weighted average for reviewer stats
  let totalWeight = 0
  let weightedSizeSum = 0
  let weightedProdSum = 0
  let weightedTestSum = 0
  
  for (const [, stats] of reviewerStatsMap) {
    const weight = stats.prSizes.length
    totalWeight += weight
    weightedSizeSum += avg(stats.prSizes) * weight
    weightedProdSum += avg(stats.prodLines) * weight
    weightedTestSum += avg(stats.testLines) * weight
  }
  
  return {
    authored: {
      totalPRs,
      totalDevelopers: authors.size,
      avgPrSize: Math.round(avg(prSizes)),
      avgProdLines: Math.round(avg(prodLines)),
      avgTestLines: Math.round(avg(testLines)),
      avgCloseTime: workingHoursCloseTimes.length > 0 ? parseFloat(avg(workingHoursCloseTimes).toFixed(2)) : null,
      avgIterations: parseFloat(avg(iterations).toFixed(2)),
      avgChurnPct: churnPercentages.length > 0 ? parseFloat(avg(churnPercentages).toFixed(1)) : 0,
      avgFileChurn: fileChurnCounts.length > 0 ? parseFloat(avg(fileChurnCounts).toFixed(1)) : 0,
      avgCommitsPerPr: parseFloat(avg(commitCounts).toFixed(2))
    },
    reviewed: {
      totalReviews,
      totalReviewers: reviewers.size,
      avgPrSizeReviewed: totalWeight > 0 ? Math.round(weightedSizeSum / totalWeight) : 0,
      avgProdLinesReviewed: totalWeight > 0 ? Math.round(weightedProdSum / totalWeight) : 0,
      avgTestLinesReviewed: totalWeight > 0 ? Math.round(weightedTestSum / totalWeight) : 0,
      medianResponseTime: allResponseTimes.length > 0 ? parseFloat(median(allResponseTimes)!.toFixed(2)) : null,
      overallNoCommentPct: totalApprovals > 0 ? parseFloat((totalNoCommentApprovals / totalApprovals * 100).toFixed(1)) : 0,
      avgInlineComments: totalReviews > 0 ? parseFloat((totalInlineComments / totalReviews).toFixed(2)) : 0,
      avgIterationsPerPr: parseFloat(avg(iterations).toFixed(2))
    }
  }
}
