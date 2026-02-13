export interface Review {
  reviewer: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  submittedAt: string
  firstActivityAt?: string  // Earliest of: review submission, inline comment, or conversation comment
  hasComments: boolean
  inlineCommentCount: number
  conversationCommentCount: number
  body: string
}

export interface PRDetail {
  repo: string
  number: number
  title: string
  author: string
  createdAt: string
  mergedAt: string
  url: string
  totalAdditions: number
  totalDeletions: number
  prodAdditions: number
  prodDeletions: number
  testAdditions: number
  testDeletions: number
  filesChanged: number
  testFilesChanged: number
  prodFilesChanged: number
  iterationCount: number
  reviews: Review[]
  error?: string
  // First response timestamp (earliest activity by anyone other than author)
  firstResponseAt?: string | null
  // Churn metrics
  commitCount?: number
  churnPercentage?: number
  fileChurnCount?: number
}

export interface ReviewerSummary {
  reviewer: string
  totalReviews: number
  prsReviewedCount: number
  approvals: number
  changesRequested: number
  commentOnlyReviews: number
  noCommentApprovals: number
  noCommentApprovalPct: number
  totalInlineComments: number
  totalConversationComments: number
  // Response times are calendar hours from PR open to first activity
  medianResponseHours: string | null
  p90ResponseHours: string | null
  fastestResponseHours: string | null
  avgPrSizeReviewed: number
  avgPrProdLinesReviewed: number
  avgPrTestLinesReviewed: number
  avgIterationsPerPr: string
  avgReviewedPrCloseTime: string | null  // Calendar hours
  prsWithMultipleRounds: number
  [key: string]: string | number | null | undefined // For repo-specific columns
}

export interface AuthorSummary {
  author: string
  prsAuthored: number
  authoredPrAvgSize: number
  authoredPrAvgProdLines: number
  authoredPrAvgTestLines: number
  authoredPrAvgReviewTime: string | null  // Calendar hours to first response
  authoredPrAvgCloseTime: string          // Calendar hours to merge
  authoredPrAvgReviewCount: string        // Avg reviews received
  authoredPrAvgIterations: string         // Avg iterations
  authoredPrAvgCommits?: string
  authoredPrAvgChurnPct?: string
  authoredPrAvgFileChurn?: string
  [key: string]: string | number | null | undefined // For repo-specific columns
}

export interface TeamSummary {
  authored: {
    totalPRs: number
    totalDevelopers: number
    avgPrSize: number
    avgProdLines: number
    avgTestLines: number
    avgCloseTime: number | null  // Working hours
    avgIterations: number
    avgChurnPct: number
    avgFileChurn: number
    avgCommitsPerPr: number
  }
  reviewed: {
    totalReviews: number
    totalReviewers: number
    avgPrSizeReviewed: number
    avgProdLinesReviewed: number
    avgTestLinesReviewed: number
    medianResponseTime: number | null  // Working hours
    overallNoCommentPct: number
    avgInlineComments: number
    avgIterationsPerPr: number
  }
}

export interface MetricsData {
  month: string
  org: string
  repos: string[]
  generatedAt: string
  summary: ReviewerSummary[]
  authorSummary: AuthorSummary[]
  teamSummary?: TeamSummary  // Optional for backward compatibility
  details: PRDetail[]
}
