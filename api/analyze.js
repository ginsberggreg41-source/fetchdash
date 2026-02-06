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

    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!geminiKey && !anthropicKey) {
      return new Response(
        JSON.stringify({
          error:
            'No API key configured. Add GEMINI_API_KEY to Vercel environment variables (or ANTHROPIC_API_KEY for fallback).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(campaignData || {});
    const userPrompt = buildUserPrompt(campaignData || {}, analysisType, chatHistory);

    let aiResponse = '';

    // Prefer Gemini, fallback to Anthropic if Gemini fails AND Anthropic key exists
    if (geminiKey) {
      try {
        aiResponse = await callGemini(geminiKey, systemPrompt, userPrompt, chatHistory);
      } catch (err) {
        console.error('Gemini failed, will try Anthropic if available:', err?.message || err);
        if (anthropicKey) {
          aiResponse = await callAnthropic(anthropicKey, systemPrompt, userPrompt);
        } else {
          throw err;
        }
      }
    } else {
      aiResponse = await callAnthropic(anthropicKey, systemPrompt, userPrompt);
    }

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

async function callGemini(apiKey, systemPrompt, userPrompt, chatHistory = []) {
  // IMPORTANT: Use a model that appears in your ListModels output.
  // Your sanity check includes: models/gemini-2.5-flash
  const model = 'gemini-2.5-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Gemini uses roles: "user" and "model"
  const contents = [
    ...(Array.isArray(chatHistory) ? chatHistory : []).map((msg) => ({
      role: msg?.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(msg?.content ?? '') }],
    })),
    { role: 'user', parts: [{ text: String(userPrompt ?? '') }] },
  ];

  const body = {
    systemInstruction: { parts: [{ text: String(systemPrompt ?? '') }] },
    contents,
    generationConfig: {
      temperature: 0.12, // lower = more consistent / less rambly
      maxOutputTokens: 700,
      candidateCount: 1,
      topP: 0.95,
    },
  };

  // Debug logs (keep while tuning; remove later if you want)
  console.log('Gemini URL:', url);
  console.log('Gemini gen config:', body.generationConfig);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error('Gemini API error raw:', raw);
    throw new Error(`Gemini failed (${response.status}): ${raw}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Gemini invalid JSON:', raw);
    throw new Error('Invalid JSON from Gemini');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('Gemini response missing text:', data);
    throw new Error('No text candidate returned from Gemini');
  }

  return String(text).trim();
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
  return `You are an expert Fetch Rewards account manager and campaign analyst. You help account managers understand campaign performance, identify optimization opportunities, and prepare for client conversations.

Strict output rules:
- Return exactly 3 short paragraphs (each 1–2 sentences).
- Plain text only. No bullet points unless the user explicitly asks.
- Use specific numbers from the data when available.
- Focus on what matters for a client conversation.
- Include ONE concrete optimization or upsell recommendation in paragraph 3.

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

${
  Array.isArray(data.offers) && data.offers.length > 0
    ? `Offers:
${data.offers
  .map(
    (o) =>
      `- ${o.tactic || 'Offer'}: ROAS ${o.roas != null ? Number(o.roas).toFixed(2) : 'N/A'}x, ${o.buyers != null ? Number(o.buyers).toLocaleString() : 'N/A'} buyers, ${o.completionRate != null ? Number(o.completionRate).toFixed(1) : 'N/A'}% completion`
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
    return `Give an executive campaign overview for a client call.`;
  }

  if (analysisType === 'pacing') {
    return `Analyze budget pacing and what to tell the client about trajectory. ${
      data.hasSpendThreshold ? 'This campaign includes spend-threshold offers that may pace slower early.' : ''
    }`;
  }

  if (analysisType === 'conversion') {
    return `Analyze the conversion funnel and what to change to improve completion rate and performance.`;
  }

  if (analysisType === 'promo') {
    return `Analyze promo period performance: lift, durability post-promo, and whether to participate next time.`;
  }

  if (analysisType === 'chat') {
    return data.question || 'What would you like to know about this campaign?';
  }

  return 'Provide a brief analysis of this campaign with actionable insights.';
}
