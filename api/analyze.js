// Vercel Serverless Function - uses Google Gemini (FREE)
// File: /api/analyze.js

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { campaignData, analysisType, chatHistory } = await req.json();

    // Try Gemini first (free), fall back to Anthropic if available
    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    if (!geminiKey && !anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured. Add GEMINI_API_KEY (free) to Vercel environment variables.' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(campaignData);
    const userPrompt = buildUserPrompt(campaignData, analysisType, chatHistory);

    let aiResponse;

    if (geminiKey) {
      // Use Gemini (FREE - Gemini 1.5 Flash)
      aiResponse = await callGemini(geminiKey, systemPrompt, userPrompt, chatHistory);
    } else {
      // Fallback to Anthropic
      aiResponse = await callAnthropic(anthropicKey, systemPrompt, userPrompt);
    }

    return new Response(
      JSON.stringify({ analysis: aiResponse }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get AI analysis' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function callGemini(apiKey, systemPrompt, userPrompt, chatHistory = []) {
  // Combine system prompt and user prompt for Gemini
  let fullPrompt = `${systemPrompt}\n\n`;
  
  // Add chat history if exists
  if (chatHistory && chatHistory.length > 0) {
    chatHistory.forEach(msg => {
      fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    });
  }
  
  fullPrompt += `User: ${userPrompt}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error('Failed to get AI analysis from Gemini');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callAnthropic(apiKey, systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Anthropic API error:', error);
    throw new Error('Failed to get AI analysis');
  }

  const data = await response.json();
  return data.content[0].text;
}

function buildSystemPrompt(data) {
  return `You are an expert Fetch Rewards account manager and campaign analyst. You help account managers understand campaign performance, identify optimization opportunities, and prepare for client conversations.

Your communication style:
- Concise and actionable (no fluff)
- Use specific numbers from the data
- Highlight what matters most for client conversations
- Suggest specific optimizations and upsell opportunities
- Write in flowing prose, not bullet points unless asked

Current Campaign Context:
Campaign: ${data.campaignName || 'Unknown'}
${data.dateRange ? `Period: ${data.dateRange}` : ''}
${data.sales ? `Total Sales: $${data.sales.toLocaleString()}` : ''}
${data.cost ? `Total Spend: $${data.cost.toLocaleString()}` : ''}
${data.roas ? `ROAS: ${data.roas.toFixed(2)}x` : ''}
${data.buyers ? `Buyers: ${data.buyers.toLocaleString()}` : ''}
${data.units ? `Units: ${data.units.toLocaleString()}` : ''}
${data.budget ? `Budget: $${data.budget.toLocaleString()}` : ''}
${data.spent ? `Spent: $${data.spent.toLocaleString()} (${data.budgetConsumedPct?.toFixed(1)}%)` : ''}
${data.daysElapsed ? `Days: ${data.daysElapsed} of ${data.totalDays} (${data.timeElapsedPct?.toFixed(1)}%)` : ''}
${data.completionRate ? `Completion Rate: ${data.completionRate.toFixed(1)}%` : ''}

${data.offers ? `Offers:\n${data.offers.map(o => `- ${o.tactic}: ROAS ${o.roas?.toFixed(2) || 'N/A'}x, ${o.buyers || 'N/A'} buyers, ${o.completionRate?.toFixed(1) || 'N/A'}% completion`).join('\n')}` : ''}

${data.pre ? `
Promo Analysis (${data.promoType || 'Promotion'}):
Pre-Period: Sales $${data.pre.sales?.toLocaleString()}, ROAS ${data.pre.roas?.toFixed(2)}x
During: Sales $${data.during.sales?.toLocaleString()} (${data.during.salesChange >= 0 ? '+' : ''}${data.during.salesChange?.toFixed(1)}%), ROAS ${data.during.roas?.toFixed(2)}x
Post: Sales $${data.post.sales?.toLocaleString()} (${data.post.salesChange >= 0 ? '+' : ''}${data.post.salesChange?.toFixed(1)}%), ROAS ${data.post.roas?.toFixed(2)}x
` : ''}`;
}

function buildUserPrompt(data, analysisType, chatHistory) {
  // If there's chat history, this is a follow-up question
  if (chatHistory && chatHistory.length > 0) {
    return data.question || 'Continue the analysis.';
  }

  if (analysisType === 'overview') {
    return `Analyze this campaign and provide:
1. Quick health assessment (1-2 sentences)
2. Top strength to highlight in a client call
3. Top concern or opportunity
4. One specific upsell or optimization recommendation

Keep it to 3-4 short paragraphs.`;
  }

  if (analysisType === 'pacing') {
    return `Analyze the budget pacing:
1. Is the pacing healthy or concerning? Why?
2. What should I tell the client about trajectory?
3. Is there an upsell opportunity (extension, budget increase)?
4. Any red flags to watch?

${data.hasSpendThreshold ? 'Note: This has spend threshold offers which pace slower early.' : ''}

Keep it to 3-4 short paragraphs.`;
  }

  if (analysisType === 'conversion') {
    return `Analyze the conversion funnel:
1. Is the completion rate healthy? What's causing drop-off?
2. How much more valuable are redeemers vs buyers?
3. Which offer structure is working best?
4. One recommendation to improve conversion.

Keep it to 3-4 short paragraphs.`;
  }

  if (analysisType === 'promo') {
    return `Analyze the promotional period performance:
1. Did the promo drive meaningful lift?
2. Did gains stick post-promo or was it just deal-seeking?
3. Was the incremental spend worth it?
4. Should they participate in the next promo?

Keep it to 3-4 short paragraphs.`;
  }

  if (analysisType === 'chat') {
    return data.question || 'What would you like to know about this campaign?';
  }

  return 'Provide a brief analysis of this campaign with actionable insights.';
}
