import 'dotenv/config';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 5000);

/**
 * Requests an AI draft response from the Google Gemini API.
 * Returns null if the provider key is missing, call times out, or error occurs.
 *
 * @param {Array<{ id: number, name: string, category: string, price: number, stock: number, description: string }>} candidates
 * @param {string} question
 * @param {object} [options]
 * @returns {Promise<{ answer: string, recommendedProductIds: number[] } | null>}
 */
export async function generateAssistantDraft(candidates, question, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }

  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const systemInstruction = `You are ShopSmart's grounded product recommendation assistant.
Your goal is to help customers choose products based ONLY on the catalog facts provided.
Strict Rules:
1. ONLY recommend products from the provided catalog list. NEVER invent or assume any products, specifications, or prices.
2. If no products in the list meet the customer's request, state that clearly and honestly.
3. Recommend at most 3 relevant products.
4. Keep the answer concise (1 to 3 sentences) and mention actual product prices in Philippine Pesos (₱).
5. Output MUST be valid JSON adhering strictly to this format:
{
  "answer": "Concise natural explanation of the recommendation based solely on the catalog facts",
  "recommendedProductIds": [ids of products you recommend]
}`;

  const userPrompt = `Customer Question: "${question}"

Available In-Stock Catalog Products:
${JSON.stringify(candidates, null, 2)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      console.warn(`[Assistant Provider] Provider responded with HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed.answer !== 'string') return null;

    return {
      answer: parsed.answer.trim(),
      recommendedProductIds: Array.isArray(parsed.recommendedProductIds)
        ? parsed.recommendedProductIds.map(Number).filter((id) => !Number.isNaN(id))
        : []
    };
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.warn(`[Assistant Provider] Request timed out after ${timeoutMs}ms`);
    } else {
      console.warn(`[Assistant Provider] Draft generation failed: ${error.message}`);
    }
    return null;
  }
}
