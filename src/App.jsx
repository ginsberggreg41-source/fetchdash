import React, { useState, useMemo, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, ScatterChart, Scatter, Cell, ReferenceLine, AreaChart } from 'recharts';
import { Upload, ChevronDown, ChevronUp, Calendar, TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Target, BarChart3, X, Plus, Layers, Filter, ArrowRight, AlertCircle, CheckCircle, Zap, Clock, AlertTriangle, Rocket, PauseCircle, CalendarPlus, Calculator, Info, Sparkles, Star, ArrowLeftRight, Wand2, Loader2, MessageSquare, Send, Bot, User, Copy, FileText, Briefcase, Printer, ClipboardCopy } from 'lucide-react';

// Parse the Fetch Rewards CSV format
const parseCSV = (text, fileName) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  let campaignName = fileName.replace('.csv', '');
  let campaignGroup = '';
  let summaryData = null;
  let offers = [];
  let dailyData = [];
  
  let section = 'header';
  let headersParsed = false;
  let offerHeaders = [];
  let dailyHeaders = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('"') && !line.includes(',')) {
      campaignName = line.replace(/"/g, '');
      continue;
    }
    
    if (line.startsWith('Campaign Group:')) {
      campaignGroup = line.replace('Campaign Group:', '').trim();
      continue;
    }
    
    if (line.startsWith('Buyer Volume')) {
      section = 'daily';
      headersParsed = false;
      continue;
    }
    
    if (section === 'header' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(line)) {
      const prevLine = lines[i - 1];
      if (prevLine && prevLine.includes('Start Date')) {
        const headers = parseCSVLine(prevLine);
        const values = parseCSVLine(line);
        summaryData = {};
        headers.forEach((h, idx) => {
          summaryData[h] = values[idx];
        });
      }
      continue;
    }
    
    if (line.includes('Offer Name,Offer ID')) {
      section = 'offers';
      offerHeaders = parseCSVLine(line);
      continue;
    }
    
    if (section === 'offers' && line.length > 10 && !line.startsWith('Buyer Volume')) {
      const values = parseCSVLine(line);
      if (values.length >= offerHeaders.length - 5) {
        const offer = {};
        offerHeaders.forEach((h, idx) => {
          offer[h] = values[idx] || '';
        });
        if (offer['Offer Name']) {
          offer.audienceNum = parseNumber(offer['Audience']);
          offer.buyersNum = parseNumber(offer['Buyers']);
          offer.redeemersNum = parseNumber(offer['Redeemers']);
          offer.redemptionsNum = parseNumber(offer['Redemptions']);
          offer.costNum = parseNumber(offer['Cost']);
          offer.budgetNum = parseNumber(offer['Budget']);
          offer.buyerSalesNum = parseNumber(offer['Buyer Sales']);
          offer.redeemerSalesNum = parseNumber(offer['Redeemer Sales']);
          offer.buyerUnitsNum = parseNumber(offer['Buyer Units']);
          offer.redeemerUnitsNum = parseNumber(offer['Redeemer Units']);
          offer.buyerTripsNum = parseNumber(offer['Buyer Trips']);
          offer.redeemerTripsNum = parseNumber(offer['Redeemer Trips']);
          offer.roasNum = parseNumber(offer['ROAS']);
          offer.pointsNum = parseNumber(offer['Points']);
          offer.salesLiftNum = parseNumber(offer['Sales Lift %']);
          offer.incrementalSalesNum = parseNumber(offer['Incremental Sales']);
          offer.costPerDayNum = parseNumber(offer['Cost / Day']);
          offer.budgetConsumedNum = parseNumber(offer['% Budget Consumed']);
          offer.daysCompleteNum = parseNumber(offer['% Days Complete']);
          
          offer.completionRate = offer.buyersNum > 0 ? (offer.redeemersNum / offer.buyersNum) * 100 : 0;
          offer.engagementRate = offer.audienceNum > 0 ? (offer.buyersNum / offer.audienceNum) * 100 : 0;
          offer.redemptionRate = parseNumber(offer['Redemption Rate']);
          offer.buyerValuePerTrip = offer.buyerTripsNum > 0 ? offer.buyerSalesNum / offer.buyerTripsNum : 0;
          offer.redeemerValuePerTrip = offer.redeemerTripsNum > 0 ? offer.redeemerSalesNum / offer.redeemerTripsNum : 0;
          offer.unitsPerBuyer = offer.buyersNum > 0 ? offer.buyerUnitsNum / offer.buyersNum : 0;
          offer.unitsPerRedeemer = offer.redeemersNum > 0 ? offer.redeemerUnitsNum / offer.redeemersNum : 0;
          
          // Detect spend threshold offers
          const offerText = (offer['Offer Name'] + ' ' + offer['Sub Banner']).toLowerCase();
          offer.isSpendThreshold = /spend\s*\$?\d+|purchase\s*\$?\d+|\$\d+\s*(or more|minimum)/i.test(offerText);
          
          // Detect tactic type for CAC relevance
          const tactic = (offer['Tactic'] || '').toLowerCase();
          const offerName = (offer['Offer Name'] || '').toLowerCase();
          const subBanner = (offer['Sub Banner'] || '').toLowerCase();
          const combinedText = `${tactic} ${offerName} ${subBanner}`;

          // NCE detection with word boundary to avoid false positives ("fence", "dance", etc.)
          const hasNCE = /\bnce\b/i.test(combinedText) || /\bn\.c\.e\./i.test(combinedText);

          offer.isAcquisitionTactic =
            hasNCE ||
            combinedText.includes('new category') ||
            combinedText.includes('competitive') ||
            combinedText.includes('comp buyer') ||
            combinedText.includes('conquest') ||
            combinedText.includes('new buyer') ||
            combinedText.includes('new to brand') ||
            /\bntb\b/i.test(combinedText) ||
            combinedText.includes('switcher') ||
            combinedText.includes('win-back') ||
            combinedText.includes('new customer');

          offer.isBrandBuyerTactic =
            combinedText.includes('brand buyer') ||
            combinedText.includes('loyalist') ||
            combinedText.includes('brand loyalist') ||
            combinedText.includes('lapsed') ||
            combinedText.includes('retention') ||
            combinedText.includes('existing buyer') ||
            combinedText.includes('existing customer') ||
            combinedText.includes('repeat buyer') ||
            /\bloyal\b/i.test(combinedText);

          // Fallback: spend threshold offers with no detected segment are typically brand buyer
          if (!offer.isAcquisitionTactic && !offer.isBrandBuyerTactic && offer.isSpendThreshold) {
            offer.isBrandBuyerTactic = true;
          }
          
          // CAC calculations
          offer.cac = offer.buyersNum > 0 ? offer.costNum / offer.buyersNum : 0;
          offer.costPerRedeemer = offer.redeemersNum > 0 ? offer.costNum / offer.redeemersNum : 0;
          
          offers.push(offer);
        }
      }
      continue;
    }
    
    if (section === 'daily' && !headersParsed && line.includes('Sales')) {
      dailyHeaders = parseCSVLine(line);
      headersParsed = true;
      continue;
    }
    
    if (section === 'daily' && headersParsed && /^\d{4}-\d{2}-\d{2}/.test(line)) {
      const values = parseCSVLine(line);
      const date = values[0];
      const sales = parseNumber(values[1]);
      const units = parseNumber(values[2]);
      const trips = parseNumber(values[3]);
      const buyers = parseNumber(values[4]);
      const cost = parseNumber(values[5]);
      
      if (date && (sales > 0 || units > 0 || cost > 0)) {
        dailyData.push({
          date,
          sales,
          units,
          trips,
          buyers,
          cost,
          roas: cost > 0 ? sales / cost : 0,
          cac: buyers > 0 ? cost / buyers : 0,
          costPerUnit: units > 0 ? cost / units : 0,
          unitsPerBuyer: buyers > 0 ? units / buyers : 0,
          salesPerBuyer: buyers > 0 ? sales / buyers : 0
        });
      }
    }
  }
  
  // Parse summary dates
  if (summaryData) {
    summaryData.startDateParsed = parseMMDDYYYY(summaryData['Start Date']);
    summaryData.endDateParsed = parseMMDDYYYY(summaryData['End Date']);
    summaryData.costNum = parseNumber(summaryData['Cost']);
    summaryData.budgetNum = parseNumber(summaryData['Budget']);
    summaryData.budgetConsumedNum = parseNumber(summaryData['% Budget Consumed']);
    summaryData.daysCompleteNum = parseNumber(summaryData['% Days Complete']);
  }
  
  return { campaignName, campaignGroup, summary: summaryData, offers, dailyData, fileName };
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseNumber = (str) => {
  if (!str || str === '-') return 0;
  return parseFloat(str.replace(/[$,%]/g, '').replace(/,/g, '')) || 0;
};

const parseMMDDYYYY = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const [month, day, year] = dateStr.split('/');
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

const formatCurrency = (num) => {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
};

const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return Math.round(num).toLocaleString();
};

const formatPercent = (num) => `${num.toFixed(1)}%`;

const formatDateShort = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateInput = (date) => {
  if (!date) return '';
  return date.toISOString().split('T')[0];
};

const daysBetween = (date1, date2) => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2 - date1) / oneDay);
};

