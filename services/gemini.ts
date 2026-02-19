
import { GoogleGenAI, Modality } from "@google/genai";
import process from 'process';

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

export const generateEpisodeMetadata = async (summary: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Based on this real-time AI news summary, generate a catchy, high-impact podcast episode title that is EXACTLY 10 to 12 words long.
  Focus on the most significant technical or market breakthrough from TODAY.
  
  Summary: ${summary}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { temperature: 0.8 }
  });

  return response.text?.trim().replace(/^"|"$/g, '') || "Daily AI Intelligence Briefing: The Latest Technical and Market Evolution Observed Today";
};

export const fetchAINews = async (categories: string[] = []): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const prompt = `Act as a senior technical intelligence analyst. 
  TODAY'S DATE IS: ${dateString}.
  
  TASK: Research and synthesize exactly 7 breaking AI developments from the last 24 to 48 hours. 
  
  STRICT RELEVANCE RULES:
  1. DO NOT include DeepSeek v3, o1-preview, or any news from more than 7 days ago.
  2. If the story isn't from ${now.getMonth() + 1}/${now.getDate() - 1} or ${now.getMonth() + 1}/${now.getDate()}, IGNORE IT.
  3. Reject 2024 news entirely.
  4. Focus on NEW weight releases, API version increments, GPU cluster expansions, and real-time market shifts.

  REPORTING STYLE:
  - Technical: Parameters, FLOPs, Latency, Throughput.
  - Sentiment: Aggregate consensus from Hacker News / X / GitHub from the LAST 12 HOURS.

  [METADATA] TOP_STORIES: (List 7 short headlines separated by commas)`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { 
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 }
    },
  });

  const text = response.text || "";
  const parts = text.split('[METADATA]');
  const report = parts[0] || "";
  const metadata = parts[1] || "";
  const topStories = metadata.match(/TOP_STORIES: (.*)/)?.[1]?.split(',') || ["Real-time AI Intelligence Update"];
  
  return {
    newsText: report.trim(),
    topStories: topStories.map(t => t.trim()).filter(t => t),
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
};

export const generatePodcastScript = async (newsSummary: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Write a 15-minute technical conversation script for "AI Daily Pulse".
  
  HOSTS:
  - Alex (Female): Skeptical Technical Architect. Focuses on "Can we actually deploy this?"
  - Marcus (Male): Strategic Visionary. Focuses on "How does this change the competitive landscape?"

  CONVERSATION FLOW:
  - DO NOT mention "pillars", "categories", or numbered lists.
  - Marcus leads with a breakdown of a new story, Alex pushes back with technical constraints.
  - Use natural segues like "That actually maps to the infra news we saw earlier..." or "Wait, before we move on, the latency numbers there are wild..."
  - MANDATORY: Use [TRANSITION] between major news items to help the production engine.

  DATA TO SYNTHESIZE:
  ${newsSummary}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { 
      maxOutputTokens: 6000,
      temperature: 0.7
    }
  });

  return response.text || "";
};

export const generateSegmentAudio = async (text: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanText = text
    .replace(/Sundaram/gi, 'Suun-duh-ruhm')
    .replace(/Labs/gi, 'Labbz')
    .replace(/\[.*?\]/g, '') 
    .trim();

  if (!cleanText) return [];

  const chunks: string[] = [];
  let remaining = cleanText;
  const MAX_CHUNK = 800;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK) {
      chunks.push(remaining);
      break;
    }
    let endIdx = remaining.lastIndexOf('.', MAX_CHUNK);
    if (endIdx === -1) endIdx = MAX_CHUNK;
    chunks.push(remaining.substring(0, endIdx + 1).trim());
    remaining = remaining.substring(endIdx + 1).trim();
  }

  const results: string[] = [];
  for (const chunk of chunks) {
    const data = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: chunk }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: 'Alex', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                { speaker: 'Marcus', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
              ]
            }
          }
        }
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    });
    if (data) results.push(data);
    await new Promise(r => setTimeout(r, 800));
  }
  return results;
};
