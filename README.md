# fetchdash
Mission Control 2.0
---

## 📊 How Calculations Work

This dashboard performs **all calculations client-side** in your browser. Your data never leaves your computer. Here's what happens under the hood:

---

### 1️⃣ **CSV Parsing & Data Extraction**

When you upload a CSV from Mission Control, the dashboard automatically:

- Parses campaign metadata (name, dates, budget)
- Extracts offer-level data for each segment
- Processes daily performance data (sales, units, trips, buyers, cost)
- Detects offer types (Acquisition vs Brand Buyer)
- Identifies spend threshold offers

---

### 2️⃣ **Core Metrics**

#### **Performance Metrics**
| Metric | Formula |
|--------|---------|
| **ROAS** | `Sales ÷ Cost` |
| **CAC** (Customer Acquisition Cost) | `Cost ÷ Buyers` |
| **Cost Per Unit** | `Cost ÷ Units` |
| **Sales Per Buyer** | `Sales ÷ Buyers` |
| **Units Per Buyer** | `Units ÷ Buyers` |

#### **Conversion Metrics**
| Metric | Formula |
|--------|---------|
| **Completion Rate** | `(Redeemers ÷ Buyers) × 100` |
| **Engagement Rate** | `(Buyers ÷ Audience) × 100` |
| **Trips Per Buyer** | `Trips ÷ Buyers` |
| **Value Per Trip** | `Sales ÷ Trips` |

#### **Per-Offer Calculations**
- **Buyer Value Per Trip** = `Buyer Sales ÷ Buyer Trips`
- **Redeemer Value Per Trip** = `Redeemer Sales ÷ Redeemer Trips`
- **Cost Per Redeemer** = `Cost ÷ Redeemers`

---

### 3️⃣ **Pacing & Budget Tracking**

#### **Time & Budget Metrics**
```
Total Spent = Sum of all daily costs
Remaining Budget = Total Budget - Total Spent
Days Elapsed = Today - Start Date
Days Remaining = End Date - Today
```

#### **Spend Velocity**
```
Overall Avg Daily Spend = Total Spent ÷ Days Elapsed
Recent Avg Daily Spend = Last 14 days' spend ÷ 14
```

#### **Projections**
```
Projected Total Spend = Avg Daily Spend × Total Campaign Days
Days Until Budget Exhausted = Remaining Budget ÷ Avg Daily Spend
Projected End Date = Today + Days Until Exhausted
```

#### **Pacing Status**
```
Expected Spend By Now = (Days Elapsed ÷ Total Days) × Total Budget
Pacing Ratio = Actual Spend ÷ Expected Spend
Days Variance = Projected End Date - Target End Date
```

**Status Logic:**
- 🚀 **Ending Early**: Days Variance < -7 days
- ⏸️ **Under Pacing**: Days Variance > 14 days  
- ✅ **On Track**: Within ±7-14 day range
- ✓ **Complete**: Campaign ended

#### **Percentage Metrics**
```
Budget Consumed % = (Total Spent ÷ Total Budget) × 100
Time Elapsed % = (Days Elapsed ÷ Total Days) × 100
```

---

### 4️⃣ **Extension Calculator**

Calculate the cost of extending your campaign:
```
Extension Days Conversion:
  - If "weeks" selected: Days × 7
  - If "months" selected: Days × 30

Extension Cost = Recent Avg Daily Spend × Extension Days
New End Date = Current End Date + Extension Days
```

**Example:** Extending 2 weeks with $500/day avg spend = $7,000 additional budget needed

---

### 5️⃣ **Promo Analysis (Pops / Fetch Topia)**

Compares performance across three equal-length periods:

#### **Time Periods**
```
Promo Period = User-selected start/end dates
Pre Period = Same # of days BEFORE promo starts
Post Period = Same # of days AFTER promo ends
```

#### **For Each Period**
```
Total Sales = Sum of daily sales
Total Units = Sum of daily units  
Total Buyers = Sum of daily buyers
Total Cost = Sum of daily cost
ROAS = Sales ÷ Cost
Avg Daily Sales = Total Sales ÷ Days in period
```

#### **Lift Calculations (vs Pre-Period)**
```
Sales Lift % = ((During Sales - Pre Sales) ÷ Pre Sales) × 100
Units Lift % = ((During Units - Pre Units) ÷ Pre Units) × 100
Buyer Lift % = ((During Buyers - Pre Buyers) ÷ Pre Buyers) × 100
```

**Example:** If pre-period sales = $10K and during-promo = $15K, then **Sales Lift = +50%**

