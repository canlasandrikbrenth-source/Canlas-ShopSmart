import { generateAssistantDraft } from './aiProvider.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'is', 'was', 'with', 'from', 'which', 'what',
  'where', 'when', 'who', 'how', 'can', 'you', 'give', 'show', 'recommend',
  'find', 'looking', 'below', 'under', 'above', 'than', 'more', 'less',
  'cheaper', 'cheap', 'best', 'good', 'budget', 'price', 'peso', 'pesos',
  'php', 'item', 'items', 'product', 'products', 'store', 'shop', 'have',
  'any', 'some', 'there', 'please', 'tell'
]);

/**
 * Extracts a numeric Philippine Peso budget from a customer question.
 * @param {string} question
 * @returns {number|null}
 */
export function parseBudget(question) {
  const normalized = question.replaceAll(',', '');
  const match = normalized.match(/(?:₱|php\s*)?(\d{2,6})(?:\.\d{1,2})?/i);
  return match ? Number(match[1]) : null;
}

/**
 * Retrieves and ranks active, in-stock catalog products matching the question.
 * Excludes out-of-stock items, inactive items, and items exceeding the customer budget.
 *
 * @param {Array<object>} products
 * @param {string} question
 * @returns {Array<object>}
 */
export function rankProducts(products, question) {
  const allTerms = question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const keywords = allTerms.filter((term) => !STOP_WORDS.has(term) && !/^\d+$/.test(term));
  const budget = parseBudget(question);

  return products
    .filter((product) => {
      const isActive = product.active !== false;
      const inStock = Number(product.stock) > 0;
      const withinBudget = budget === null || Number(product.price) <= budget;
      return isActive && inStock && withinBudget;
    })
    .map((product) => {
      const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
      // Count matches from keywords; if no keywords, count all terms
      const termsToMatch = keywords.length > 0 ? keywords : allTerms;
      const score = termsToMatch.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        price: Number(product.price),
        stock: Number(product.stock),
        score
      };
    })
    .filter((product) => {
      // If specific search keywords were present, require at least one match
      if (keywords.length > 0) return product.score > 0;
      return true;
    })
    .sort((a, b) => b.score - a.score || a.price - b.price);
}

/**
 * Builds a deterministic, catalog-grounded response using rule-based templates.
 * Used when the AI provider is unavailable, times out, or fails verification.
 *
 * @param {Array<object>} candidates
 * @returns {{ answer: string, recommendedProducts: Array<object>, sources: Array<object> }}
 */
export function buildRuleBasedResponse(candidates) {
  if (!candidates || candidates.length === 0) {
    return {
      answer: 'I could not find an in-stock product matching that request.',
      recommendedProducts: [],
      sources: []
    };
  }

  const primary = candidates[0];
  const formattedPrice = `₱${primary.price.toLocaleString('en-PH')}`;
  let answer = `I recommend the ${primary.name} for ${formattedPrice}. It is currently in stock.`;

  if (candidates.length > 1) {
    const additional = candidates.slice(1).map((p) => `${p.name} (₱${p.price.toLocaleString('en-PH')})`).join(', ');
    answer += ` Other matching options include: ${additional}.`;
  }

  return {
    answer,
    recommendedProducts: candidates.map(({ id, name, price, category }) => ({
      id,
      name,
      price: Number(price),
      category
    })),
    sources: candidates.map(({ id, name }) => ({
      type: 'product',
      id,
      name
    }))
  };
}

/**
 * Builds the assistant response by retrieving qualified catalog candidates,
 * requesting an AI drafted answer, and verifying all references against authoritative catalog data.
 *
 * @param {Array<object>} products Authoritative catalog products
 * @param {string} question Customer inquiry
 * @param {object} [options] Provider options (e.g. for testing)
 * @returns {Promise<{ answer: string, recommendedProducts: Array<object>, sources: Array<object> }>}
 */
export async function buildAssistantResponse(products, question, options = {}) {
  // Step 1: Catalog retrieval & filtering
  const ranked = rankProducts(products, question);
  const candidates = ranked.slice(0, 3);

  // If no products qualify, return honest no-match immediately without calling the provider
  if (candidates.length === 0) {
    return {
      answer: 'I could not find an in-stock product matching that request.',
      recommendedProducts: [],
      sources: []
    };
  }

  // Step 2: Request AI draft if provider is available
  const draft = await generateAssistantDraft(candidates, question, options);

  // Step 3: Verify draft and prevent hallucinated products
  if (draft && typeof draft.answer === 'string' && draft.answer.trim().length > 0) {
    // Only permit recommended IDs that exist in our server-verified candidate set
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const verifiedIds = draft.recommendedProductIds.filter((id) => candidateMap.has(id));

    // If the model identified valid candidates, verify and ground the output
    if (verifiedIds.length > 0) {
      const recommendedProducts = verifiedIds.map((id) => {
        const prod = candidateMap.get(id);
        return {
          id: prod.id,
          name: prod.name,
          price: Number(prod.price),
          category: prod.category
        };
      });

      const sources = verifiedIds.map((id) => {
        const prod = candidateMap.get(id);
        return {
          type: 'product',
          id: prod.id,
          name: prod.name
        };
      });

      return {
        answer: draft.answer,
        recommendedProducts,
        sources
      };
    }
  }

  // Step 4: Fallback to grounded rule-based engine if provider failed or output was invalid
  return buildRuleBasedResponse(candidates);
}
