# PR Review Metrics - Usage Guide

## Quick Start

### 1. Collect Metrics Data

Navigate to the pr-review-metrics directory and run:

```bash
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs --month=2026-01
```

**CLI Options:**
- `--org` (required): GitHub organization name
- `--repos` (required): Comma-separated list of repository names
- `--month` (optional): Target month in YYYY-MM format (defaults to previous month)

**What it does:**
- Fetches all PRs merged in the target month
- Collects reviews, timeline events, and file changes
- Calculates comprehensive metrics per reviewer and per PR
- Generates JSON and CSV output files in `output/` directory

**Expected output:**
```
output/
├── pr-reviews-2026-01.json  # Full structured data
└── pr-reviews-2026-01.csv   # Summary CSV (one row per reviewer)
```

### 2. Start the Dashboard

```bash
cd dashboard
npm run dev
```

Open http://localhost:3000 in your browser.

The dashboard will automatically detect and list all available months from the `output/` directory.

---

## Dashboard Features

### Overview Tab
- **Reviews per Reviewer**: Stacked bar chart showing approved, changes requested, and comment-only reviews
- **No-Comment Approval Rate**: Horizontal bar chart highlighting reviewers with high rates of approvals without feedback

### Response Time Tab
- **Response Time Distribution**: Shows fastest, median, and P90 response times per reviewer
- **Response Time vs PR Size**: Scatter plot to identify if larger PRs take longer to review
- **Slowest Reviews**: Table of the 10 slowest reviews with links to PRs

### PR Complexity Tab
- **PR Size vs Review Iterations**: Scatter plot showing correlation between PR size and number of review rounds
- **Test vs Production Lines**: Stacked bar chart for the 20 largest PRs
- **PR Size Distribution**: Histogram showing how PR sizes are distributed

### Iterations Tab
- **Average Iterations per Reviewer**: Bar chart of average review iterations
- **Single vs Multi-Round Reviews**: Pie chart breakdown
- **Most Iterated PRs**: Table of PRs with the most review rounds

### All PRs Tab
- Sortable, filterable table of all PRs
- Search by title, author, or PR number
- Filter by repository
- Click PR numbers to open on GitHub

---

## Metrics Explained

### Per-Reviewer Metrics

| Metric | Description |
|--------|-------------|
| `totalReviews` | Total number of review submissions |
| `approvals` | Count of APPROVED reviews |
| `changesRequested` | Count of CHANGES_REQUESTED reviews |
| `commentOnlyReviews` | Count of COMMENTED reviews (no approval/rejection) |
| `noCommentApprovals` | Approvals with no body text AND no inline comments |
| `noCommentApprovalPct` | Percentage of approvals that had zero feedback |
| `totalInlineComments` | Total inline/code review comments |
| `medianResponseHours` | Median time from review request to submission |
| `p90ResponseHours` | 90th percentile response time |
| `fastestResponseHours` | Minimum response time |
| `avgPrSizeReviewed` | Average total lines changed in reviewed PRs |
| `avgPrProdLinesReviewed` | Average production (non-test) lines |
| `avgPrTestLinesReviewed` | Average test lines |
| `avgIterationsPerPr` | Average number of review submissions per PR |
| `prsWithMultipleRounds` | Count of PRs where reviewer submitted >1 review |

### Per-PR Metrics

| Metric | Description |
|--------|-------------|
| `totalAdditions/Deletions` | Raw line counts (all files) |
| `prodAdditions/Deletions` | Non-test file changes only |
| `testAdditions/Deletions` | Test file changes only |
| `filesChanged` | Total files modified |
| `prodFilesChanged` | Production files modified |
| `testFilesChanged` | Test files modified |
| `iterationCount` | Total number of review submissions (all reviewers) |
| `reviews[]` | Array of all reviews with detailed info |

---

## Configuration

Edit `scripts/config.js` to customize:

```javascript
{
  org: 'thgenergy',                    // Default organization
  repos: ['fe-redesign', 'be-revamp'], // Default repositories
  outputDir: './output',                // Output directory
  testFilePatterns: [                   // Patterns to identify test files
    '*.test.*',
    '*.spec.*',
    '__tests__/',
    // ... add more patterns
  ],
  prConcurrency: 5,                     // Concurrent PR processing
  maxRetries: 3,                        // API retry attempts
  retryDelayMs: 1000,                   // Initial retry delay
  rateLimitWarningThreshold: 100        // Warn if API calls < this
}
```

---

## Troubleshooting

### "gh: command not found"

Install GitHub CLI:
```bash
brew install gh
gh auth login
```

### Rate limit errors

The script checks your GitHub API rate limit before and after execution. If you hit the limit:
- Wait for the rate limit to reset (shown in script output)
- Or use a GitHub Personal Access Token with higher limits

### No data in dashboard

Make sure:
1. The data collection script ran successfully
2. JSON files exist in `pr-review-metrics/output/`
3. The dashboard is running from `pr-review-metrics/dashboard/`
4. File paths are relative (`../output/` from dashboard)

### Dashboard shows "Data not found"

- Verify the JSON file exists: `ls ../output/`
- Check the month format in the filename: `pr-reviews-YYYY-MM.json`
- Ensure the JSON is valid: `node -e "require('../output/pr-reviews-2026-01.json')"`

---

## Tips & Best Practices

### Data Collection

1. **Run monthly**: Set up a cron job or scheduled task to collect metrics automatically
2. **Specify date ranges**: Use `--month=YYYY-MM` to collect historical data
3. **Monitor rate limits**: The script shows API usage before and after
4. **Save logs**: Redirect output to a log file: `node scripts/collect-metrics.js > logs/2026-01.log 2>&1`

### Analysis

1. **Compare months**: Run the script for multiple months and compare trends
2. **Filter by repo**: Use the dashboard's repo filter to analyze individual projects
3. **Identify patterns**: Look for correlations between PR size and review time/iterations
4. **Team discussions**: Use the "Slowest Reviews" and "No-Comment Approvals" data to guide team improvements

### Privacy

- The generated data includes PR titles and author names
- Do not commit `output/` directory to version control (it's gitignored)
- Be mindful of sensitive information in PR titles

---

## Development

### Building for Production

```bash
cd dashboard
npm run build
npm start
```

### Deploying

The dashboard is a Next.js app and can be deployed to:
- Vercel (easiest: `vercel deploy`)
- AWS (with Amplify or EC2)
- Docker container
- Any Node.js hosting

**Important**: Ensure the `output/` directory is accessible to the deployed app, or modify the API routes to read from a different location (e.g., S3, database).

---

## Examples

### Collect last 3 months of data

```bash
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs --month=2025-11
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs --month=2025-12
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs --month=2026-01
```

### Analyze single repository

```bash
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign --month=2026-01
```

Then use the repo filter in the dashboard to view only that repository.

### Export reviewer summary to CSV

The CSV file (`pr-reviews-YYYY-MM.csv`) is automatically generated and can be:
- Opened in Excel/Google Sheets
- Imported into BI tools
- Used for further analysis with pandas/R

---

## Questions?

For issues or feature requests, refer to the main README.md or project documentation.