---

### 6️⃣ **Conversion Funnel**

Analyzes the buyer journey from awareness to redemption:

#### **Funnel Stages**
```
1. Audience (total addressable users)
2. Buyers (users who made qualifying purchases)
3. Redeemers (users who completed the offer)
```

#### **Drop-off Calculation**
```
Drop-off % = ((Current Stage - Next Stage) ÷ Current Stage) × 100
```

**Example:**  
- 100K Audience → 10K Buyers = **90% drop-off**
- 10K Buyers → 7K Redeemers = **30% drop-off**

#### **Completion Rate**
```
Completion Rate = (Redeemers ÷ Buyers) × 100
```

---

### 7️⃣ **Period Comparison**

Compare any two date ranges:
```
% Change = ((Current Period - Comparison Period) ÷ Comparison Period) × 100
```

Applied to all metrics: Sales, Cost, Units, Buyers, ROAS, CAC

---

### 8️⃣ **Cumulative Spend Tracking**

Tracks actual vs. expected spend over time:
```
For each day:
  Cumulative Actual = Running sum of daily costs
  Expected By Day = (Day Number ÷ Total Days) × Total Budget
  
Creates three lines on chart:
  - Actual spend (blue)
  - Expected pacing (dashed)
  - Total budget (ceiling)
```

---

### 9️⃣ **Automated Insights**

The dashboard generates insights based on your data:

#### **Completion Rate Insights**
- ⚠️ **Low Completion** if < 50%
- ✅ **Strong Completion** if > 70%

#### **Value Insights**
```
Value Multiplier = Redeemer $/Trip ÷ Buyer $/Trip

If Multiplier > 1.1:
  → "Redeemers spend X% more per trip than average buyers"
```

---

### 🔟 **CAC Context & Segmentation**

#### **Acquisition Tactics** (CAC is meaningful)
- New Category Entrant (NCE)
- Competitive Targeting
- Conquest campaigns

**CAC Formula:** `Cost ÷ New Buyers`

#### **Brand Buyer Tactics** (CAC not applicable)
- Loyalist retention
- Lapsed buyer reactivation
- Brand buyer engagement

**Note:** For Brand Buyer segments, focus on **ROAS** and **Sales Lift** instead of CAC, since these users already purchase your brand.

---

### 📈 **Chart Data**

**Multi-Metric Visualization:**
- Supports up to 4 metrics simultaneously
- Intelligent axis assignment:
  - **Currency Axis** (left): Sales, Cost, CAC, Cost/Unit
  - **Count Axis** (right): Units, Buyers, Trips
  - **Ratio Axis** (right): ROAS
- Auto-samples data if > 30 days to prevent chart overcrowding

---

### 🔒 **Data Privacy**

All calculations happen **client-side** in your browser using JavaScript:
- **No data uploaded to servers**
- **No external API calls for calculations**
- **CSV data stays in browser memory**
- **Cleared when you close the tab**

---

### 💡 **Pro Tips**

**For Best Results:**
- ✅ Use date filters to isolate specific events (Pops, Fetch Topia)
- ✅ Compare pre/during/post periods for lift analysis
- ✅ Check pacing weekly to catch under/overspending early
- ✅ Focus on ROAS + Sales Lift for brand buyer offers
- ✅ Focus on CAC for acquisition offers (NCE, Competitive)
- ✅ Account for ramp-up time on spend threshold offers (4-6 weeks)

---

## ❓ Calculation FAQs

**Q: Why is my CAC showing "N/A" for some offers?**  
A: CAC is only calculated for acquisition segments (NCE, Competitive). Brand Buyer offers show "N/A" because these customers already purchase your brand—cost per buyer ≠ true acquisition cost.

**Q: How is "Recent Avg Spend" calculated?**  
A: Last 14 days of spend ÷ 14. This gives a more current picture than overall average, especially if pacing has changed mid-campaign.

**Q: What's the difference between Buyers and Redeemers?**  
A: **Buyers** = users who made qualifying purchases. **Redeemers** = users who completed the full offer requirements. Completion Rate = Redeemers ÷ Buyers.

**Q: Why does my promo analysis show three periods?**  
A: To measure true lift, we compare equal-length periods: Pre (baseline), During (promo effect), and Post (residual effect). This isolates the promo's impact.

**Q: How accurate are spend projections?**  
A: Projections use historical avg daily spend. Accuracy improves after 2-3 weeks of data. Spend threshold offers may show slow early pacing—wait 4-6 weeks for accurate reads.

---
