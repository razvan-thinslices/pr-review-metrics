import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import config from './config.js'

const execAsync = promisify(exec)

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {}
  
  for (const arg of args) {
    const [key, value] = arg.split('=')
    if (key.startsWith('--')) {
      parsed[key.slice(2)] = value
    }
  }
  
  return parsed
}

// Get target month (defaults to previous month)
function getTargetMonth(monthArg) {
  if (monthArg) {
    if (!/^\d{4}-\d{2}$/.test(monthArg)) {
      throw new Error('Month must be in YYYY-MM format')
    }
    return monthArg
  }
  
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// Sleep utility for retries
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Calculate working hours between two timestamps
// Removes: 16 hours per night (6pm-10am) and full weekends (48h Sat+Sun)
function calculateWorkingHours(startISO, endISO) {
  const start = new Date(startISO)
  const end = new Date(endISO)
  
  if (end <= start) return 0
  
  const MS_PER_HOUR = 1000 * 60 * 60
  const totalCalendarHours = (end - start) / MS_PER_HOUR
  
  let hoursToRemove = 0
  
  // Walk day by day
  const currentDay = new Date(start)
  currentDay.setHours(0, 0, 0, 0) // Start of the day
  
  while (currentDay < end) {
    const dayOfWeek = currentDay.getDay() // 0=Sun, 6=Sat
    const dayStart = new Date(currentDay)
    const dayEnd = new Date(currentDay)
    dayEnd.setDate(dayEnd.getDate() + 1)
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend day: remove all overlapping hours
      const overlapStart = Math.max(start.getTime(), dayStart.getTime())
      const overlapEnd = Math.min(end.getTime(), dayEnd.getTime())
      if (overlapEnd > overlapStart) {
        hoursToRemove += (overlapEnd - overlapStart) / MS_PER_HOUR
      }
    } else {
      // Weekday: remove night hours (6pm to 10am next day = 16 hours)
      // Evening: 6pm (18:00) to midnight
      const eveningStart = new Date(currentDay)
      eveningStart.setHours(18, 0, 0, 0)
      const eveningEnd = new Date(dayEnd)
      
      const eveningOverlapStart = Math.max(start.getTime(), eveningStart.getTime())
      const eveningOverlapEnd = Math.min(end.getTime(), eveningEnd.getTime())
      if (eveningOverlapEnd > eveningOverlapStart) {
        hoursToRemove += (eveningOverlapEnd - eveningOverlapStart) / MS_PER_HOUR
      }
      
      // Morning: midnight to 10am
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

// Execute gh CLI command with retry logic
async function ghApiWithRetry(endpoint, paginate = false) {
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const paginateFlag = paginate ? '--paginate' : ''
      const { stdout } = await execAsync(`gh api ${paginateFlag} "${endpoint}"`, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
      })
      return JSON.parse(stdout)
    } catch (error) {
      const isLastAttempt = attempt === config.maxRetries - 1
      
      if (isLastAttempt) {
        console.error(`❌ Failed after ${config.maxRetries} attempts: ${endpoint}`)
        throw error
      }
      
      const delayMs = config.retryDelayMs * Math.pow(2, attempt)
      console.warn(`⚠️  Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`)
      await sleep(delayMs)
    }
  }
}

// Check GitHub API rate limit
async function checkRateLimit() {
  try {
    const data = await ghApiWithRetry('rate_limit')
    const remaining = data.resources.core.remaining
    const resetTime = new Date(data.resources.core.reset * 1000)
    
    console.log(`📊 API Rate Limit: ${remaining} calls remaining (resets at ${resetTime.toLocaleTimeString()})`)
    
    if (remaining < config.rateLimitWarningThreshold) {
      console.warn(`⚠️  Low API calls remaining: ${remaining}`)
    }
    
    return remaining
  } catch (error) {
    console.warn('⚠️  Could not check rate limit')
    return null
  }
}

