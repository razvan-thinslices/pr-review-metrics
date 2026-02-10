# Sample Output Structure

This directory will contain the generated metrics files.

After running the data collection script, you'll see files like:

```
output/
├── pr-reviews-2025-12.json
├── pr-reviews-2025-12.csv
├── pr-reviews-2026-01.json
└── pr-reviews-2026-01.csv
```

## JSON Structure

```json
{
  "month": "2026-01",
  "org": "thgenergy",
  "repos": ["fe-redesign", "be-revamp", "API-docs"],
  "generatedAt": "2026-02-10T14:30:00.000Z",
  "summary": [
    {
      "reviewer": "john-doe",
      "totalReviews": 45,
      "approvals": 38,
      "changesRequested": 5,
      "commentOnlyReviews": 2,
      "noCommentApprovals": 3,
      "noCommentApprovalPct": 7.9,
      "totalInlineComments": 120,
      "medianResponseHours": "4.50",
      "p90ResponseHours": "18.20",
      "fastestResponseHours": "0.50",
      "avgPrSizeReviewed": 245,
      "avgPrProdLinesReviewed": 180,
      "avgPrTestLinesReviewed": 65,
      "avgIterationsPerPr": "2.10",
      "prsWithMultipleRounds": 15,
      "fe-redesign": 30,
      "be-revamp": 12,
      "API-docs": 3
    }
  ],
  "details": [
    {
      "repo": "fe-redesign",
      "number": 1234,
      "title": "Add new dashboard component",
      "author": "jane-smith",
      "createdAt": "2026-01-15T10:00:00Z",
      "mergedAt": "2026-01-16T15:30:00Z",
      "url": "https://github.com/thgenergy/fe-redesign/pull/1234",
      "totalAdditions": 350,
      "totalDeletions": 50,
      "prodAdditions": 250,
      "prodDeletions": 30,
      "testAdditions": 100,
      "testDeletions": 20,
      "filesChanged": 12,
      "testFilesChanged": 3,
      "prodFilesChanged": 9,
      "iterationCount": 3,
      "reviews": [
        {
          "reviewer": "john-doe",
          "state": "CHANGES_REQUESTED",
          "submittedAt": "2026-01-15T14:30:00Z",
          "requestedAt": "2026-01-15T10:00:00Z",
          "responseHours": 4.5,
          "hasComments": true,
          "inlineCommentCount": 8,
          "body": "Please address the styling issues"
        }
      ]
    }
  ]
}
```

## CSV Structure

One row per reviewer with all metrics as columns:

```csv
reviewer,totalReviews,approvals,changesRequested,commentOnlyReviews,noCommentApprovals,noCommentApprovalPct,totalInlineComments,medianResponseHours,p90ResponseHours,fastestResponseHours,avgPrSizeReviewed,avgPrProdLinesReviewed,avgPrTestLinesReviewed,avgIterationsPerPr,prsWithMultipleRounds,fe-redesign,be-revamp,API-docs
john-doe,45,38,5,2,3,7.9,120,4.50,18.20,0.50,245,180,65,2.10,15,30,12,3
```
