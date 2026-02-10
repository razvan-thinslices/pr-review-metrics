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
    
    // Fetch timeline to get review request timestamps
    const timeline = await ghApiWithRetry(`repos/${org}/${pr.repo}/issues/${pr.number}/timeline`, true)
    
    // Extract review request events
    const reviewRequests = new Map()
    for (const event of timeline) {
      if (event.event === 'review_requested' && event.requested_reviewer) {
        const reviewer = event.requested_reviewer.login
        if (!reviewRequests.has(reviewer)) {
          reviewRequests.set(reviewer, event.created_at)
        }
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
      const requestedAt = reviewRequests.get(reviewer)
      const submittedAt = review.submitted_at
      
      let responseHours = null
      if (requestedAt && submittedAt) {
        const requestTime = new Date(requestedAt)
        const submitTime = new Date(submittedAt)
        responseHours = (submitTime - requestTime) / (1000 * 60 * 60)
      }
      
      const hasComments = (review.body && review.body.trim().length > 0) || inlineComments.length > 0
      
      processedReviews.push({
        reviewer,
        state: review.state,
        submittedAt,
        requestedAt,
        responseHours,
        hasComments,
        inlineCommentCount: inlineComments.length,
        body: review.body || ''
      })
    }
    
    // Calculate iteration count (total review submissions)
    const iterationCount = processedReviews.length
    
    return {
      ...pr,
      ...fileMetrics,
      iterationCount,
      reviews: processedReviews
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
          responseTimes: [],
          prSizesReviewed: [],
          prProdLinesReviewed: [],
          prTestLinesReviewed: [],
          iterationsPerPr: [],
          prsReviewed: new Set(),
          prsByRepo: {}
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
      
      if (review.responseHours !== null && review.responseHours >= 0) {
        stats.responseTimes.push(review.responseHours)
      }
      
      // Track PR-level metrics (only once per PR per reviewer)
      if (!stats.prsReviewed.has(pr.number)) {
        stats.prsReviewed.add(pr.number)
        stats.prSizesReviewed.push(pr.totalAdditions + pr.totalDeletions)
        stats.prProdLinesReviewed.push(pr.prodAdditions + pr.prodDeletions)
        stats.prTestLinesReviewed.push(pr.testAdditions + pr.testDeletions)
        stats.iterationsPerPr.push(pr.iterationCount)
        
        // Track close time for reviewed PRs
        const closeTime = (new Date(pr.mergedAt) - new Date(pr.createdAt)) / (1000 * 60 * 60)
        stats.reviewedPrCloseTimes = stats.reviewedPrCloseTimes || []
        stats.reviewedPrCloseTimes.push(closeTime)
        
        stats.prsByRepo[pr.repo] = (stats.prsByRepo[pr.repo] || 0) + 1
      }
    }
  }
  
  // Calculate final metrics
  const summary = []
  for (const [reviewer, stats] of reviewerStats) {
    const responseTimes = stats.responseTimes.sort((a, b) => a - b)
    const median = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length / 2)]
      : null
    const p90 = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.9)]
      : null
    const fastest = responseTimes.length > 0 ? responseTimes[0] : null
    
    const avgPrSize = stats.prSizesReviewed.length > 0
      ? stats.prSizesReviewed.reduce((a, b) => a + b, 0) / stats.prSizesReviewed.length
      : 0
    
    const avgProdLines = stats.prProdLinesReviewed.length > 0
      ? stats.prProdLinesReviewed.reduce((a, b) => a + b, 0) / stats.prProdLinesReviewed.length
      : 0
    
    const avgTestLines = stats.prTestLinesReviewed.length > 0
      ? stats.prTestLinesReviewed.reduce((a, b) => a + b, 0) / stats.prTestLinesReviewed.length
      : 0
    
    const avgIterations = stats.iterationsPerPr.length > 0
      ? stats.iterationsPerPr.reduce((a, b) => a + b, 0) / stats.iterationsPerPr.length
      : 0
    
    const prsWithMultipleRounds = stats.iterationsPerPr.filter(i => i > 1).length
    
    const noCommentApprovalPct = stats.approvals > 0
      ? (stats.noCommentApprovals / stats.approvals * 100).toFixed(1)
      : 0
    
    const avgReviewedPrCloseTime = stats.reviewedPrCloseTimes && stats.reviewedPrCloseTimes.length > 0
      ? stats.reviewedPrCloseTimes.reduce((a, b) => a + b, 0) / stats.reviewedPrCloseTimes.length
      : null
    
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
      medianResponseHours: median ? median.toFixed(2) : null,
      p90ResponseHours: p90 ? p90.toFixed(2) : null,
      fastestResponseHours: fastest ? fastest.toFixed(2) : null,
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
        reviewTimes: [],    // Time to first review
        closeTimes: [],     // Time to merge
        reviewCounts: [],   // Number of reviews per PR
        iterations: [],
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
    
    // Time to first review
    const sortedReviews = pr.reviews.sort((a, b) => 
      new Date(a.submittedAt) - new Date(b.submittedAt)
    )
    if (sortedReviews.length > 0) {
      const firstReviewTime = (new Date(sortedReviews[0].submittedAt) - new Date(pr.createdAt)) / (1000 * 60 * 60)
      if (firstReviewTime >= 0) {
        stats.reviewTimes.push(firstReviewTime)
      }
    }
    
    // Time to merge (close time)
    const closeTime = (new Date(pr.mergedAt) - new Date(pr.createdAt)) / (1000 * 60 * 60)
    stats.closeTimes.push(closeTime)
    
    // Per-repo count
    stats.prsByRepo[pr.repo] = (stats.prsByRepo[pr.repo] || 0) + 1
  }
  
  // Calculate averages
  const summary = []
  for (const [author, stats] of authorStats) {
    const avgSize = stats.prSizes.length > 0
      ? stats.prSizes.reduce((a, b) => a + b, 0) / stats.prSizes.length
      : 0
    
    const avgProdLines = stats.prodLines.length > 0
      ? stats.prodLines.reduce((a, b) => a + b, 0) / stats.prodLines.length
      : 0
    
    const avgTestLines = stats.testLines.length > 0
      ? stats.testLines.reduce((a, b) => a + b, 0) / stats.testLines.length
      : 0
    
    const avgReviewTime = stats.reviewTimes.length > 0
      ? stats.reviewTimes.reduce((a, b) => a + b, 0) / stats.reviewTimes.length
      : null
    
    const avgCloseTime = stats.closeTimes.length > 0
      ? stats.closeTimes.reduce((a, b) => a + b, 0) / stats.closeTimes.length
      : 0
    
    const avgReviewCount = stats.reviewCounts.length > 0
      ? stats.reviewCounts.reduce((a, b) => a + b, 0) / stats.reviewCounts.length
      : 0
    
    const avgIterations = stats.iterations.length > 0
      ? stats.iterations.reduce((a, b) => a + b, 0) / stats.iterations.length
      : 0
    
    summary.push({
      author,
      prsAuthored: stats.prsAuthored,
      authoredPrAvgSize: Math.round(avgSize),
      authoredPrAvgProdLines: Math.round(avgProdLines),
      authoredPrAvgTestLines: Math.round(avgTestLines),
      authoredPrAvgReviewTime: avgReviewTime ? avgReviewTime.toFixed(2) : null,
      authoredPrAvgCloseTime: avgCloseTime.toFixed(2),
      authoredPrAvgReviewCount: avgReviewCount.toFixed(2),
      authoredPrAvgIterations: avgIterations.toFixed(2),
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
  
  // Prepare output
  const outputData = {
    month: targetMonth,
    org,
    repos,
    generatedAt: new Date().toISOString(),
    summary,
    authorSummary,
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
