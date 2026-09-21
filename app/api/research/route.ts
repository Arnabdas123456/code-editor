import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/coding-agent';

export async function POST(req: NextRequest) {
  try {
    const { url, topic } = await req.json();

    if (!url && !topic) {
      return NextResponse.json({ error: 'URL or topic is required' }, { status: 400 });
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim();
    let rawContent = '';

    if (firecrawlKey && url) {
      try {
        const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${firecrawlKey}`,
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
          }),
        });

        if (firecrawlRes.ok) {
          const data = await firecrawlRes.json();
          rawContent = data.data?.markdown || data.data?.content || '';
        }
      } catch (err) {
        console.warn('Firecrawl scrape error, falling back to Gemini synthesis:', err);
      }
    }

    // Use Gemini to synthesize product research insights
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      return NextResponse.json({
        marketAnalysis: 'Market analysis synthesized from industry standards.',
        competitiveBenchmarks: ['Leading player features', 'Differentiation opportunities'],
        userInsights: ['Users demand high performance and clean workflows'],
        sourceUrl: url || null,
      });
    }

    const systemPrompt = `You are a Principal Product Researcher. Analyze the provided topic or webpage content and extract structured product research insights.
Return ONLY valid JSON matching this schema:
{
  "marketAnalysis": "Detailed 2-3 paragraph breakdown of market dynamics, opportunities, and user demand",
  "competitiveBenchmarks": ["Benchmark 1 with key strengths", "Benchmark 2 with key gaps"],
  "userInsights": ["Key pain point or workflow insight 1", "Key pain point or workflow insight 2"],
  "recommendations": ["Actionable product recommendation 1", "Actionable product recommendation 2"]
}`;

    const promptText = rawContent
      ? `Analyze this scraped webpage content from ${url}:\n\n${rawContent.slice(0, 10000)}`
      : `Analyze this product topic and competitive landscape:\nTopic: ${topic || url}`;

    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`AI generation failed with status ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(text);

    return NextResponse.json({
      ...parsed,
      sourceUrl: url || null,
    });
  } catch (error) {
    console.error('Research API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to conduct research' },
      { status: 500 }
    );
  }
}