// Fetch commits for a PR with detailed file information
async function fetchPRCommits(org, repo, prNumber) {
  try {
    const commits = await ghApiWithRetry(
      `repos/${org}/${repo}/pulls/${prNumber}/commits`,
      true
    )
    
    const detailed = []
    for (const commit of commits) {
      try {
        const detail = await ghApiWithRetry(
          `repos/${org}/${repo}/commits/${commit.sha}`
        )
        detailed.push({
          sha: commit.sha,
          date: commit.commit.author.date,
          files: (detail.files || []).map(f => ({
            filename: f.filename,
            additions: f.additions || 0,
            deletions: f.deletions || 0,
            status: f.status
          }))
        })
      } catch (error) {
        console.warn(`      Warning: Could not fetch commit details for ${commit.sha.slice(0, 7)}`)
      }
    }
    return detailed
  } catch (error) {
    console.warn(`      Warning: Could not fetch commits for PR #${prNumber}`)
    return []
  }
}

// Calculate churn metrics from commits
// Churn = lines added to files that were already modified in previous commits
function calculateChurnMetrics(commits) {
  if (!commits || commits.length <= 1) {
    return { churnPercentage: 0, fileChurnCount: 0 }
  }
  
  const fileSeenInCommit = new Map() // filename -> Set<commitIndex>
  let totalAdditions = 0
  let reWorkAdditions = 0
  
  commits.forEach((commit, idx) => {
    for (const file of commit.files) {
      totalAdditions += file.additions
      
      if (!fileSeenInCommit.has(file.filename)) {
        fileSeenInCommit.set(file.filename, new Set())
      }
      
      const seen = fileSeenInCommit.get(file.filename)
      if (seen.size > 0) {
        // File was touched in a previous commit - this is re-work
        reWorkAdditions += file.additions
      }
      seen.add(idx)
    }
  })
  
  const fileChurnCount = Array.from(fileSeenInCommit.values())
    .filter(s => s.size > 1).length
  
  return {
    churnPercentage: totalAdditions > 0
      ? parseFloat((reWorkAdditions / totalAdditions * 100).toFixed(1))
      : 0,
    fileChurnCount
  }
}

// Check if file is a test file
function isTestFile(filename) {
  return config.testFilePatterns.some(pattern => {
    if (pattern.endsWith('/')) {
      return filename.includes(pattern)
    }
    return filename.includes(pattern)
  })
}

// Classify file changes as test or production
function classifyFileChanges(files) {
  const result = {
    totalAdditions: 0,
    totalDeletions: 0,
    prodAdditions: 0,
    prodDeletions: 0,
    testAdditions: 0,
    testDeletions: 0,
    filesChanged: files.length,
    testFilesChanged: 0,
    prodFilesChanged: 0
  }
  
  for (const file of files) {
    result.totalAdditions += file.additions
    result.totalDeletions += file.deletions
    
    if (isTestFile(file.filename)) {
      result.testAdditions += file.additions
      result.testDeletions += file.deletions
      result.testFilesChanged++
    } else {
      result.prodAdditions += file.additions
      result.prodDeletions += file.deletions
      result.prodFilesChanged++
    }
  }
  
  return result
}

