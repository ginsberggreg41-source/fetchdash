// Vercel Serverless Function (Edge Runtime)
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

    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({
          error:
            'No API key configured. Add ANTHROPIC_API_KEY to Vercel environment variables.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(campaignData || {});
    const userPrompt = buildUserPrompt(campaignData || {}, analysisType, chatHistory);

    const aiResponse = await callAnthropic(anthropicKey, systemPrompt, userPrompt, chatHistory);

    return new Response(JSON.stringify({ analysis: aiResponse }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to get AI analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function callAnthropic(apiKey, systemPrompt, userPrompt, chatHistory = []) {
  // Build messages array with chat history
  const messages = [
    ...(Array.isArray(chatHistory) ? chatHistory : []).map((msg) => ({
      role: msg?.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg?.content ?? ''),
    })),
    { role: 'user', content: String(userPrompt ?? '') },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error('Anthropic API error raw:', raw);
    throw new Error(`Anthropic failed (${response.status}): ${raw}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Anthropic invalid JSON:', raw);
    throw new Error('Invalid JSON from Anthropic');
  }

  return String(data?.content?.[0]?.text ?? '').trim();
}

function buildSystemPrompt(data) {
  return `You are a senior Fetch Rewards campaign strategist who helps account managers prepare for client conversations. You combine deep knowledge of retail media, CPG marketing, and Fetch's platform with the specific campaign data provided.

Your strengths:
- You know CPG industry benchmarks (typical ROAS ranges, CAC by category, completion rates)
- You understand Fetch offer mechanics: acquisition (NCE, Competitive/Conquest) vs. brand buyer (Loyalist, Lapsed) segments
- You know that spend-threshold offers pace slower in weeks 1-4 and that's expected
- You can research and contextualize brands — their market position, competitive landscape, seasonal trends
- You give advice that sounds like a seasoned account manager, not a generic AI

Response style:
- Be direct and specific. Use numbers from the data.
- For initial analyses: 2-3 focused paragraphs, each making a distinct point.
- For follow-up questions: answer naturally — be concise for simple questions, go deeper when asked.
- Bold key metrics and takeaways using **markdown**.
- When recommending optimizations, explain the "why" and expected impact.
- If asked about the brand, draw on your knowledge of the CPG/retail landscape.
- Never hedge with "I don't have enough data" — work with what's provided and flag assumptions clearly.

Current Campaign Context:
Campaign: ${data.campaignName || 'Unknown'}
${data.dateRange ? `Period: ${data.dateRange}` : ''}
${data.sales != null ? `Total Sales: $${Number(data.sales).toLocaleString()}` : ''}
${data.cost != null ? `Total Spend: $${Number(data.cost).toLocaleString()}` : ''}
${data.roas != null ? `ROAS: ${Number(data.roas).toFixed(2)}x` : ''}
${data.buyers != null ? `Buyers: ${Number(data.buyers).toLocaleString()}` : ''}
${data.units != null ? `Units: ${Number(data.units).toLocaleString()}` : ''}
${data.budget != null ? `Budget: $${Number(data.budget).toLocaleString()}` : ''}
${data.spent != null ? `Spent: $${Number(data.spent).toLocaleString()}${data.budgetConsumedPct != null ? ` (${Number(data.budgetConsumedPct).toFixed(1)}%)` : ''}` : ''}
${data.daysElapsed != null && data.totalDays != null ? `Days: ${data.daysElapsed} of ${data.totalDays}${data.timeElapsedPct != null ? ` (${Number(data.timeElapsedPct).toFixed(1)}%)` : ''}` : ''}
${data.completionRate != null ? `Completion Rate: ${Number(data.completionRate).toFixed(1)}%` : ''}
${data.recentDailySpend != null ? `Recent Daily Spend (14d avg): $${Number(data.recentDailySpend).toLocaleString()}` : ''}
${data.hasSpendThreshold ? `Note: Campaign includes spend-threshold offers (expect slower early pacing)` : ''}

${
  Array.isArray(data.offers) && data.offers.length > 0
    ? `Offers:\n${data.offers
  .map(
    (o) =>
      `- ${o.tactic || 'Offer'}: ROAS ${o.roas != null ? Number(o.roas).toFixed(2) : 'N/A'}x, ${o.buyers != null ? Number(o.buyers).toLocaleString() : 'N/A'} buyers, ${o.completionRate != null ? Number(o.completionRate).toFixed(1) : 'N/A'}% completion${o.isAcquisitionTactic ? ' [Acquisition]' : ''}${o.isBrandBuyerTactic ? ' [Brand Buyer]' : ''}`
  )
  .join('\n')}`
    : ''
}

${
  data.pre && data.during && data.post
    ? `Promo Analysis (${data.promoType || 'Promotion'}):
Pre-Period: Sales $${Number(data.pre.sales ?? 0).toLocaleString()}, ROAS ${data.pre.roas != null ? Number(data.pre.roas).toFixed(2) : 'N/A'}x
During: Sales $${Number(data.during.sales ?? 0).toLocaleString()} (${data.during.salesChange != null ? `${data.during.salesChange >= 0 ? '+' : ''}${Number(data.during.salesChange).toFixed(1)}%` : 'N/A'}), ROAS ${data.during.roas != null ? Number(data.during.roas).toFixed(2) : 'N/A'}x
Post: Sales $${Number(data.post.sales ?? 0).toLocaleString()} (${data.post.salesChange != null ? `${data.post.salesChange >= 0 ? '+' : ''}${Number(data.post.salesChange).toFixed(1)}%` : 'N/A'}), ROAS ${data.post.roas != null ? Number(data.post.roas).toFixed(2) : 'N/A'}x`
    : ''
}`;
}

function buildUserPrompt(data, analysisType, chatHistory) {
  // If there's chat history, this is a follow-up question
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    return data.question || 'Continue the analysis based on the latest question.';
  }

  if (analysisType === 'overview') {
    return `Give me an executive campaign overview I can use on a client call. Hit the key metrics, call out what's working and what needs attention, and end with a clear recommendation.`;
  }

  if (analysisType === 'pacing') {
    return `Analyze budget pacing and trajectory. Tell me if we're on track, what the projected end date looks like, and what I should proactively communicate to the client. ${
      data.hasSpendThreshold ? 'This campaign includes spend-threshold offers — factor in expected slower early pacing.' : ''
    }`;
  }

  if (analysisType === 'conversion') {
    return `Analyze the conversion funnel — from audience to buyers to redeemers. Identify where the biggest drop-offs are, what's driving them, and give me 1-2 specific things we could change to improve performance.`;
  }

  if (analysisType === 'promo') {
    return `Analyze the promo period performance. Break down the lift during the promo, whether it sustained post-promo, and give me a clear recommendation on whether to participate next time and what to adjust.`;
  }

  if (analysisType === 'chat') {
    return data.question || 'What would you like to know about this campaign?';
  }

  return 'Give me a quick strategic read on this campaign — what stands out, what I should flag for the client, and one thing to optimize.';
}