// Metric Card Component
const MetricCard = ({ title, value, change, icon: Icon, format = 'number', color = 'blue', subtitle, muted = false }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200'
  };
  
  const formattedValue = format === 'currency' ? formatCurrency(value) : 
                         format === 'percent' ? formatPercent(value) :
                         format === 'roas' ? `${value.toFixed(2)}x` :
                         format === 'days' ? `${Math.round(value)} days` :
                         formatNumber(value);
  
  return (
    <div className={`rounded-xl p-4 border ${colorClasses[color]} transition-all hover:shadow-md ${muted ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{title}</span>
        <Icon size={18} className="opacity-60" />
      </div>
      <div className="text-2xl font-bold">{formattedValue}</div>
      {subtitle && <div className="text-xs opacity-70 mt-1">{subtitle}</div>}
      {change !== undefined && change !== null && (
        <div className={`flex items-center text-sm mt-1 ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span className="ml-1">{Math.abs(change).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};

// CAC Info Callout
const CACInfoCallout = ({ hasAcquisitionOffers, hasBrandBuyerOffers }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
        <div>
          <div className="font-semibold text-blue-800 mb-1">Understanding Customer Acquisition Cost (CAC)</div>
          <p className="text-sm text-blue-700 mb-2">
            <strong>CAC is only meaningful for acquisition segments</strong> — specifically <span className="font-semibold">New Category Entrant (NCE)</span> and <span className="font-semibold">Competitive Targeting</span> offers where you're acquiring new customers to your brand.
          </p>
          {hasBrandBuyerOffers && (
            <p className="text-sm text-blue-600">
              ⚠️ This campaign includes <strong>Brand Buyer</strong> segments. Cost-per-buyer for Brand Buyers is <em>not</em> a true acquisition cost since these customers already purchase your brand. Focus on ROAS and Sales Lift for those segments instead.
            </p>
          )}
          {hasAcquisitionOffers && (
            <p className="text-sm text-blue-600 mt-1">
              ✓ This campaign has acquisition offers (NCE/Competitive) — CAC is relevant for those specific segments.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Pacing Status Badge
const PacingBadge = ({ status, daysVariance }) => {
  const configs = {
    early: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', icon: Rocket, label: 'Ending Early' },
    late: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: PauseCircle, label: 'Under Pacing' },
    onTrack: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle, label: 'On Track' },
    complete: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: CheckCircle, label: 'Complete' }
  };
  
  const config = configs[status] || configs.onTrack;
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.text} ${config.border} border`}>
      <Icon size={16} />
      <span className="font-medium">{config.label}</span>
      {daysVariance !== 0 && status !== 'complete' && (
        <span className="text-sm opacity-80">({Math.abs(daysVariance)} days {status === 'early' ? 'early' : 'behind'})</span>
      )}
    </div>
  );
};

// Spend Threshold Warning
const SpendThresholdWarning = ({ offers }) => {
  const spendOffers = offers.filter(o => o.isSpendThreshold);
  if (spendOffers.length === 0) return null;
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
        <div>
          <div className="font-semibold text-amber-800 mb-1">Spend Threshold Detected</div>
          <p className="text-sm text-amber-700 mb-2">
            {spendOffers.length === 1 ? 'This campaign has' : `${spendOffers.length} offers have`} a spend threshold requirement. 
            Early pacing may appear slow because users need time to accumulate qualifying purchases before redemption.
          </p>
          <div className="text-sm text-amber-600">
            <strong>Affected offers:</strong> {spendOffers.map(o => o['Tactic']).join(', ')}
          </div>
          <p className="text-xs text-amber-600 mt-2 italic">
            💡 Tip: Compare pacing after 4-6 weeks for a more accurate read on spend-threshold campaigns.
          </p>
        </div>
      </div>
    </div>
  );
};

// Promo Period Card
const PromoPeriodCard = ({ title, icon: Icon, color, data, isBaseline = false }) => {
  const colorStyles = {
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', accent: 'text-slate-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'text-purple-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'text-amber-600' },
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'text-emerald-600' }
  };
  
  const style = colorStyles[color] || colorStyles.slate;
  
  return (
    <div className={`rounded-xl p-4 border ${style.bg} ${style.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={style.accent} />
        <span className={`font-semibold ${style.text}`}>{title}</span>
        {isBaseline && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Baseline</span>}
      </div>
      <div className="text-xs text-slate-500 mb-3">{data.dateRange}</div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Sales</span>
          <div className="text-right">
            <span className="font-semibold">{formatCurrency(data.sales)}</span>
            {data.salesChange !== undefined && (
              <span className={`text-xs ml-2 ${data.salesChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.salesChange >= 0 ? '+' : ''}{data.salesChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Units</span>
          <div className="text-right">
            <span className="font-semibold">{formatNumber(data.units)}</span>
            {data.unitsChange !== undefined && (
              <span className={`text-xs ml-2 ${data.unitsChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.unitsChange >= 0 ? '+' : ''}{data.unitsChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Buyers</span>
          <div className="text-right">
            <span className="font-semibold">{formatNumber(data.buyers)}</span>
            {data.buyersChange !== undefined && (
              <span className={`text-xs ml-2 ${data.buyersChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.buyersChange >= 0 ? '+' : ''}{data.buyersChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Spend</span>
          <div className="text-right">
            <span className="font-semibold">{formatCurrency(data.cost)}</span>
            {data.costChange !== undefined && (
              <span className={`text-xs ml-2 ${data.costChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.costChange >= 0 ? '+' : ''}{data.costChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
          <span className="text-sm text-slate-600">ROAS</span>
          <div className="text-right">
            <span className="font-bold text-blue-600">{data.roas.toFixed(2)}x</span>
            {data.roasChange !== undefined && (
              <span className={`text-xs ml-2 ${data.roasChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.roasChange >= 0 ? '+' : ''}{data.roasChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Avg Daily Sales</span>
          <span className="font-semibold">{formatCurrency(data.avgDailySales)}</span>
        </div>
      </div>
    </div>
  );
};

// Conversion Funnel
const ConversionFunnel = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = (item.value / maxValue) * 100;
        const nextItem = data[index + 1];
        const dropOff = nextItem ? ((item.value - nextItem.value) / item.value * 100) : null;
        
        return (
          <div key={item.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">{item.name}</span>
              <span className="text-sm font-bold text-slate-800">{formatNumber(item.value)}</span>
            </div>
            <div className="relative">
              <div className="h-10 bg-slate-100 rounded-lg overflow-hidden">
                <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${width}%`, backgroundColor: item.color, opacity: 0.8 + (index * 0.1) }} />
              </div>
              {dropOff !== null && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full flex items-center gap-1 text-xs text-slate-500">
                  <ArrowRight size={12} />
                  <span className="text-rose-500 font-medium">-{dropOff.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Insight Card
const InsightCard = ({ type, title, description, metric, icon: Icon }) => {
  const typeStyles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    alert: 'bg-rose-50 border-rose-200 text-rose-800'
  };
  
  const iconStyles = {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
    alert: 'text-rose-600'
  };
  
  return (
    <div className={`rounded-xl p-4 border ${typeStyles[type]}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${iconStyles[type]}`}><Icon size={20} /></div>
        <div className="flex-1">
          <div className="font-semibold mb-1">{title}</div>
          <div className="text-sm opacity-80">{description}</div>
          {metric && <div className="text-lg font-bold mt-2">{metric}</div>}
        </div>
      </div>
    </div>
  );
};

// AI Chat Panel Component with conversation support
const AIChatPanel = ({ campaignData, analysisType }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesContainerRef = React.useRef(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (customPrompt = null) => {
    const question = customPrompt || input.trim();
    if (!question && messages.length > 0) return;

    setLoading(true);
    setError('');

    // Add user message to chat (unless it's the initial analysis)
    if (!customPrompt) {
      setMessages(prev => [...prev, { role: 'user', content: question }]);
      setInput('');
    }

    try {
      // Build chat history for API
      const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignData: { ...campaignData, question },
          analysisType: customPrompt ? analysisType : 'chat',
          chatHistory: customPrompt ? [] : chatHistory
        })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.analysis }]);
      }
    } catch (err) {
      setError('Failed to connect. Check ANTHROPIC_API_KEY in Vercel settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
  };

  const suggestedQuestions = [
    "What's the #1 thing I should tell the client?",
    "How can we improve ROAS?",
    "Should we extend this campaign?",
    "Compare the offer segments for me",
    "What upsell opportunity exists here?"
  ];

  return (
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="text-violet-600" size={20} />
          <h3 className="font-semibold text-violet-800">AI Campaign Assistant</h3>
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Claude Haiku</span>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-sm text-violet-600 hover:text-violet-800 px-3 py-1 rounded-lg hover:bg-violet-100"
            >
              Clear Chat
            </button>
          )}
          {messages.length === 0 && (
            <button
              onClick={() => sendMessage(`Analyze this ${analysisType} data and give me key insights.`)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              Generate Insights
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-100 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div ref={messagesContainerRef} className="bg-white rounded-xl border border-violet-100 mb-4 max-h-96 overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`p-4 ${i > 0 ? 'border-t border-violet-50' : ''} ${msg.role === 'user' ? 'bg-slate-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200' : 'bg-violet-100'}`}>
                  {msg.role === 'user' ? <User size={14} className="text-slate-600" /> : <Bot size={14} className="text-violet-600" />}
                </div>
                <div className="flex-1 text-sm text-slate-700 whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="p-4 border-t border-violet-50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                  <Loader2 size={14} className="text-violet-600 animate-spin" />
                </div>
                <span className="text-sm text-slate-500">Thinking...</span>
              </div>
            </div>
          )}
          <div />
        </div>
      )}

      {/* Suggested Questions (only show if no messages) */}
      {messages.length === 0 && !loading && (
        <div className="mb-4">
          <p className="text-xs text-violet-600 mb-2">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  setMessages([{ role: 'user', content: q }]);
                  sendMessage(q);
                }}
                className="text-xs px-3 py-1.5 bg-white border border-violet-200 rounded-full text-violet-700 hover:bg-violet-50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {messages.length > 0 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a follow-up question..."
            disabled={loading}
            className="flex-1 px-4 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

// Campaign Recap Generator
const RECAP_OBJECTIVES = [
  { id: 'roas', label: 'ROAS / Efficiency', icon: TrendingUp, color: 'emerald' },
  { id: 'acquisition', label: 'Acquisition / Growth', icon: Users, color: 'blue' },
  { id: 'retention', label: 'Retention / Loyalty', icon: Star, color: 'purple' },
  { id: 'awareness', label: 'Awareness / Reach', icon: Target, color: 'amber' },
];

const RecapGenerator = ({ campaignData, offers }) => {
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [recap, setRecap] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateRecap = async (objective) => {
    setSelectedObjective(objective);
    setLoading(true);
    setError('');
    setRecap('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignData: { ...campaignData, objective: objective.id },
          analysisType: 'recap',
          chatHistory: []
        })
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRecap(data.analysis);
      }
    } catch (err) {
      setError('Failed to generate recap.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(recap);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="text-slate-700" size={20} />
        <h3 className="font-semibold text-slate-800">Campaign Recap for Client</h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">Select the campaign objective to generate a recap paragraph tailored to your client's goals.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {RECAP_OBJECTIVES.map(obj => (
          <button
            key={obj.id}
            onClick={() => generateRecap(obj)}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
              selectedObjective?.id === obj.id
                ? `bg-${obj.color}-100 border-${obj.color}-300 text-${obj.color}-800`
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            } disabled:opacity-50`}
          >
            <obj.icon size={16} />
            {obj.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
          <Loader2 size={16} className="animate-spin text-slate-500" />
          <span className="text-sm text-slate-500">Generating recap for {selectedObjective?.label}...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">{error}</div>
      )}

      {recap && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              {selectedObjective?.label} Recap
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              {copied ? <><CheckCircle size={12} className="text-emerald-600" /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{recap}</div>
        </div>
      )}
    </div>
  );
};

// Portfolio View - Multi-campaign sortable table
const PortfolioView = ({ campaigns, onSelectCampaign }) => {
  const [sortKey, setSortKey] = useState('campaignName');
  const [sortDir, setSortDir] = useState('asc');

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const portfolioRows = useMemo(() => campaigns.map(c => {
    const summary = c.summary;
    const today = new Date();
    const startDate = summary?.startDateParsed;
    const endDate = summary?.endDateParsed;
    const totalBudget = summary?.budgetNum || 0;
    const totalSpent = summary?.costNum || 0;
    const totalDays = startDate && endDate ? daysBetween(startDate, endDate) : 0;
    const daysElapsed = startDate ? daysBetween(startDate, today) : 0;
    const daysRemaining = endDate ? Math.max(daysBetween(today, endDate), 0) : 0;
    const avgSpend = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const daysUntilExhausted = avgSpend > 0 ? (totalBudget - totalSpent) / avgSpend : Infinity;
    const projectedEnd = new Date(today.getTime() + daysUntilExhausted * 86400000);
    const daysVariance = endDate ? daysBetween(projectedEnd, endDate) : 0;
    let pacingStatus = 'onTrack';
    if (daysRemaining <= 0) pacingStatus = 'complete';
    else if (daysVariance < -7) pacingStatus = 'early';
    else if (daysVariance > 14) pacingStatus = 'late';

    const sales = c.dailyData.reduce((s, d) => s + d.sales, 0);
    const spend = c.dailyData.reduce((s, d) => s + d.cost, 0);
    const roas = spend > 0 ? sales / spend : 0;
    const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      campaign: c,
      campaignName: c.campaignName,
      pacingStatus,
      daysVariance,
      roas,
      sales,
      spend,
      budget: totalBudget,
      budgetPct,
      daysRemaining,
      offerCount: c.offers.length
    };
  }), [campaigns]);

  const sorted = useMemo(() => {
    return [...portfolioRows].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [portfolioRows, sortKey, sortDir]);

  const totals = useMemo(() => ({
    spend: portfolioRows.reduce((s, r) => s + r.spend, 0),
    sales: portfolioRows.reduce((s, r) => s + r.sales, 0),
    budget: portfolioRows.reduce((s, r) => s + r.budget, 0),
    get roas() { return this.spend > 0 ? this.sales / this.spend : 0; },
    get budgetPct() { return this.budget > 0 ? (this.spend / this.budget) * 100 : 0; }
  }), [portfolioRows]);

  const pacingRowColor = { early: 'bg-rose-50', late: 'bg-amber-50', onTrack: 'bg-emerald-50', complete: 'bg-slate-50' };
  const pacingLabel = { early: 'Ending Early', late: 'Under Pacing', onTrack: 'On Track', complete: 'Complete' };
  const pacingDot = { early: 'bg-rose-400', late: 'bg-amber-400', onTrack: 'bg-emerald-400', complete: 'bg-slate-400' };

  const columns = [
    { key: 'campaignName', label: 'Campaign', align: 'left' },
    { key: 'pacingStatus', label: 'Pacing', align: 'left' },
    { key: 'roas', label: 'ROAS', align: 'right' },
    { key: 'sales', label: 'Sales', align: 'right' },
    { key: 'spend', label: 'Spend', align: 'right' },
    { key: 'budget', label: 'Budget', align: 'right' },
    { key: 'budgetPct', label: '% Used', align: 'right' },
    { key: 'daysRemaining', label: 'Days Left', align: 'right' },
    { key: 'offerCount', label: 'Offers', align: 'right' }
  ];

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronDown size={14} className="opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Briefcase className="text-slate-700" size={22} />
          <h2 className="text-lg font-bold text-slate-800">Portfolio Overview</h2>
          <span className="text-sm text-slate-500">{campaigns.length} campaigns</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)} className={`p-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                  <span className="inline-flex items-center gap-1">{col.label}<SortIcon col={col.key} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} onClick={() => onSelectCampaign(row.campaign)} className={`border-t border-slate-100 cursor-pointer hover:brightness-95 transition-colors ${pacingRowColor[row.pacingStatus]}`}>
                <td className="p-3 font-medium text-slate-800 max-w-[220px] truncate">{row.campaignName}</td>
                <td className="p-3"><span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${pacingDot[row.pacingStatus]}`}></span>{pacingLabel[row.pacingStatus]}</span></td>
                <td className="p-3 text-right font-semibold text-cyan-600">{row.roas.toFixed(2)}x</td>
                <td className="p-3 text-right">{formatCurrency(row.sales)}</td>
                <td className="p-3 text-right">{formatCurrency(row.spend)}</td>
                <td className="p-3 text-right">{formatCurrency(row.budget)}</td>
                <td className="p-3 text-right">{row.budgetPct.toFixed(1)}%</td>
                <td className="p-3 text-right">{row.daysRemaining}</td>
                <td className="p-3 text-right">{row.offerCount}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-300">
            <tr className="font-semibold text-slate-800">
              <td className="p-3">Portfolio Total</td>
              <td className="p-3"></td>
              <td className="p-3 text-right text-cyan-600">{totals.roas.toFixed(2)}x</td>
              <td className="p-3 text-right">{formatCurrency(totals.sales)}</td>
              <td className="p-3 text-right">{formatCurrency(totals.spend)}</td>
              <td className="p-3 text-right">{formatCurrency(totals.budget)}</td>
              <td className="p-3 text-right">{totals.budgetPct.toFixed(1)}%</td>
              <td className="p-3 text-right"></td>
              <td className="p-3 text-right"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// Client Report - Printable one-page campaign summary
const ClientReport = ({ campaign, metrics, pacingMetrics, conversionMetrics, aiSummary, aiLoading }) => {
  const topOffers = useMemo(() => {
    if (!campaign?.offers) return [];
    return [...campaign.offers].sort((a, b) => b.roasNum - a.roasNum).slice(0, 5);
  }, [campaign]);

  const completionRate = conversionMetrics?.totals?.avgCompletionRate || 0;
  const cac = metrics?.current?.cac || 0;

  return (
    <div className="report-printable bg-white p-8 max-w-4xl mx-auto">
      {/* Campaign Header */}
      <div className="border-b-2 border-slate-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{campaign.campaignName}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
          {campaign.summary?.startDateParsed && campaign.summary?.endDateParsed && (
            <span>{formatDateShort(campaign.summary.startDateParsed)} — {formatDateShort(campaign.summary.endDateParsed)}</span>
          )}
          {pacingMetrics && <PacingBadge status={pacingMetrics.status} daysVariance={pacingMetrics.daysVariance} />}
        </div>
      </div>

      {/* 6 Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200 text-center">
          <div className="text-xs text-cyan-600 font-medium">ROAS</div>
          <div className="text-xl font-bold text-cyan-800">{metrics.current.roas.toFixed(2)}x</div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
          <div className="text-xs text-blue-600 font-medium">Sales</div>
          <div className="text-xl font-bold text-blue-800">{formatCurrency(metrics.current.sales)}</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
          <div className="text-xs text-amber-600 font-medium">Spend</div>
          <div className="text-xl font-bold text-amber-800">{formatCurrency(metrics.current.cost)}</div>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
          <div className="text-xs text-purple-600 font-medium">Buyers</div>
          <div className="text-xl font-bold text-purple-800">{formatNumber(metrics.current.buyers)}</div>
        </div>
        <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-center">
          <div className="text-xs text-rose-600 font-medium">CAC</div>
          <div className="text-xl font-bold text-rose-800">{formatCurrency(cac)}</div>
        </div>
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
          <div className="text-xs text-emerald-600 font-medium">Completion Rate</div>
          <div className="text-xl font-bold text-emerald-800">{completionRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Budget & Pacing Snapshot */}
      {pacingMetrics && (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-3 text-sm">Budget & Pacing</h3>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600">Spent: {formatCurrency(pacingMetrics.totalSpent)}</span>
            <span className="text-slate-600">Budget: {formatCurrency(pacingMetrics.totalBudget)}</span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full ${pacingMetrics.status === 'early' ? 'bg-rose-500' : pacingMetrics.status === 'late' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pacingMetrics.budgetConsumedPct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{pacingMetrics.budgetConsumedPct.toFixed(1)}% spent</span>
            <span>{pacingMetrics.daysRemaining > 0 ? `${pacingMetrics.daysRemaining} days remaining` : 'Complete'}</span>
          </div>
        </div>
      )}

      {/* Top Offers Table */}
      {topOffers.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-3 text-sm">Top Offers by ROAS</h3>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2 font-medium text-slate-600">Tactic</th>
                <th className="text-right p-2 font-medium text-slate-600">ROAS</th>
                <th className="text-right p-2 font-medium text-slate-600">Buyers</th>
                <th className="text-right p-2 font-medium text-slate-600">Completion</th>
                <th className="text-right p-2 font-medium text-slate-600">Sales Lift</th>
              </tr>
            </thead>
            <tbody>
              {topOffers.map((offer, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-2 text-slate-700">{offer['Tactic']}</td>
                  <td className="p-2 text-right font-semibold text-cyan-600">{offer.roasNum.toFixed(2)}x</td>
                  <td className="p-2 text-right">{formatNumber(offer.buyersNum)}</td>
                  <td className="p-2 text-right">{offer.completionRate.toFixed(1)}%</td>
                  <td className="p-2 text-right text-emerald-600">{offer.salesLiftNum.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Executive Summary */}
      <div className="mb-6">
        <h3 className="font-semibold text-slate-700 mb-3 text-sm">Executive Summary</h3>
        {aiLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm p-4 bg-slate-50 rounded-lg">
            <Loader2 size={16} className="animate-spin" /> Generating executive summary...
          </div>
        ) : aiSummary ? (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap p-4 bg-slate-50 rounded-lg border border-slate-200">{aiSummary}</div>
        ) : (
          <div className="text-sm text-slate-400 italic p-4 bg-slate-50 rounded-lg">Summary unavailable</div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-3 text-xs text-slate-400 text-center">
        Report generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} — Fetch Campaign Analytics
      </div>
    </div>
  );
};

// Report Modal - wrapper with print/copy controls
const ReportModal = ({ campaign, metrics, pacingMetrics, conversionMetrics, onClose }) => {
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    const fetchSummary = async () => {
      try {
        const completionRate = conversionMetrics?.totals?.avgCompletionRate || 0;
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignData: {
              campaignName: campaign.campaignName,
              dateRange: campaign.summary ? `${formatDateShort(campaign.summary.startDateParsed)} to ${formatDateShort(campaign.summary.endDateParsed)}` : '',
              sales: metrics.current.sales,
              cost: metrics.current.cost,
              roas: metrics.current.roas,
              buyers: metrics.current.buyers,
              budget: campaign.summary?.budgetNum,
              spent: campaign.summary?.costNum,
              budgetConsumedPct: pacingMetrics?.budgetConsumedPct,
              daysElapsed: pacingMetrics?.daysElapsed,
              totalDays: pacingMetrics?.totalCampaignDays,
              timeElapsedPct: pacingMetrics?.timeElapsedPct,
              completionRate,
              offers: campaign.offers?.map(o => ({
                tactic: o['Tactic'],
                roas: o.roasNum,
                buyers: o.buyersNum,
                completionRate: o.completionRate,
                salesLift: o.salesLiftNum,
                isAcquisitionTactic: o.isAcquisitionTactic,
                isBrandBuyerTactic: o.isBrandBuyerTactic
              }))
            },
            analysisType: 'report',
            chatHistory: []
          })
        });
        const data = await response.json();
        if (data.analysis) setAiSummary(data.analysis);
      } catch (err) {
        setAiSummary('');
      } finally {
        setAiLoading(false);
      }
    };
    fetchSummary();
  }, [campaign, metrics, pacingMetrics, conversionMetrics]);

  const handlePrint = () => window.print();

  const handleCopy = () => {
    const completionRate = conversionMetrics?.totals?.avgCompletionRate || 0;
    const lines = [
      `Campaign Report: ${campaign.campaignName}`,
      '',
      `ROAS: ${metrics.current.roas.toFixed(2)}x`,
      `Sales: ${formatCurrency(metrics.current.sales)}`,
      `Spend: ${formatCurrency(metrics.current.cost)}`,
      `Buyers: ${formatNumber(metrics.current.buyers)}`,
      `CAC: ${formatCurrency(metrics.current.cac)}`,
      `Completion Rate: ${completionRate.toFixed(1)}%`,
    ];
    if (pacingMetrics) {
      lines.push('', `Budget: ${formatCurrency(pacingMetrics.totalBudget)} (${pacingMetrics.budgetConsumedPct.toFixed(1)}% used)`, `Days Remaining: ${Math.max(pacingMetrics.daysRemaining, 0)}`);
    }
    if (aiSummary) {
      lines.push('', 'Executive Summary:', aiSummary);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 print:shadow-none print:rounded-none print:m-0 print:max-w-none">
        {/* Modal Controls (hidden on print) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={20} /> Client Report</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {copied ? <><CheckCircle size={14} className="text-emerald-600" /> Copied</> : <><ClipboardCopy size={14} /> Copy Summary</>}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={20} /></button>
          </div>
        </div>
        <ClientReport
          campaign={campaign}
          metrics={metrics}
          pacingMetrics={pacingMetrics}
          conversionMetrics={conversionMetrics}
          aiSummary={aiSummary}
          aiLoading={aiLoading}
        />
      </div>
    </div>
  );
};

// Main Dashboard
export default function FetchDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [comparisonRange, setComparisonRange] = useState({ start: '', end: '' });
  const [showComparison, setShowComparison] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ offers: false, dailyData: false });
  const [selectedMetrics, setSelectedMetrics] = useState(['sales', 'cost']);
  const [chartType, setChartType] = useState('line');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Pacing state
  const [customEndDate, setCustomEndDate] = useState('');
  const [extensionDays, setExtensionDays] = useState(30);
  const [extensionType, setExtensionType] = useState('days');
  
  // Promo Analysis state
  const [promoType, setPromoType] = useState('pops');
  const [promoStart, setPromoStart] = useState('');
  const [promoEnd, setPromoEnd] = useState('');

  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = parseCSV(event.target.result, file.name);
          setCampaigns(prev => {
            const exists = prev.find(c => c.fileName === file.name);
            const updated = exists ? prev.map(c => c.fileName === file.name ? parsed : c) : [...prev, parsed];
            // Auto-select portfolio tab when 2nd campaign is added
            if (!exists && updated.length >= 2) {
              setActiveTab('portfolio');
            }
            return updated;
          });
          if (!selectedCampaign) {
            setSelectedCampaign(parsed);
            if (parsed.dailyData.length > 0) {
              setDateRange({ start: parsed.dailyData[0].date, end: parsed.dailyData[parsed.dailyData.length - 1].date });
            }
          }
        } catch (err) {
          console.error('Error parsing file:', err);
        }
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  }, [selectedCampaign]);

  const filteredData = useMemo(() => {
    if (!selectedCampaign) return [];
    let data = selectedCampaign.dailyData;
    if (dateRange.start) data = data.filter(d => d.date >= dateRange.start);
    if (dateRange.end) data = data.filter(d => d.date <= dateRange.end);
    return data;
  }, [selectedCampaign, dateRange]);

  const comparisonData = useMemo(() => {
    if (!selectedCampaign || !showComparison) return [];
    let data = selectedCampaign.dailyData;
    if (comparisonRange.start) data = data.filter(d => d.date >= comparisonRange.start);
    if (comparisonRange.end) data = data.filter(d => d.date <= comparisonRange.end);
    return data;
  }, [selectedCampaign, comparisonRange, showComparison]);

  // Promo period analysis
  const promoAnalysis = useMemo(() => {
    if (!selectedCampaign || !promoStart || !promoEnd) return null;
    
    const promoStartDate = new Date(promoStart);
    const promoEndDate = new Date(promoEnd);
    const promoDays = daysBetween(promoStartDate, promoEndDate) + 1;
    
    if (promoDays <= 0) return null;
    
    // Calculate pre and post periods with same duration
    const preStartDate = new Date(promoStartDate.getTime() - (promoDays * 24 * 60 * 60 * 1000));
    const preEndDate = new Date(promoStartDate.getTime() - (24 * 60 * 60 * 1000));
    const postStartDate = new Date(promoEndDate.getTime() + (24 * 60 * 60 * 1000));
    const postEndDate = new Date(promoEndDate.getTime() + (promoDays * 24 * 60 * 60 * 1000));
    
    const filterByDateRange = (start, end) => {
      const startStr = formatDateInput(start);
      const endStr = formatDateInput(end);
      return selectedCampaign.dailyData.filter(d => d.date >= startStr && d.date <= endStr);
    };
    
    const calcMetrics = (data) => {
      const sales = data.reduce((sum, d) => sum + d.sales, 0);
      const units = data.reduce((sum, d) => sum + d.units, 0);
      const buyers = data.reduce((sum, d) => sum + d.buyers, 0);
      const cost = data.reduce((sum, d) => sum + d.cost, 0);
      const days = data.length || 1;
      return {
        sales, units, buyers, cost,
        roas: cost > 0 ? sales / cost : 0,
        avgDailySales: sales / days,
        avgDailyUnits: units / days,
        days
      };
    };
    
    const preData = filterByDateRange(preStartDate, preEndDate);
    const duringData = filterByDateRange(promoStartDate, promoEndDate);
    const postData = filterByDateRange(postStartDate, postEndDate);
    
    const pre = calcMetrics(preData);
    const during = calcMetrics(duringData);
    const post = calcMetrics(postData);
    
    // Add percentage changes vs pre period
    const calcChange = (current, baseline) => baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
    
    during.salesChange = calcChange(during.sales, pre.sales);
    during.unitsChange = calcChange(during.units, pre.units);
    during.buyersChange = calcChange(during.buyers, pre.buyers);
    during.costChange = calcChange(during.cost, pre.cost);
    during.roasChange = calcChange(during.roas, pre.roas);
    
    post.salesChange = calcChange(post.sales, pre.sales);
    post.unitsChange = calcChange(post.units, pre.units);
    post.buyersChange = calcChange(post.buyers, pre.buyers);
    post.costChange = calcChange(post.cost, pre.cost);
    post.roasChange = calcChange(post.roas, pre.roas);
    
    return {
      promoDays,
      pre: { ...pre, dateRange: `${formatDateShort(preStartDate)} - ${formatDateShort(preEndDate)}`, startDate: preStartDate, endDate: preEndDate },
      during: { ...during, dateRange: `${formatDateShort(promoStartDate)} - ${formatDateShort(promoEndDate)}`, startDate: promoStartDate, endDate: promoEndDate },
      post: { ...post, dateRange: `${formatDateShort(postStartDate)} - ${formatDateShort(postEndDate)}`, startDate: postStartDate, endDate: postEndDate },
      // For chart
      chartData: [
        ...preData.map(d => ({ ...d, period: 'pre' })),
        ...duringData.map(d => ({ ...d, period: 'during' })),
        ...postData.map(d => ({ ...d, period: 'post' }))
      ]
    };
  }, [selectedCampaign, promoStart, promoEnd]);

  const metrics = useMemo(() => {
    const calc = (data) => ({
      sales: data.reduce((sum, d) => sum + d.sales, 0),
      cost: data.reduce((sum, d) => sum + d.cost, 0),
      units: data.reduce((sum, d) => sum + d.units, 0),
      trips: data.reduce((sum, d) => sum + d.trips, 0),
      buyers: data.reduce((sum, d) => sum + d.buyers, 0),
    });
    
    const current = calc(filteredData);
    current.roas = current.cost > 0 ? current.sales / current.cost : 0;
    current.cac = current.buyers > 0 ? current.cost / current.buyers : 0;
    current.costPerUnit = current.units > 0 ? current.cost / current.units : 0;
    
    let changes = {};
    if (showComparison && comparisonData.length > 0) {
      const comp = calc(comparisonData);
      comp.roas = comp.cost > 0 ? comp.sales / comp.cost : 0;
      comp.cac = comp.buyers > 0 ? comp.cost / comp.buyers : 0;
      
      changes = {
        sales: comp.sales > 0 ? ((current.sales - comp.sales) / comp.sales) * 100 : null,
        cost: comp.cost > 0 ? ((current.cost - comp.cost) / comp.cost) * 100 : null,
        units: comp.units > 0 ? ((current.units - comp.units) / comp.units) * 100 : null,
        buyers: comp.buyers > 0 ? ((current.buyers - comp.buyers) / comp.buyers) * 100 : null,
        roas: comp.roas > 0 ? ((current.roas - comp.roas) / comp.roas) * 100 : null,
        cac: comp.cac > 0 ? ((current.cac - comp.cac) / comp.cac) * 100 : null
      };
    }
    
    return { current, changes };
  }, [filteredData, comparisonData, showComparison]);

  // Check for acquisition vs brand buyer offers
  const offerTypeFlags = useMemo(() => {
    if (!selectedCampaign) return { hasAcquisition: false, hasBrandBuyer: false };
    return {
      hasAcquisition: selectedCampaign.offers.some(o => o.isAcquisitionTactic),
      hasBrandBuyer: selectedCampaign.offers.some(o => o.isBrandBuyerTactic)
    };
  }, [selectedCampaign]);

  // Pacing calculations
  const pacingMetrics = useMemo(() => {
    if (!selectedCampaign?.summary) return null;
    
    const summary = selectedCampaign.summary;
    const today = new Date();
    const startDate = summary.startDateParsed;
    const targetEndDate = customEndDate ? new Date(customEndDate) : summary.endDateParsed;
    
    if (!startDate || !targetEndDate) return null;
    
    const totalBudget = summary.budgetNum;
    const totalSpent = summary.costNum;
    const remainingBudget = totalBudget - totalSpent;
    
    const totalCampaignDays = daysBetween(startDate, targetEndDate);
    const daysElapsed = daysBetween(startDate, today);
    const daysRemaining = daysBetween(today, targetEndDate);
    
    const recentDays = selectedCampaign.dailyData.slice(-14);
    const recentAvgSpend = recentDays.length > 0 ? recentDays.reduce((sum, d) => sum + d.cost, 0) / recentDays.length : totalSpent / Math.max(daysElapsed, 1);
    const overallAvgSpend = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    
    const projectedTotalSpend = overallAvgSpend * totalCampaignDays;
    const daysUntilBudgetExhausted = overallAvgSpend > 0 ? remainingBudget / overallAvgSpend : Infinity;
    const projectedEndDate = new Date(today.getTime() + (daysUntilBudgetExhausted * 24 * 60 * 60 * 1000));
    const daysVariance = daysBetween(projectedEndDate, targetEndDate);
    
    const expectedSpendByNow = totalCampaignDays > 0 ? (daysElapsed / totalCampaignDays) * totalBudget : 0;
    const pacingRatio = expectedSpendByNow > 0 ? totalSpent / expectedSpendByNow : 1;
    
    let status = 'onTrack';
    if (daysRemaining <= 0) status = 'complete';
    else if (daysVariance < -7) status = 'early';
    else if (daysVariance > 14) status = 'late';
    
    let extensionDaysCalc = extensionDays;
    if (extensionType === 'weeks') extensionDaysCalc = extensionDays * 7;
    if (extensionType === 'months') extensionDaysCalc = extensionDays * 30;
    
    const extensionCost = recentAvgSpend * extensionDaysCalc;
    const newEndDate = new Date(targetEndDate.getTime() + (extensionDaysCalc * 24 * 60 * 60 * 1000));
    
    return {
      totalBudget, totalSpent, remainingBudget, totalCampaignDays, daysElapsed, daysRemaining,
      overallAvgSpend, recentAvgSpend, projectedTotalSpend, projectedEndDate, daysUntilBudgetExhausted,
      daysVariance, pacingRatio, status, startDate, targetEndDate,
      extensionDaysCalc, extensionCost, newEndDate,
      budgetConsumedPct: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      timeElapsedPct: totalCampaignDays > 0 ? (daysElapsed / totalCampaignDays) * 100 : 0
    };
  }, [selectedCampaign, customEndDate, extensionDays, extensionType]);

  const cumulativeSpendData = useMemo(() => {
    if (!selectedCampaign?.dailyData || !pacingMetrics) return [];
    
    let cumulative = 0;
    return selectedCampaign.dailyData.map((d, i) => {
      cumulative += d.cost;
      const dayNum = i + 1;
      const expectedByDay = (dayNum / pacingMetrics.totalCampaignDays) * pacingMetrics.totalBudget;
      return { date: d.date, actual: cumulative, expected: Math.min(expectedByDay, pacingMetrics.totalBudget), budget: pacingMetrics.totalBudget };
    });
  }, [selectedCampaign, pacingMetrics]);

  const conversionMetrics = useMemo(() => {
    if (!selectedCampaign) return null;
    const offers = selectedCampaign.offers;
    if (!offers.length) return null;
    
    const totals = {
      audience: offers.reduce((sum, o) => sum + o.audienceNum, 0),
      buyers: offers.reduce((sum, o) => sum + o.buyersNum, 0),
      redeemers: offers.reduce((sum, o) => sum + o.redeemersNum, 0),
      buyerSales: offers.reduce((sum, o) => sum + o.buyerSalesNum, 0),
      redeemerSales: offers.reduce((sum, o) => sum + o.redeemerSalesNum, 0),
      buyerUnits: offers.reduce((sum, o) => sum + o.buyerUnitsNum, 0),
      redeemerUnits: offers.reduce((sum, o) => sum + o.redeemerUnitsNum, 0),
      buyerTrips: offers.reduce((sum, o) => sum + o.buyerTripsNum, 0),
      redeemerTrips: offers.reduce((sum, o) => sum + o.redeemerTripsNum, 0),
      cost: offers.reduce((sum, o) => sum + o.costNum, 0)
    };
    
    totals.avgCompletionRate = totals.buyers > 0 ? (totals.redeemers / totals.buyers) * 100 : 0;
    totals.buyerValuePerTrip = totals.buyerTrips > 0 ? totals.buyerSales / totals.buyerTrips : 0;
    totals.redeemerValuePerTrip = totals.redeemerTrips > 0 ? totals.redeemerSales / totals.redeemerTrips : 0;
    totals.unitsPerBuyer = totals.buyers > 0 ? totals.buyerUnits / totals.buyers : 0;
    totals.unitsPerRedeemer = totals.redeemers > 0 ? totals.redeemerUnits / totals.redeemers : 0;
    totals.tripsPerBuyer = totals.buyers > 0 ? totals.buyerTrips / totals.buyers : 0;
    totals.tripsPerRedeemer = totals.redeemers > 0 ? totals.redeemerTrips / totals.redeemers : 0;
    
    return { totals, offers };
  }, [selectedCampaign]);

  const insights = useMemo(() => {
    if (!conversionMetrics) return [];
    const { totals } = conversionMetrics;
    const results = [];
    
    if (totals.avgCompletionRate < 50) {
      results.push({ type: 'warning', title: 'Low Completion Rate', description: `Only ${totals.avgCompletionRate.toFixed(1)}% of buyers complete offers.`, icon: AlertCircle });
    } else if (totals.avgCompletionRate > 70) {
      results.push({ type: 'success', title: 'Strong Completion Rate', description: `${totals.avgCompletionRate.toFixed(1)}% completion rate.`, icon: CheckCircle });
    }
    
    const valueMultiplier = totals.buyerValuePerTrip > 0 ? totals.redeemerValuePerTrip / totals.buyerValuePerTrip : 0;
    if (valueMultiplier > 1.1) {
      results.push({ type: 'success', title: 'Redeemers Drive Higher Value', description: `Redeemers spend ${formatCurrency(totals.redeemerValuePerTrip)}/trip vs ${formatCurrency(totals.buyerValuePerTrip)} for all buyers.`, metric: `${((valueMultiplier - 1) * 100).toFixed(0)}% more per trip`, icon: TrendingUp });
    }
    
    return results;
  }, [conversionMetrics]);

  const toggleSection = (section) => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) return prev.filter(m => m !== metric);
      if (prev.length >= 4) return prev;
      return [...prev, metric];
    });
  };
  const removeCampaign = (fileName) => {
    setCampaigns(prev => prev.filter(c => c.fileName !== fileName));
    if (selectedCampaign?.fileName === fileName) setSelectedCampaign(campaigns.find(c => c.fileName !== fileName) || null);
  };

  const metricConfig = {
    sales: { label: 'Sales', color: '#3B82F6', format: formatCurrency, yAxisId: 'currency' },
    cost: { label: 'Spend', color: '#F59E0B', format: formatCurrency, yAxisId: 'currency' },
    units: { label: 'Units', color: '#10B981', format: formatNumber, yAxisId: 'count' },
    buyers: { label: 'Buyers', color: '#8B5CF6', format: formatNumber, yAxisId: 'count' },
    trips: { label: 'Trips', color: '#EC4899', format: formatNumber, yAxisId: 'count' },
    roas: { label: 'ROAS', color: '#06B6D4', format: (v) => `${v.toFixed(2)}x`, yAxisId: 'ratio' },
    cac: { label: 'CAC', color: '#EF4444', format: formatCurrency, yAxisId: 'currency' },
    costPerUnit: { label: 'Cost/Unit', color: '#F97316', format: formatCurrency, yAxisId: 'currency' }
  };

  const activeYAxes = useMemo(() => {
    const axes = new Set();
    selectedMetrics.forEach(m => axes.add(metricConfig[m].yAxisId));
    return axes;
  }, [selectedMetrics]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Fetch Campaign Analytics</h1>
          <p className="text-slate-500">Upload campaign exports to analyze performance, pacing, and promo lift</p>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
              <Upload size={18} />
              <span>Upload CSV</span>
              <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" />
            </label>
            
            {campaigns.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {campaigns.map(c => (
                  <div
                    key={c.fileName}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${selectedCampaign?.fileName === c.fileName ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    onClick={() => { setSelectedCampaign(c); setCustomEndDate(''); if (c.dailyData.length > 0) setDateRange({ start: c.dailyData[0].date, end: c.dailyData[c.dailyData.length - 1].date }); }}
                  >
                    <span className="text-sm font-medium truncate max-w-[200px]">{c.campaignName}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeCampaign(c.fileName); }} className="hover:text-rose-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedCampaign ? (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {[
                ...(campaigns.length >= 2 ? [{ id: 'portfolio', label: 'Portfolio', icon: Briefcase }] : []),
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'pacing', label: 'Pacing & Upsell', icon: Rocket },
                { id: 'promo', label: 'Promo Analysis', icon: Sparkles },
                { id: 'conversion', label: 'Conversion', icon: Filter },
                { id: 'offers', label: 'Offer Deep Dive', icon: Target }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* PORTFOLIO TAB */}
            {activeTab === 'portfolio' && campaigns.length >= 2 && (
              <PortfolioView
                campaigns={campaigns}
                onSelectCampaign={(c) => {
                  setSelectedCampaign(c);
                  setCustomEndDate('');
                  if (c.dailyData.length > 0) setDateRange({ start: c.dailyData[0].date, end: c.dailyData[c.dailyData.length - 1].date });
                  setActiveTab('overview');
                }}
              />
            )}

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <>
                {/* AI Insights */}
                <AIChatPanel 
                  campaignData={{
                    campaignName: selectedCampaign?.campaignName,
                    dateRange: `${dateRange.start} to ${dateRange.end}`,
                    sales: metrics.current.sales,
                    cost: metrics.current.cost,
                    roas: metrics.current.roas,
                    units: metrics.current.units,
                    buyers: metrics.current.buyers,
                    cac: metrics.current.cac,
                    costPerUnit: metrics.current.costPerUnit,
                    offers: selectedCampaign?.offers?.map(o => ({
                      tactic: o['Tactic'],
                      roas: o.roasNum,
                      buyers: o.buyersNum,
                      completionRate: o.completionRate
                    }))
                  }}
                  analysisType="overview"
                />
                
                {/* Campaign Recap Generator */}
                <RecapGenerator
                  campaignData={{
                    campaignName: selectedCampaign?.campaignName,
                    dateRange: `${dateRange.start} to ${dateRange.end}`,
                    sales: metrics.current.sales,
                    cost: metrics.current.cost,
                    roas: metrics.current.roas,
                    units: metrics.current.units,
                    buyers: metrics.current.buyers,
                    cac: metrics.current.cac,
                    costPerUnit: metrics.current.costPerUnit,
                    budget: selectedCampaign?.summary?.budgetNum,
                    spent: selectedCampaign?.summary?.costNum,
                    completionRate: conversionMetrics?.totals?.avgCompletionRate,
                    offers: selectedCampaign?.offers?.map(o => ({
                      tactic: o['Tactic'],
                      roas: o.roasNum,
                      buyers: o.buyersNum,
                      completionRate: o.completionRate,
                      salesLift: o.salesLiftNum,
                      cac: o.cac,
                      engagementRate: o.engagementRate,
                      buyerValuePerTrip: o.buyerValuePerTrip,
                      isAcquisitionTactic: o.isAcquisitionTactic,
                      isBrandBuyerTactic: o.isBrandBuyerTactic
                    }))
                  }}
                  offers={selectedCampaign?.offers}
                />

                {/* Generate Client Report Button */}
                <div className="flex justify-end mb-6">
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm"
                  >
                    <FileText size={16} />
                    Generate Client Report
                  </button>
                </div>

                {/* CAC Info Callout */}
                <CACInfoCallout hasAcquisitionOffers={offerTypeFlags.hasAcquisition} hasBrandBuyerOffers={offerTypeFlags.hasBrandBuyer} />
                
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Primary Period</label>
                      <div className="flex items-center gap-2">
                        <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                        <span className="text-slate-400">to</span>
                        <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      </div>
                    </div>
                    <button onClick={() => setShowComparison(!showComparison)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${showComparison ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                      <Layers size={16} /><span>Compare Periods</span>
                    </button>
                    {showComparison && (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Comparison Period</label>
                        <div className="flex items-center gap-2">
                          <input type="date" value={comparisonRange.start} onChange={(e) => setComparisonRange(prev => ({ ...prev, start: e.target.value }))} className="px-3 py-2 border border-purple-300 rounded-lg text-sm bg-purple-50" />
                          <span className="text-slate-400">to</span>
                          <input type="date" value={comparisonRange.end} onChange={(e) => setComparisonRange(prev => ({ ...prev, end: e.target.value }))} className="px-3 py-2 border border-purple-300 rounded-lg text-sm bg-purple-50" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                  <MetricCard title="Total Sales" value={metrics.current.sales} change={metrics.changes.sales} icon={DollarSign} format="currency" color="blue" />
                  <MetricCard title="Total Spend" value={metrics.current.cost} change={metrics.changes.cost} icon={Target} format="currency" color="amber" />
                  <MetricCard title="Units Moved" value={metrics.current.units} change={metrics.changes.units} icon={ShoppingCart} format="number" color="green" />
                  <MetricCard title="Buyers" value={metrics.current.buyers} change={metrics.changes.buyers} icon={Users} format="number" color="purple" />
                  <MetricCard title="ROAS" value={metrics.current.roas} change={metrics.changes.roas} icon={TrendingUp} format="roas" color="cyan" />
                  <MetricCard title="Cost/Buyer" value={metrics.current.cac} change={metrics.changes.cac} icon={Users} format="currency" color="slate" subtitle="See CAC note above" muted={!offerTypeFlags.hasAcquisition} />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">Select Metrics to Plot (up to 4)</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(metricConfig).map(([key, config]) => (
                          <button key={key} onClick={() => toggleMetric(key)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${selectedMetrics.includes(key) ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`} style={selectedMetrics.includes(key) ? { backgroundColor: config.color } : {}}>
                            {config.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setChartType('line')} className={`px-3 py-1.5 rounded-lg text-sm ${chartType === 'line' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Line</button>
                      <button onClick={() => setChartType('bar')} className={`px-3 py-1.5 rounded-lg text-sm ${chartType === 'bar' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Bar</button>
                    </div>
                  </div>
                  
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                        {activeYAxes.has('currency') && <YAxis yAxisId="currency" orientation="left" tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />}
                        {activeYAxes.has('count') && <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />}
                        {activeYAxes.has('ratio') && !activeYAxes.has('count') && <YAxis yAxisId="ratio" orientation="right" tick={{ fontSize: 11 }} />}
                        <Tooltip formatter={(value, name) => { const config = Object.values(metricConfig).find(c => c.label === name); return config ? config.format(value) : value; }} labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />
                        <Legend />
                        {selectedMetrics.map(metric => (
                          chartType === 'line' ? <Line key={metric} type="monotone" dataKey={metric} stroke={metricConfig[metric].color} strokeWidth={2} dot={false} name={metricConfig[metric].label} yAxisId={metricConfig[metric].yAxisId} /> : <Bar key={metric} dataKey={metric} fill={metricConfig[metric].color} name={metricConfig[metric].label} yAxisId={metricConfig[metric].yAxisId} radius={[2, 2, 0, 0]} opacity={0.8} />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <button onClick={() => toggleSection('dailyData')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2"><Calendar size={20} className="text-purple-600" /><span className="font-semibold text-slate-800">Daily Performance</span><span className="text-sm text-slate-500">({filteredData.length} days)</span></div>
                    {expandedSections.dailyData ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  {expandedSections.dailyData && (
                    <div className="border-t border-slate-200 overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left p-3 font-medium text-slate-600">Date</th>
                            <th className="text-right p-3 font-medium text-slate-600">Sales</th>
                            <th className="text-right p-3 font-medium text-slate-600">Spend</th>
                            <th className="text-right p-3 font-medium text-slate-600">Units</th>
                            <th className="text-right p-3 font-medium text-slate-600">Buyers</th>
                            <th className="text-right p-3 font-medium text-slate-600">ROAS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredData.map((row, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="p-3 font-medium text-slate-800">{new Date(row.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                              <td className="p-3 text-right">{formatCurrency(row.sales)}</td>
                              <td className="p-3 text-right">{formatCurrency(row.cost)}</td>
                              <td className="p-3 text-right">{formatNumber(row.units)}</td>
                              <td className="p-3 text-right">{formatNumber(row.buyers)}</td>
                              <td className="p-3 text-right font-semibold text-blue-600">{row.roas.toFixed(2)}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PACING TAB */}
            {activeTab === 'pacing' && pacingMetrics && (
              <>
                <SpendThresholdWarning offers={selectedCampaign.offers} />

                {/* Campaign Header + Budget Progress */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 mb-1">{selectedCampaign.campaignName}</h2>
                      <p className="text-slate-500">{formatDateShort(pacingMetrics.startDate)} → {formatDateShort(pacingMetrics.targetEndDate)}</p>
                    </div>
                    <PacingBadge status={pacingMetrics.status} daysVariance={pacingMetrics.daysVariance} />
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Budget Progress</span>
                      <span className="font-medium">{formatCurrency(pacingMetrics.totalSpent)} / {formatCurrency(pacingMetrics.totalBudget)}</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
                      <div className={`h-full rounded-full transition-all ${pacingMetrics.status === 'early' ? 'bg-rose-500' : pacingMetrics.status === 'late' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pacingMetrics.budgetConsumedPct, 100)}%` }} />
                      <div className="absolute top-0 h-full w-0.5 bg-slate-600" style={{ left: `${Math.min(pacingMetrics.timeElapsedPct, 100)}%` }} title="Time elapsed marker" />
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-slate-500">
                      <span>{pacingMetrics.budgetConsumedPct.toFixed(1)}% spent</span>
                      <span>{pacingMetrics.timeElapsedPct.toFixed(1)}% of time elapsed</span>
                    </div>
                    <div className="flex items-center justify-end gap-4 mt-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5"><div className={`w-6 h-2 rounded ${pacingMetrics.status === 'early' ? 'bg-rose-500' : pacingMetrics.status === 'late' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div><span>Budget spent</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-0.5 h-3 bg-slate-600"></div><span>Time elapsed</span></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <Info size={18} className="text-slate-400" />
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-600 mb-1">Override Target End Date</label>
                      <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    {customEndDate && <button onClick={() => setCustomEndDate('')} className="text-sm text-slate-500 hover:text-slate-700">Reset</button>}
                  </div>
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard title="Days Elapsed" value={pacingMetrics.daysElapsed} icon={Clock} format="days" color="slate" subtitle={`of ${pacingMetrics.totalCampaignDays} total`} />
                  <MetricCard title="Days Remaining" value={Math.max(pacingMetrics.daysRemaining, 0)} icon={Calendar} format="days" color="blue" />
                  <MetricCard title="Daily Spend (Avg)" value={pacingMetrics.overallAvgSpend} icon={DollarSign} format="currency" color="amber" subtitle="campaign average" />
                  <MetricCard title="Daily Spend (Recent)" value={pacingMetrics.recentAvgSpend} icon={TrendingUp} format="currency" color="green" subtitle="last 14 days" />
                </div>

                {/* Pacing Projection - Full Width */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Target className="text-blue-600" size={20} />Pacing Projection</h3>

                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 mb-5 border border-blue-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="text-sm text-blue-600 font-medium mb-1">Projected Total Spend</div>
                        <div className="text-3xl font-bold text-blue-800">{formatCurrency(pacingMetrics.projectedTotalSpend)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-blue-600 font-medium mb-1">vs Budget ({formatCurrency(pacingMetrics.totalBudget)})</div>
                        <div className={`text-2xl font-bold ${pacingMetrics.projectedTotalSpend > pacingMetrics.totalBudget * 1.02 ? 'text-rose-600' : pacingMetrics.projectedTotalSpend < pacingMetrics.totalBudget * 0.9 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {pacingMetrics.projectedTotalSpend >= pacingMetrics.totalBudget ? '+' : ''}{formatCurrency(pacingMetrics.projectedTotalSpend - pacingMetrics.totalBudget)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-500 mb-1">Budget Remaining</div><div className="font-bold text-slate-800">{formatCurrency(pacingMetrics.remainingBudget)}</div></div>
                    <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-500 mb-1">Days Until Exhausted</div><div className="font-bold text-slate-800">{pacingMetrics.daysUntilBudgetExhausted === Infinity ? 'N/A' : `${Math.round(pacingMetrics.daysUntilBudgetExhausted)} days`}</div></div>
                    <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-500 mb-1">Projected End Date</div><div className="font-bold text-slate-800">{formatDateShort(pacingMetrics.projectedEndDate)}</div></div>
                    <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-500 mb-1">Variance vs Target</div><div className={`font-bold ${pacingMetrics.daysVariance < 0 ? 'text-rose-600' : pacingMetrics.daysVariance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{pacingMetrics.daysVariance > 0 ? '+' : ''}{Math.round(pacingMetrics.daysVariance)} days</div></div>
                  </div>

                  {pacingMetrics.status === 'early' && <div className="mt-4 p-3 bg-rose-50 rounded-lg border border-rose-200"><p className="text-sm text-rose-700"><strong>Budget will exhaust early.</strong> Consider requesting additional budget or reducing targeting.</p></div>}
                  {pacingMetrics.status === 'late' && <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200"><p className="text-sm text-amber-700"><strong>Under pacing.</strong> ~{formatCurrency(pacingMetrics.totalBudget - pacingMetrics.projectedTotalSpend)} may remain unspent. Consider expanding audience or increasing offer value.</p></div>}
                </div>

                {/* Cumulative Spend Chart */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Cumulative Spend vs Expected Pace</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cumulativeSpendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                        <Tooltip formatter={(value, name) => [formatCurrency(value), name]} labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />
                        <Legend />
                        <ReferenceLine y={pacingMetrics.totalBudget} stroke="#94A3B8" strokeDasharray="5 5" label={{ value: 'Budget', position: 'right' }} />
                        <Area type="monotone" dataKey="expected" name="Expected Pace" stroke="#94A3B8" fill="#F1F5F9" strokeDasharray="5 5" />
                        <Area type="monotone" dataKey="actual" name="Actual Spend" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Extension Calculator - Separate Section */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-indigo-200 p-6 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="text-indigo-600" size={20} />
                    <h3 className="font-semibold text-indigo-800">Campaign Extension Calculator</h3>
                  </div>
                  <p className="text-sm text-indigo-600 mb-4">Need to extend? Calculate the additional budget required based on recent daily spend.</p>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-sm font-medium text-indigo-700">Extend by</span>
                    <input type="number" min="1" max="365" value={extensionDays} onChange={(e) => setExtensionDays(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 border border-indigo-300 rounded-lg text-center font-medium" />
                    <select value={extensionType} onChange={(e) => setExtensionType(e.target.value)} className="px-3 py-2 border border-indigo-300 rounded-lg font-medium">
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-indigo-200">
                    <div className="text-center mb-4">
                      <div className="text-sm text-slate-500 mb-1">Additional Budget Required</div>
                      <div className="text-4xl font-bold text-indigo-700">{formatCurrency(pacingMetrics.extensionCost)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center p-2 bg-indigo-50 rounded-lg"><div className="text-indigo-600">New End Date</div><div className="font-semibold text-indigo-800">{formatDateShort(pacingMetrics.newEndDate)}</div></div>
                      <div className="text-center p-2 bg-indigo-50 rounded-lg"><div className="text-indigo-600">Based On</div><div className="font-semibold text-indigo-800">{formatCurrency(pacingMetrics.recentAvgSpend)}/day</div></div>
                    </div>
                  </div>
                </div>

                {/* AI Chat - At Bottom After All Data */}
                <AIChatPanel
                  campaignData={{
                    campaignName: selectedCampaign?.campaignName,
                    budget: pacingMetrics.totalBudget,
                    spent: pacingMetrics.totalSpent,
                    budgetConsumedPct: pacingMetrics.budgetConsumedPct,
                    daysElapsed: pacingMetrics.daysElapsed,
                    totalDays: pacingMetrics.totalCampaignDays,
                    timeElapsedPct: pacingMetrics.timeElapsedPct,
                    recentDailySpend: pacingMetrics.recentAvgSpend,
                    projectedEndDate: formatDateShort(pacingMetrics.projectedEndDate),
                    projectedTotalSpend: pacingMetrics.projectedTotalSpend,
                    daysVariance: pacingMetrics.daysVariance,
                    hasSpendThreshold: selectedCampaign?.offers?.some(o => o.isSpendThreshold)
                  }}
                  analysisType="pacing"
                />
              </>
            )}

            {/* PROMO ANALYSIS TAB */}
            {activeTab === 'promo' && (
              <>
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 mb-6 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles size={24} />
                    <h2 className="text-xl font-bold">Pops & Fetch Topia Analysis</h2>
                  </div>
                  <p className="opacity-90">Measure the impact of promotional periods by comparing pre, during, and post performance.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Configure Promo Period</h3>
                  
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Promotion Type</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'pops', label: 'Pops', icon: Star },
                          { id: 'fetchtopia', label: 'Fetch Topia', icon: Sparkles }
                        ].map(type => (
                          <button
                            key={type.id}
                            onClick={() => setPromoType(type.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${promoType === type.id ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                          >
                            <type.icon size={16} />
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Promo Start Date</label>
                      <input type="date" value={promoStart} onChange={(e) => setPromoStart(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Promo End Date</label>
                      <input type="date" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    
                    {promoStart && promoEnd && (
                      <div className="text-sm text-slate-500">
                        <span className="font-medium">{promoAnalysis?.promoDays || 0} days</span> — Will compare equal periods before & after
                      </div>
                    )}
                  </div>
                </div>

                {promoAnalysis ? (
                  <>
                    {/* AI Insights for Promo */}
                    <AIChatPanel 
                      campaignData={{
                        campaignName: selectedCampaign?.campaignName,
                        promoType: promoType === 'pops' ? 'Pops' : 'Fetch Topia',
                        pre: promoAnalysis.pre,
                        during: promoAnalysis.during,
                        post: promoAnalysis.post
                      }}
                      analysisType="promo"
                    />
                    
                    {/* Period Comparison Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <PromoPeriodCard title="Pre-Promo" icon={ArrowLeftRight} color="slate" data={promoAnalysis.pre} isBaseline={true} />
                      <PromoPeriodCard title={`During ${promoType === 'pops' ? 'Pops' : 'Fetch Topia'}`} icon={Sparkles} color="purple" data={promoAnalysis.during} />
                      <PromoPeriodCard title="Post-Promo" icon={ArrowRight} color="green" data={promoAnalysis.post} />
                    </div>

                    {/* Lift Summary */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                      <h3 className="font-semibold text-slate-800 mb-4">Promo Lift Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`p-4 rounded-xl ${promoAnalysis.during.salesChange >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                          <div className="text-sm text-slate-600 mb-1">Sales Lift (During)</div>
                          <div className={`text-2xl font-bold ${promoAnalysis.during.salesChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {promoAnalysis.during.salesChange >= 0 ? '+' : ''}{promoAnalysis.during.salesChange.toFixed(1)}%
                          </div>
                        </div>
                        <div className={`p-4 rounded-xl ${promoAnalysis.during.buyersChange >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                          <div className="text-sm text-slate-600 mb-1">Buyer Lift (During)</div>
                          <div className={`text-2xl font-bold ${promoAnalysis.during.buyersChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {promoAnalysis.during.buyersChange >= 0 ? '+' : ''}{promoAnalysis.during.buyersChange.toFixed(1)}%
                          </div>
                        </div>
                        <div className={`p-4 rounded-xl ${promoAnalysis.post.salesChange >= 0 ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'}`}>
                          <div className="text-sm text-slate-600 mb-1">Sales Retention (Post)</div>
                          <div className={`text-2xl font-bold ${promoAnalysis.post.salesChange >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                            {promoAnalysis.post.salesChange >= 0 ? '+' : ''}{promoAnalysis.post.salesChange.toFixed(1)}%
                          </div>
                        </div>
                        <div className={`p-4 rounded-xl ${promoAnalysis.post.buyersChange >= 0 ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'}`}>
                          <div className="text-sm text-slate-600 mb-1">Buyer Retention (Post)</div>
                          <div className={`text-2xl font-bold ${promoAnalysis.post.buyersChange >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                            {promoAnalysis.post.buyersChange >= 0 ? '+' : ''}{promoAnalysis.post.buyersChange.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      {promoAnalysis.post.salesChange > 0 && (
                        <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <p className="text-sm text-emerald-700">
                            <strong>✓ Strong retention!</strong> Sales stayed elevated post-promo, indicating the promotion drove lasting behavior change.
                          </p>
                        </div>
                      )}
                      {promoAnalysis.post.salesChange < -10 && (
                        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-sm text-amber-700">
                            <strong>⚠️ Post-promo drop-off.</strong> Sales decreased after the promo ended. Consider follow-up offers to maintain momentum.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Timeline Chart */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <h3 className="font-semibold text-slate-800 mb-4">Daily Sales Timeline</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={promoAnalysis.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                            <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />
                            <Legend />
                            {/* Background shading for promo period */}
                            <ReferenceLine x={promoStart} stroke="#9333EA" strokeWidth={2} label={{ value: 'Promo Start', position: 'top' }} />
                            <ReferenceLine x={promoEnd} stroke="#9333EA" strokeWidth={2} label={{ value: 'Promo End', position: 'top' }} />
                            <Area type="monotone" dataKey="sales" name="Daily Sales" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                    <Sparkles size={48} className="text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600">Select promo dates above to analyze</h3>
                    <p className="text-slate-500 mt-2">Choose the start and end dates of your Pops or Fetch Topia promotion</p>
                  </div>
                )}
              </>
            )}

            {/* CONVERSION TAB */}
            {activeTab === 'conversion' && conversionMetrics && (
              <>
                {/* AI Insights */}
                <AIChatPanel 
                  campaignData={{
                    campaignName: selectedCampaign?.campaignName,
                    audience: conversionMetrics.totals.audience,
                    buyers: conversionMetrics.totals.buyers,
                    redeemers: conversionMetrics.totals.redeemers,
                    completionRate: conversionMetrics.totals.avgCompletionRate,
                    buyerValuePerTrip: conversionMetrics.totals.buyerValuePerTrip,
                    redeemerValuePerTrip: conversionMetrics.totals.redeemerValuePerTrip,
                    unitsPerBuyer: conversionMetrics.totals.unitsPerBuyer,
                    unitsPerRedeemer: conversionMetrics.totals.unitsPerRedeemer,
                    offers: selectedCampaign?.offers?.map(o => ({
                      tactic: o['Tactic'],
                      completionRate: o.completionRate,
                      roas: o.roasNum
                    }))
                  }}
                  analysisType="conversion"
                />
                
                {insights.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {insights.map((insight, i) => <InsightCard key={i} {...insight} />)}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-800 mb-4">Conversion Funnel</h3>
                    <ConversionFunnel data={[
                      { name: 'Audience Reached', value: conversionMetrics.totals.audience, color: '#94A3B8' },
                      { name: 'Buyers (Started)', value: conversionMetrics.totals.buyers, color: '#3B82F6' },
                      { name: 'Redeemers (Completed)', value: conversionMetrics.totals.redeemers, color: '#10B981' }
                    ]} />
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between text-sm"><span className="text-slate-600">Overall Completion Rate</span><span className="font-bold text-emerald-600">{conversionMetrics.totals.avgCompletionRate.toFixed(1)}%</span></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-800 mb-4">Buyer vs Redeemer Behavior</h3>
                    <div className="space-y-4">
                      {[
                        { label: '$ Per Trip', buyer: conversionMetrics.totals.buyerValuePerTrip, redeemer: conversionMetrics.totals.redeemerValuePerTrip, format: formatCurrency },
                        { label: 'Units/Person', buyer: conversionMetrics.totals.unitsPerBuyer, redeemer: conversionMetrics.totals.unitsPerRedeemer, format: (v) => v.toFixed(1) },
                        { label: 'Trips/Person', buyer: conversionMetrics.totals.tripsPerBuyer, redeemer: conversionMetrics.totals.tripsPerRedeemer, format: (v) => v.toFixed(1) }
                      ].map((row, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="w-28 text-sm text-slate-600">{row.label}</div>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 bg-blue-100 rounded-lg px-3 py-2 text-center"><div className="text-xs text-blue-600">Buyers</div><div className="font-semibold text-blue-800">{row.format(row.buyer)}</div></div>
                            <div className="flex-1 bg-emerald-100 rounded-lg px-3 py-2 text-center"><div className="text-xs text-emerald-600">Redeemers</div><div className="font-semibold text-emerald-800">{row.format(row.redeemer)}</div></div>
                            {row.redeemer > row.buyer && <div className="text-xs text-emerald-600 font-medium">+{(((row.redeemer - row.buyer) / row.buyer) * 100).toFixed(0)}%</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Offer Table with CAC Context */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">Offer Performance by Segment</h3>
                    <p className="text-sm text-slate-500 mt-1">CAC highlighted for acquisition segments (NCE/Competitive) only</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-3 font-medium text-slate-600">Offer</th>
                          <th className="text-left p-3 font-medium text-slate-600">Tactic</th>
                          <th className="text-right p-3 font-medium text-slate-600">Buyers</th>
                          <th className="text-right p-3 font-medium text-slate-600">Cost</th>
                          <th className="text-right p-3 font-medium text-slate-600">CAC</th>
                          <th className="text-right p-3 font-medium text-slate-600">ROAS</th>
                          <th className="text-right p-3 font-medium text-slate-600">Sales Lift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversionMetrics.offers.map((offer, i) => (
                          <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-800 max-w-[180px] truncate">{offer['Offer Name']}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${offer.isAcquisitionTactic ? 'bg-blue-100 text-blue-700' : offer.isBrandBuyerTactic ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'}`}>
                                {offer.isAcquisitionTactic && <Users size={12} />}
                                {offer['Tactic']}
                              </span>
                            </td>
                            <td className="p-3 text-right">{formatNumber(offer.buyersNum)}</td>
                            <td className="p-3 text-right">{formatCurrency(offer.costNum)}</td>
                            <td className="p-3 text-right">
                              {offer.isAcquisitionTactic ? (
                                <span className="font-semibold text-rose-600">{formatCurrency(offer.cac)}</span>
                              ) : (
                                <span className="text-slate-400 italic" title="CAC not meaningful for brand buyer segments">N/A</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-semibold text-cyan-600">{offer.roasNum.toFixed(2)}x</td>
                            <td className="p-3 text-right text-emerald-600">{offer.salesLiftNum.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* OFFER DEEP DIVE TAB */}
            {activeTab === 'offers' && selectedCampaign.offers.length > 0 && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-3">Select an Offer</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCampaign.offers.map((offer, i) => (
                      <button key={i} onClick={() => setSelectedOffer(selectedOffer === offer ? null : offer)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedOffer === offer ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                        {offer['Tactic']}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedOffer && (
                  <>
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm opacity-80">{selectedOffer['Tactic']}</span>
                        {selectedOffer.isAcquisitionTactic && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Acquisition</span>}
                        {selectedOffer.isBrandBuyerTactic && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Brand Buyer</span>}
                      </div>
                      <h2 className="text-xl font-bold mb-2">{selectedOffer['Offer Name']}</h2>
                      <div className="text-sm opacity-80">{selectedOffer['Sub Banner']}</div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <MetricCard title="Total Cost" value={selectedOffer.costNum} icon={DollarSign} format="currency" color="amber" />
                      <MetricCard title="ROAS" value={selectedOffer.roasNum} icon={TrendingUp} format="roas" color="cyan" />
                      {selectedOffer.isAcquisitionTactic ? (
                        <MetricCard title="CAC (Acquisition)" value={selectedOffer.cac} icon={Users} format="currency" color="rose" subtitle="Cost per new buyer" />
                      ) : (
                        <MetricCard title="Cost/Buyer" value={selectedOffer.cac} icon={Users} format="currency" color="slate" subtitle="Not true CAC" muted={true} />
                      )}
                      {selectedOffer.isAcquisitionTactic ? (
                        <MetricCard title="Engagement Rate" value={selectedOffer.engagementRate} icon={Target} format="percent" color="green" subtitle={`${formatNumber(selectedOffer.buyersNum)} of ${formatNumber(selectedOffer.audienceNum)}`} />
                      ) : (
                        <MetricCard title="$ Per Trip" value={selectedOffer.buyerValuePerTrip} icon={ShoppingCart} format="currency" color="purple" subtitle="Basket size" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      <MetricCard title="Completion Rate" value={selectedOffer.completionRate} icon={CheckCircle} format="percent" color="green" subtitle={`${formatNumber(selectedOffer.redeemersNum)} redeemers`} />
                      <MetricCard title="Sales Lift" value={selectedOffer.salesLiftNum} icon={Zap} format="percent" color="purple" />
                      {selectedOffer.isAcquisitionTactic && (
                        <MetricCard title="Audience" value={selectedOffer.audienceNum} icon={Users} format="number" color="blue" subtitle="Total targeted" />
                      )}
                      {selectedOffer.isBrandBuyerTactic && (
                        <MetricCard title="Units/Buyer" value={selectedOffer.unitsPerBuyer} icon={ShoppingCart} format="number" color="blue" subtitle="Purchase frequency" />
                      )}
                    </div>

                    {selectedOffer.isBrandBuyerTactic && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                          <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
                          <div>
                            <div className="font-semibold text-blue-800">Brand Buyer Segment — Existing Customers</div>
                            <p className="text-sm text-blue-700">
                              This targets existing brand buyers. <strong>Cost-per-buyer is not a true acquisition cost</strong> since these customers already purchase your brand. Focus on <strong>ROAS, Sales Lift, and basket size ($/trip)</strong> for this segment.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedOffer.isAcquisitionTactic && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                          <Target className="text-emerald-600 mt-0.5 flex-shrink-0" size={20} />
                          <div>
                            <div className="font-semibold text-emerald-800">Acquisition Segment — New Customers</div>
                            <p className="text-sm text-emerald-700">
                              This targets new-to-brand buyers. <strong>CAC is the key efficiency metric</strong> here. Focus on <strong>CAC, engagement rate, and buyer volume</strong> to evaluate acquisition effectiveness.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Users className="text-blue-600" size={20} />Buyers</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Count</span><span className="font-semibold">{formatNumber(selectedOffer.buyersNum)}</span></div>
                          <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Total Sales</span><span className="font-semibold">{formatCurrency(selectedOffer.buyerSalesNum)}</span></div>
                          <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Total Units</span><span className="font-semibold">{formatNumber(selectedOffer.buyerUnitsNum)}</span></div>
                          <div className="flex justify-between py-2"><span className="text-slate-600">$ Per Trip</span><span className="font-semibold text-blue-600">{formatCurrency(selectedOffer.buyerValuePerTrip)}</span></div>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle className="text-emerald-600" size={20} />Redeemers</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Count</span><span className="font-semibold">{formatNumber(selectedOffer.redeemersNum)}</span></div>
                          <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Total Sales</span><span className="font-semibold">{formatCurrency(selectedOffer.redeemerSalesNum)}</span></div>
                          <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-600">Total Units</span><span className="font-semibold">{formatNumber(selectedOffer.redeemerUnitsNum)}</span></div>
                          <div className="flex justify-between py-2"><span className="text-slate-600">$ Per Trip</span><span className="font-semibold text-emerald-600">{formatCurrency(selectedOffer.redeemerValuePerTrip)}</span></div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!selectedOffer && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                    <Target size={48} className="text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600">Select an offer above</h3>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><Upload size={28} className="text-blue-600" /></div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Upload Your Campaign Data</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">Upload Fetch Rewards campaign CSV exports to get started.</p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
              <Plus size={18} /><span>Upload Campaign CSV</span>
              <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Report Modal */}
        {showReportModal && selectedCampaign && (
          <ReportModal
            campaign={selectedCampaign}
            metrics={metrics}
            pacingMetrics={pacingMetrics}
            conversionMetrics={conversionMetrics}
            onClose={() => setShowReportModal(false)}
          />
        )}
      </div>
    </div>
  );
}
