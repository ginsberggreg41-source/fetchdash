# Fetch Campaign Analytics Dashboard

An internal analytics tool for Fetch Rewards account managers to analyze campaign performance, track pacing, measure promo lift, and calculate upsell opportunities.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Fetch+Campaign+Dashboard)

## Features

- **📊 Performance Overview** — Sales, spend, units, buyers, ROAS with multi-metric charting
- **🚀 Pacing & Upsell** — Budget pacing, projections, and extension calculator
- **✨ Promo Analysis** — Pre/during/post comparison for Pops & Fetch Topia
- **🔄 Conversion Funnel** — Buyer vs Redeemer behavior analysis
- **📈 Offer Deep Dive** — Segment-level performance with CAC context

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ installed ([download here](https://nodejs.org/))
- Git installed ([download here](https://git-scm.com/))

### Steps

```bash
# 1. Clone or download this folder
cd fetch-dashboard

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open http://localhost:5173 in your browser
```

---

## 🚀 Deploy to Vercel (Recommended)

### Option A: Deploy via Vercel CLI (Fastest)

```bash
# 1. Install Vercel CLI globally
npm install -g vercel

# 2. Navigate to project folder
cd fetch-dashboard

# 3. Deploy (follow prompts)
vercel

# 4. For production deployment
vercel --prod
```

### Option B: Deploy via GitHub + Vercel Dashboard

#### Step 1: Push to GitHub

```bash
# Initialize git repo
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Fetch Campaign Dashboard"

# Create repo on GitHub (go to github.com/new)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/fetch-dashboard.git
git branch -M main
git push -u origin main
```

#### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Select your `fetch-dashboard` repository
4. Vercel auto-detects Vite settings — just click **"Deploy"**
5. Wait ~60 seconds for deployment
6. Get your live URL: `https://fetch-dashboard-xxxxx.vercel.app`

#### Step 3: Custom Domain (Optional)

1. In Vercel dashboard, go to **Settings → Domains**
2. Add your custom domain (e.g., `fetch-analytics.yourcompany.com`)
3. Follow DNS configuration instructions

---

## 📁 Project Structure

```
fetch-dashboard/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          # Main dashboard component
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind CSS
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
├── vercel.json          # Vercel deployment config
└── README.md            # This file
```

---

## 📋 How to Use

### Uploading Data

1. Export campaign data from Fetch Rewards platform as CSV
2. Click **"Upload CSV"** button
3. Select one or multiple campaign files
4. Dashboard automatically parses and displays data

### Tabs Overview

| Tab | Purpose |
|-----|---------|
| **Overview** | High-level metrics, multi-metric charts, date filtering |
| **Pacing & Upsell** | Budget tracking, projections, extension calculator |
| **Promo Analysis** | Pops/Fetch Topia pre/during/post comparison |
| **Conversion** | Buyer vs Redeemer funnel, completion rates |
| **Offer Deep Dive** | Individual offer analysis by segment |

### Key Metrics Explained

- **CAC (Customer Acquisition Cost)** — Only relevant for NCE & Competitive segments
- **Completion Rate** — Redeemers ÷ Buyers (what % finish the offer)
- **ROAS** — Return on Ad Spend (Sales ÷ Cost)
- **Sales Lift** — Incremental sales vs control group

---

## 🔧 Customization

### Adding New Metrics

Edit `src/App.jsx` and add to the `metricConfig` object:

```javascript
const metricConfig = {
  // ... existing metrics
  newMetric: { 
    label: 'New Metric', 
    color: '#FF5733', 
    format: formatCurrency, 
    yAxisId: 'currency' 
  }
};
```

### Changing Colors

Update Tailwind classes in the component or modify `tailwind.config.js`.

---

## 🤝 Team Usage

Share the Vercel URL with your team. Each person can:
- Upload their own campaign CSVs
- Data stays in their browser (not stored on server)
- No login required

---

## 🐛 Troubleshooting

**CSV not parsing correctly?**
- Ensure it's exported directly from Fetch Rewards
- Check the file has the "Buyer Volume" section with daily data

**Charts not showing?**
- Make sure date range includes days with data
- Check browser console for errors (F12 → Console)

**Deployment failing?**
- Run `npm run build` locally to check for errors
- Ensure all dependencies are in `package.json`

---

## 📝 License

Internal use only — Fetch Rewards Account Management Team

---

## 🙋 Support

Questions? Reach out to the team or open an issue in the GitHub repo.