// Fetch PRs merged in target month
async function fetchMergedPRs(org, repo, targetMonth) {
  console.log(`📥 Fetching PRs for ${repo}...`)
  
  const [year, month] = targetMonth.split('-')
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)
  
  const prs = await ghApiWithRetry(
    `repos/${org}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
    true
  )
  
  // Filter for PRs merged in target month
  const mergedPRs = prs.filter(pr => {
    if (!pr.merged_at) return false
    // Only include PRs targeting main branch
    if (pr.base?.ref !== 'main') return false
    const mergedDate = new Date(pr.merged_at)
    return mergedDate >= startDate && mergedDate <= endDate
  })
  
  console.log(`   Found ${mergedPRs.length} merged PRs in ${targetMonth}`)
  
  return mergedPRs.map(pr => ({
    repo,
    number: pr.number,
    title: pr.title,
    author: pr.user.login,
    createdAt: pr.created_at,
    mergedAt: pr.merged_at,
    url: pr.html_url
  }))
}

// Process a single PR to gather all metrics
async function processPR(org, pr, index, total) {
  console.log(`   [${pr.repo}] Processing PR #${pr.number} (${index}/${total}): ${pr.title}`)
  
  try {
    // Fetch PR files
    const files = await ghApiWithRetry(`repos/${org}/${pr.repo}/pulls/${pr.number}/files`, true)
    const fileMetrics = classifyFileChanges(files)
    
    // Fetch reviews
    const reviews = await ghApiWithRetry(`repos/${org}/${pr.repo}/pulls/${pr.number}/reviews`)
    
    // Fetch timeline (we keep this for potential future use but don't use requestedAt anymore)
    const timeline = await ghApiWithRetry(`repos/${org}/${pr.repo}/issues/${pr.number}/timeline`, true)
    
    // Fetch PR conversation comments (general comments on the PR thread)
    // These are separate from inline review comments and review body comments
    let prConversationComments = []
    try {
      prConversationComments = await ghApiWithRetry(
        `repos/${org}/${pr.repo}/issues/${pr.number}/comments`,
        true
      )
    } catch (error) {
      console.warn(`      ⚠️  Could not fetch conversation comments for PR #${pr.number}`)
    }
    
    // Build a map of users to their conversation comment timestamps
    const userConversationCommentTimestamps = new Map()
    for (const comment of prConversationComments) {
      const user = comment.user?.login
      if (user) {
        if (!userConversationCommentTimestamps.has(user)) {
          userConversationCommentTimestamps.set(user, [])
        }
        userConversationCommentTimestamps.get(user).push(comment.created_at)
      }
    }
    
    // Track all response timestamps for firstResponseAt calculation (excluding PR author)
    const allResponseTimestamps = []
    
    // Add conversation comment timestamps from non-authors
    for (const [user, timestamps] of userConversationCommentTimestamps) {
      if (user !== pr.author) {
        allResponseTimestamps.push(...timestamps)
      }
    }
    
    // Process each review
    const processedReviews = []
    for (const review of reviews) {
      // Fetch inline comments for this review
      let inlineComments = []
      try {
        inlineComments = await ghApiWithRetry(
          `repos/${org}/${pr.repo}/pulls/${pr.number}/reviews/${review.id}/comments`
        )
      } catch (error) {
        console.warn(`      ⚠️  Could not fetch comments for review ${review.id}`)
      }
      
      const reviewer = review.user.login
      const submittedAt = review.submitted_at
      
      // Collect all activity timestamps for this reviewer to find their firstActivityAt
      const reviewerActivityTimestamps = []
      
      // Add review submission time
      if (submittedAt) {
        reviewerActivityTimestamps.push(submittedAt)
      }
      
      // Add inline comment timestamps
      for (const inlineComment of inlineComments) {
        if (inlineComment.created_at) {
          reviewerActivityTimestamps.push(inlineComment.created_at)
        }
      }
      
      // Add conversation comment timestamps for this reviewer
      const conversationTimestamps = userConversationCommentTimestamps.get(reviewer) || []
      reviewerActivityTimestamps.push(...conversationTimestamps)
      
      // Find the earliest activity timestamp for this reviewer
      const firstActivityAt = reviewerActivityTimestamps.length > 0
        ? reviewerActivityTimestamps.sort((a, b) => new Date(a) - new Date(b))[0]
        : submittedAt
      
      // Add to global response timestamps if not the PR author
      if (reviewer !== pr.author) {
        allResponseTimestamps.push(...reviewerActivityTimestamps)
      }
      
      // Check for comments: review body, inline comments, OR conversation comments
      const hasReviewBodyComment = review.body && review.body.trim().length > 0
      const hasInlineComments = inlineComments.length > 0
      const hasConversationComments = conversationTimestamps.length > 0
      const hasComments = hasReviewBodyComment || hasInlineComments || hasConversationComments
      
      processedReviews.push({
        reviewer,
        state: review.state,
        submittedAt,
        firstActivityAt,
        hasComments,
        inlineCommentCount: inlineComments.length,
        conversationCommentCount: conversationTimestamps.length,
        body: review.body || ''
      })
    }
    
    // Calculate firstResponseAt: earliest activity by anyone other than the PR author
    const firstResponseAt = allResponseTimestamps.length > 0
      ? allResponseTimestamps.sort((a, b) => new Date(a) - new Date(b))[0]
      : null
    
    // Calculate iteration count (total review submissions)
    const iterationCount = processedReviews.length
    
    // Fetch commits for churn analysis
    const commits = await fetchPRCommits(org, pr.repo, pr.number)
    const churnMetrics = calculateChurnMetrics(commits)
    
    return {
      ...pr,
      ...fileMetrics,
      iterationCount,
      reviews: processedReviews,
      // First response timestamp (for working hours calculation client-side)
      firstResponseAt,
      // Churn metrics
      commitCount: commits.length || 1,
      churnPercentage: churnMetrics.churnPercentage,
      fileChurnCount: churnMetrics.fileChurnCount
    }
  } catch (error) {
    console.error(`      ❌ Error processing PR #${pr.number}: ${error.message}`)
    return {
      ...pr,
      error: error.message,
      iterationCount: 0,
      reviews: []
    }
  }
}

