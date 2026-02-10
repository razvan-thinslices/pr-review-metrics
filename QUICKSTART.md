# PR Review Metrics - Quick Reference

## 📦 Installation & Setup

```bash
# Navigate to the directory
cd pr-review-metrics

# The script is ready to use (no install needed)
# Dashboard requires one-time setup:
cd dashboard && npm install
```

## 🚀 Quick Start Commands

### Collect Data
```bash
# Collect data for all repos (last month)
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs

# Collect for specific month
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs --month=2026-01

# Collect for single repo
node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign --month=2026-01
```

### Start Dashboard
```bash
cd dashboard
npm run dev
# Open http://localhost:3000
```

### Build for Production
```bash
cd dashboard
npm run build
npm start
```

## 📊 Output Files

```
output/
├── pr-reviews-2026-01.json    # Full data for dashboard
└── pr-reviews-2026-01.csv     # Summary for spreadsheets
```

## 🎯 Dashboard Tabs

1. **Overview** - Review counts and no-comment approval rates
2. **Response Time** - How fast reviewers respond
3. **PR Complexity** - Size analysis and test coverage
4. **Iterations** - Review round counts
5. **All PRs** - Searchable/sortable table

## ⚙️ Configuration

Edit `scripts/config.js` for defaults:
- Default org and repos
- Test file patterns
- Concurrency limits
- Retry settings

## 🔧 Requirements

- Node.js 18+ (you have v23.11.1 ✅)
- GitHub CLI (`gh`) installed and authenticated ✅
- Access to target repositories ✅

## 📈 Key Metrics

| Metric | What it measures |
|--------|------------------|
| **No-Comment Approval %** | Approvals without feedback (potential rubber-stamping) |
| **Response Time (Median)** | Typical time to first review |
| **Response Time (P90)** | Slowest 10% of reviews |
| **Iteration Count** | Total review submissions (indicates back-and-forth) |
| **PR Size** | Lines changed (prod vs test) |

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `gh: command not found` | Install: `brew install gh && gh auth login` |
| Rate limit error | Wait for reset or use PAT token |
| No data in dashboard | Verify `output/*.json` files exist |
| Dashboard won't start | Run `npm install` in dashboard directory |

## 📝 Workflow

```
1. Run data collection script monthly
   ↓
2. JSON files saved to output/
   ↓
3. Open dashboard to analyze
   ↓
4. Share insights with team
   ↓
5. Iterate and improve review process
```

## 🎓 Tips

- **Compare trends**: Collect data monthly and look for patterns
- **Filter by repo**: Use dashboard filters for focused analysis
- **Export CSV**: Use CSV files for custom analysis in Excel/Google Sheets
- **Team discussions**: Use "Slowest Reviews" data to identify bottlenecks

## 📁 File Structure

```
pr-review-metrics/
├── scripts/
│   ├── collect-metrics.js    # Data collection
│   └── config.js              # Configuration
├── output/                    # Generated data
├── dashboard/                 # Next.js dashboard
│   ├── app/                   # Pages and API routes
│   ├── components/            # React components
│   └── types/                 # TypeScript types
├── README.md                  # Overview
└── USAGE.md                   # Detailed guide
```

---

**Need help?** See USAGE.md for detailed documentation.
