# PR Review Metrics

A tool for analyzing GitHub PR review metrics across multiple repositories.

## Structure

- `scripts/` - Data collection scripts
- `output/` - Generated metrics data (gitignored)
- `dashboard/` - Next.js dashboard for visualizing metrics

## Usage

### 1. Collect Metrics

```bash
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs --month=2026-01
```

**CLI Arguments:**
- `--org` (required) - GitHub organization name
- `--repos` (required) - Comma-separated repository names
- `--month` (optional) - Target month in YYYY-MM format (defaults to previous month)

### 2. View Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:3000

## Output

The script generates two files in `output/`:
- `pr-reviews-YYYY-MM.json` - Full structured data
- `pr-reviews-YYYY-MM.csv` - Summary data (one row per reviewer)

## Requirements

- Node.js 18+
- GitHub CLI (`gh`) installed and authenticated
- Access to target repositories