// Process PRs with concurrency limit
async function processPRsWithConcurrency(org, prs) {
  const results = []
  const pool = []
  let index = 0
  
  for (const pr of prs) {
    index++
    const promise = processPR(org, pr, index, prs.length)
      .then(result => {
        results.push(result)
        return result
      })
    
    pool.push(promise)
    
    if (pool.length >= config.prConcurrency) {
      await Promise.race(pool)
      pool.splice(pool.findIndex(p => p === promise), 1)
    }
  }
  
  await Promise.all(pool)
  return results
}

// Calculate summary metrics per reviewer
function calculateReviewerSummary(prDetails) {
  const reviewerStats = new Map()
  
  for (const pr of prDetails) {
    if (pr.error) continue
    
    for (const review of pr.reviews) {
      const reviewer = review.reviewer
      
      if (!reviewerStats.has(reviewer)) {
        reviewerStats.set(reviewer, {
          reviewer,
          totalReviews: 0,
          approvals: 0,
          changesRequested: 0,
          commentOnlyReviews: 0,
          noCommentApprovals: 0,
          totalInlineComments: 0,
          totalConversationComments: 0,
          responseTimes: [],  // Working hours from PR open to first activity
          prSizesReviewed: [],
          prProdLinesReviewed: [],
          prTestLinesReviewed: [],
          iterationsPerPr: [],
          prsReviewed: new Set(),
          prsByRepo: {},
          reviewedPrCloseTimes: []  // Working hours from PR open to merge
        })
      }
      
      const stats = reviewerStats.get(reviewer)
      stats.totalReviews++
      
      if (review.state === 'APPROVED') {
        stats.approvals++
        if (!review.hasComments) {
          stats.noCommentApprovals++
        }
      } else if (review.state === 'CHANGES_REQUESTED') {
        stats.changesRequested++
      } else if (review.state === 'COMMENTED') {
        stats.commentOnlyReviews++
      }
      
      stats.totalInlineComments += review.inlineCommentCount
      stats.totalConversationComments += review.conversationCommentCount || 0
      
      // Calculate response time from PR open to reviewer's first activity
      if (review.firstActivityAt && pr.createdAt) {
        const responseHours = calculateWorkingHours(pr.createdAt, review.firstActivityAt)
        if (responseHours >= 0) {
          stats.responseTimes.push(responseHours)
        }
      }
      
      // Track PR-level metrics (only once per PR per reviewer)
      if (!stats.prsReviewed.has(pr.number)) {
        stats.prsReviewed.add(pr.number)
        stats.prSizesReviewed.push(pr.totalAdditions + pr.totalDeletions)
        stats.prProdLinesReviewed.push(pr.prodAdditions + pr.prodDeletions)
        stats.prTestLinesReviewed.push(pr.testAdditions + pr.testDeletions)
        stats.iterationsPerPr.push(pr.iterationCount)
        
        // Track close time for reviewed PRs (working hours)
        const closeTime = calculateWorkingHours(pr.createdAt, pr.mergedAt)
        stats.reviewedPrCloseTimes.push(closeTime)
        
        stats.prsByRepo[pr.repo] = (stats.prsByRepo[pr.repo] || 0) + 1
      }
    }
  }
  
  // Helper functions
  const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const median = arr => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  const percentile = (arr, p) => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * p)]
  }
  
  // Calculate final metrics
  const summary = []
  for (const [reviewer, stats] of reviewerStats) {
    const medianResponse = median(stats.responseTimes)
    const p90Response = percentile(stats.responseTimes, 0.9)
    const fastestResponse = stats.responseTimes.length > 0 ? Math.min(...stats.responseTimes) : null
    
    const avgPrSize = avg(stats.prSizesReviewed)
    const avgProdLines = avg(stats.prProdLinesReviewed)
    const avgTestLines = avg(stats.prTestLinesReviewed)
    const avgIterations = avg(stats.iterationsPerPr)
    
    const prsWithMultipleRounds = stats.iterationsPerPr.filter(i => i > 1).length
    
    const noCommentApprovalPct = stats.approvals > 0
      ? (stats.noCommentApprovals / stats.approvals * 100).toFixed(1)
      : 0
    
    const avgReviewedPrCloseTime = avg(stats.reviewedPrCloseTimes) || null
    
    summary.push({
      reviewer,
      totalReviews: stats.totalReviews,
      prsReviewedCount: stats.prsReviewed.size,
      approvals: stats.approvals,
      changesRequested: stats.changesRequested,
      commentOnlyReviews: stats.commentOnlyReviews,
      noCommentApprovals: stats.noCommentApprovals,
      noCommentApprovalPct: parseFloat(noCommentApprovalPct),
      totalInlineComments: stats.totalInlineComments,
      totalConversationComments: stats.totalConversationComments,
      // Response times are working hours from PR open to first activity
      medianResponseHours: medianResponse ? medianResponse.toFixed(2) : null,
      p90ResponseHours: p90Response ? p90Response.toFixed(2) : null,
      fastestResponseHours: fastestResponse ? fastestResponse.toFixed(2) : null,
      avgPrSizeReviewed: Math.round(avgPrSize),
      avgPrProdLinesReviewed: Math.round(avgProdLines),
      avgPrTestLinesReviewed: Math.round(avgTestLines),
      avgIterationsPerPr: avgIterations.toFixed(2),
      avgReviewedPrCloseTime: avgReviewedPrCloseTime ? avgReviewedPrCloseTime.toFixed(2) : null,
      prsWithMultipleRounds,
      ...stats.prsByRepo
    })
  }
  
  return summary.sort((a, b) => b.totalReviews - a.totalReviews)
}

