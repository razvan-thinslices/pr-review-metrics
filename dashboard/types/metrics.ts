export interface Review {
  reviewer: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  submittedAt: string
  requestedAt?: string
  responseHours: number | null
  hasComments: boolean
  inlineCommentCount: number
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
  medianResponseHours: string | null
  p90ResponseHours: string | null
  fastestResponseHours: string | null
  avgPrSizeReviewed: number
  avgPrProdLinesReviewed: number
  avgPrTestLinesReviewed: number
  avgIterationsPerPr: string
  avgReviewedPrCloseTime: string | null
  prsWithMultipleRounds: number
  [key: string]: string | number | null | undefined // For repo-specific columns
}

export interface AuthorSummary {
  author: string
  prsAuthored: number
  authoredPrAvgSize: number
  authoredPrAvgProdLines: number
  authoredPrAvgTestLines: number
  authoredPrAvgReviewTime: string | null  // Hours to first review
  authoredPrAvgCloseTime: string          // Hours to merge
  authoredPrAvgReviewCount: string        // Avg reviews received
  authoredPrAvgIterations: string         // Avg iterations
  [key: string]: string | number | null | undefined // For repo-specific columns
}

export interface MetricsData {
  month: string
  org: string
  repos: string[]
  generatedAt: string
  summary: ReviewerSummary[]
  authorSummary: AuthorSummary[]
  details: PRDetail[]
}