// Calculate summary metrics per author
function calculateAuthorSummary(prDetails) {
  const authorStats = new Map()
  
  for (const pr of prDetails) {
    if (pr.error) continue
    
    const author = pr.author
    if (!authorStats.has(author)) {
      authorStats.set(author, {
        author,
        prsAuthored: 0,
        prSizes: [],
        prodLines: [],
        testLines: [],
        reviewTimes: [],    // Calendar hours to first response
        closeTimes: [],     // Calendar hours to merge
        reviewCounts: [],   // Number of reviews per PR
        iterations: [],
        commitCounts: [],
        churnPercentages: [],
        fileChurnCounts: [],
        prsByRepo: {}
      })
    }
    
    const stats = authorStats.get(author)
    stats.prsAuthored++
    stats.prSizes.push(pr.totalAdditions + pr.totalDeletions)
    stats.prodLines.push(pr.prodAdditions + pr.prodDeletions)
    stats.testLines.push(pr.testAdditions + pr.testDeletions)
    stats.reviewCounts.push(pr.reviews.length)
    stats.iterations.push(pr.iterationCount)
    stats.commitCounts.push(pr.commitCount || 1)
    stats.churnPercentages.push(pr.churnPercentage || 0)
    stats.fileChurnCounts.push(pr.fileChurnCount || 0)
    
    // Time to first response (working hours)
    if (pr.firstResponseAt) {
      const firstResponseTime = calculateWorkingHours(pr.createdAt, pr.firstResponseAt)
      if (firstResponseTime >= 0) {
        stats.reviewTimes.push(firstResponseTime)
      }
    }
    
    // Time to merge (close time) - working hours
    const closeTime = calculateWorkingHours(pr.createdAt, pr.mergedAt)
    stats.closeTimes.push(closeTime)
    
    // Per-repo count
    stats.prsByRepo[pr.repo] = (stats.prsByRepo[pr.repo] || 0) + 1
  }
  
  // Helper function for averages
  const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  
  // Calculate averages
  const summary = []
  for (const [author, stats] of authorStats) {
    const avgSize = avg(stats.prSizes)
    const avgProdLines = avg(stats.prodLines)
    const avgTestLines = avg(stats.testLines)
    const avgReviewTime = stats.reviewTimes.length > 0 ? avg(stats.reviewTimes) : null
    const avgCloseTime = avg(stats.closeTimes)
    const avgReviewCount = avg(stats.reviewCounts)
    const avgIterations = avg(stats.iterations)
    const avgCommits = avg(stats.commitCounts)
    const avgChurnPct = avg(stats.churnPercentages)
    const avgFileChurn = avg(stats.fileChurnCounts)
    
    summary.push({
      author,
      prsAuthored: stats.prsAuthored,
      authoredPrAvgSize: Math.round(avgSize),
      authoredPrAvgProdLines: Math.round(avgProdLines),
      authoredPrAvgTestLines: Math.round(avgTestLines),
      authoredPrAvgReviewTime: avgReviewTime ? avgReviewTime.toFixed(2) : null,  // Working hours to first response
      authoredPrAvgCloseTime: avgCloseTime.toFixed(2),  // Working hours to merge
      authoredPrAvgReviewCount: avgReviewCount.toFixed(2),
      authoredPrAvgIterations: avgIterations.toFixed(2),
      authoredPrAvgCommits: avgCommits.toFixed(2),
      authoredPrAvgChurnPct: avgChurnPct.toFixed(1),
      authoredPrAvgFileChurn: avgFileChurn.toFixed(1),
      ...stats.prsByRepo
    })
  }
  
  return summary.sort((a, b) => b.prsAuthored - a.prsAuthored)
}

// Convert to CSV format
function generateCSV(summary) {
  if (summary.length === 0) return ''
  
  const headers = Object.keys(summary[0])
  const rows = summary.map(row => 
    headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
  )
  
  return [headers.join(','), ...rows].join('\n')
}

// Calculate team-level summary (totals and weighted averages)
function calculateTeamSummary(authorSummary, reviewerSummary, prDetails) {
  const validPRs = prDetails.filter(p => !p.error)
  
  // Helper functions
  const sum = arr => arr.reduce((a, b) => a + b, 0)
  const avg = arr => arr.length > 0 ? sum(arr) / arr.length : 0
  const median = arr => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  
  // Weighted average: weight each author's average by their PR count
  const weightedAvg = (items, valueField, weightField) => {
    let totalWeight = 0
    let weightedSum = 0
    for (const item of items) {
      const value = parseFloat(item[valueField]) || 0
      const weight = item[weightField] || 0
      weightedSum += value * weight
      totalWeight += weight
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }
  
  // Calculate authored stats from PRs directly (more accurate than averaging averages)
  const totalPRs = validPRs.length
  const prSizes = validPRs.map(p => p.totalAdditions + p.totalDeletions)
  const prodLines = validPRs.map(p => p.prodAdditions + p.prodDeletions)
  const testLines = validPRs.map(p => p.testAdditions + p.testDeletions)
  const iterations = validPRs.map(p => p.iterationCount)
  const closeTimes = validPRs.map(p => calculateWorkingHours(p.createdAt, p.mergedAt)).filter(h => h > 0)
  const churnPercentages = validPRs.filter(p => p.churnPercentage !== undefined).map(p => p.churnPercentage)
  const fileChurnCounts = validPRs.filter(p => p.fileChurnCount !== undefined).map(p => p.fileChurnCount)
  const commitCounts = validPRs.map(p => p.commitCount || 1)
  
  // Collect all response times from PRs with firstResponseAt (working hours)
  const allResponseTimes = validPRs
    .filter(p => p.firstResponseAt)
    .map(p => calculateWorkingHours(p.createdAt, p.firstResponseAt))
    .filter(t => t > 0)
  
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
      totalDevelopers: authorSummary.length,
      avgPrSize: Math.round(avg(prSizes)),
      avgProdLines: Math.round(avg(prodLines)),
      avgTestLines: Math.round(avg(testLines)),
      avgCloseTime: closeTimes.length > 0 ? parseFloat(avg(closeTimes).toFixed(2)) : null,  // Working hours
      avgIterations: parseFloat(avg(iterations).toFixed(2)),
      avgChurnPct: churnPercentages.length > 0 ? parseFloat(avg(churnPercentages).toFixed(1)) : 0,
      avgFileChurn: fileChurnCounts.length > 0 ? parseFloat(avg(fileChurnCounts).toFixed(1)) : 0,
      avgCommitsPerPr: parseFloat(avg(commitCounts).toFixed(2))
    },
    reviewed: {
      totalReviews,
      totalReviewers: reviewerSummary.length,
      avgPrSizeReviewed: Math.round(weightedAvg(reviewerSummary, 'avgPrSizeReviewed', 'prsReviewedCount')),
      avgProdLinesReviewed: Math.round(weightedAvg(reviewerSummary, 'avgPrProdLinesReviewed', 'prsReviewedCount')),
      avgTestLinesReviewed: Math.round(weightedAvg(reviewerSummary, 'avgPrTestLinesReviewed', 'prsReviewedCount')),
      medianResponseTime: allResponseTimes.length > 0 ? parseFloat(median(allResponseTimes).toFixed(2)) : null,  // Calendar hours
      overallNoCommentPct: totalApprovals > 0 ? parseFloat((totalNoCommentApprovals / totalApprovals * 100).toFixed(1)) : 0,
      avgInlineComments: totalReviews > 0 ? parseFloat((totalInlineComments / totalReviews).toFixed(2)) : 0,
      avgIterationsPerPr: parseFloat(avg(iterations).toFixed(2))
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 PR Review Metrics Collection\n')
  
  const args = parseArgs()
  const org = args.org || config.org
  const repos = args.repos ? args.repos.split(',') : config.repos
  const targetMonth = getTargetMonth(args.month)
  
  if (!org) {
    console.error('❌ Organization is required. Use --org=your-org')
    process.exit(1)
  }
  
  if (!repos || repos.length === 0) {
    console.error('❌ At least one repository is required. Use --repos=repo1,repo2')
    process.exit(1)
  }
  
  console.log(`📋 Configuration:`)
  console.log(`   Organization: ${org}`)
  console.log(`   Repositories: ${repos.join(', ')}`)
  console.log(`   Target Month: ${targetMonth}\n`)
  
  // Check rate limit
  await checkRateLimit()
  console.log()
  
  // Collect PRs from all repos
  const allPRs = []
  for (const repo of repos) {
    try {
      const prs = await fetchMergedPRs(org, repo, targetMonth)
      allPRs.push(...prs)
    } catch (error) {
      console.error(`❌ Error fetching PRs from ${repo}: ${error.message}`)
    }
  }
  
  if (allPRs.length === 0) {
    console.log('ℹ️  No PRs found for the specified month and repositories')
    process.exit(0)
  }
  
  console.log(`\n📊 Processing ${allPRs.length} total PRs...\n`)
  
  // Process all PRs with concurrency
  const prDetails = await processPRsWithConcurrency(org, allPRs)
  
  console.log(`\n✅ Processed ${prDetails.length} PRs\n`)
  
  // Calculate summary metrics
  console.log('📊 Calculating reviewer metrics...')
  const summary = calculateReviewerSummary(prDetails)
  
  console.log('📊 Calculating author metrics...')
  const authorSummary = calculateAuthorSummary(prDetails)
  
  console.log('📊 Calculating team summary...')
  const teamSummary = calculateTeamSummary(authorSummary, summary, prDetails)
  
  // Prepare output
  const outputData = {
    month: targetMonth,
    org,
    repos,
    generatedAt: new Date().toISOString(),
    summary,
    authorSummary,
    teamSummary,
    details: prDetails
  }
  
  // Ensure output directory exists
  await mkdir(config.outputDir, { recursive: true })
  
  // Write JSON output
  const jsonPath = join(config.outputDir, `pr-reviews-${targetMonth}.json`)
  await writeFile(jsonPath, JSON.stringify(outputData, null, 2))
  console.log(`✅ Written JSON to ${jsonPath}`)
  
  // Write CSV output for reviewers
  const csvPath = join(config.outputDir, `pr-reviews-${targetMonth}.csv`)
  const csv = generateCSV(summary)
  await writeFile(csvPath, csv)
  console.log(`✅ Written reviewer CSV to ${csvPath}`)
  
  // Write CSV output for authors
  const authorCsvPath = join(config.outputDir, `pr-authors-${targetMonth}.csv`)
  const authorCsv = generateCSV(authorSummary)
  await writeFile(authorCsvPath, authorCsv)
  console.log(`✅ Written author CSV to ${authorCsvPath}`)
  
  console.log(`\n🎉 Done! Processed ${prDetails.length} PRs, ${summary.length} reviewers, ${authorSummary.length} authors`)
  
  // Final rate limit check
  console.log()
  await checkRateLimit()
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
