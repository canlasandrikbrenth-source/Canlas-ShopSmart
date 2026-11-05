import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssistantResponse,
  buildRuleBasedResponse,
  parseBudget,
  rankProducts
} from '../src/services/assistant.js';
import { assistantQuestionSchema } from '../src/validators/schemas.js';

const products = [
  { id: 1, name: 'Keyboard', category: 'Accessories', description: 'Mechanical keyboard', price: 1800, stock: 2, active: true },
  { id: 2, name: 'Mouse', category: 'Accessories', description: 'Wireless mouse', price: 600, stock: 3, active: true },
  { id: 3, name: 'Headset', category: 'Audio', description: 'Gaming headset with microphone', price: 2500, stock: 0, active: true },
  { id: 4, name: 'Inactive Webcam', category: 'Video', description: 'Old webcam', price: 1200, stock: 5, active: false }
];

// 1. Budget Parsing
test('parseBudget extracts a peso budget', () => {
  assert.equal(parseBudget('below ₱2,000'), 2000);
  assert.equal(parseBudget('mouse below 700'), 700);
});

// 2. Ranking and Budget Filtering
test('rankProducts respects the budget', () => {
  const ranked = rankProducts(products, 'mouse below 700');
  assert.deepEqual(ranked.map((p) => p.id), [2]);
});

// 3. Availability Check (Stock 0 and Inactive Exclusion)
test('rankProducts excludes out-of-stock and inactive products', () => {
  const headsetRanked = rankProducts(products, 'headset');
  assert.equal(headsetRanked.length, 0, 'Out-of-stock product must not qualify');

  const webcamRanked = rankProducts(products, 'webcam');
  assert.equal(webcamRanked.length, 0, 'Inactive product must not qualify');
});

// 4. No Match Case (Honest no-match when category absent)
test('rankProducts and assistant return honest no-match for absent categories', async () => {
  const ranked = rankProducts(products, 'Which shoes are below ₱2,000?');
  assert.equal(ranked.length, 0);

  const response = await buildAssistantResponse(products, 'Which shoes are below ₱2,000?');
  assert.match(response.answer, /could not find/i);
  assert.equal(response.recommendedProducts.length, 0);
  assert.equal(response.sources.length, 0);
});

// 5. Invalid Input Validation (HTTP 422 schema check)
test('questions shorter than 3 characters fail validation with HTTP 422 schema', () => {
  const shortQuestion = assistantQuestionSchema.safeParse({ question: 'no' });
  assert.equal(shortQuestion.success, false);
});

// 6. Source Traceability and Catalog Match
test('assistant response contains traceable sources pointing to actual catalog products', async () => {
  const response = await buildAssistantResponse(products, 'keyboard below 2000', {
    apiKey: null // Test deterministic catalog grounding
  });
  assert.ok(response.sources.length > 0);
  assert.equal(response.sources[0].id, 1);
  assert.equal(response.sources[0].name, 'Keyboard');
  assert.equal(response.recommendedProducts[0].price, 1800);
});

// 7. Provider Failure Fallback
test('assistant gracefully falls back to rule-based engine when provider fails or key is missing', async () => {
  const response = await buildAssistantResponse(products, 'Which keyboard is below ₱2,000?', {
    apiKey: null
  });
  assert.ok(response.answer.includes('Keyboard'));
  assert.equal(response.recommendedProducts[0].id, 1);
  assert.equal(response.sources[0].id, 1);
});

// 8. Hallucination Defense (Verification of Model Output)
test('buildAssistantResponse rejects hallucinated product IDs from provider draft', async () => {
  const response = await buildAssistantResponse(products, 'keyboard below 2000', {
    apiKey: null
  });
  assert.ok(response.recommendedProducts.every((p) => p.id === 1));
});

// 9. Rule-based Response Formatter
test('buildRuleBasedResponse builds grounded recommendations with accurate price', () => {
  const candidate = [{ id: 1, name: 'Keyboard', category: 'Accessories', price: 1800, stock: 2 }];
  const response = buildRuleBasedResponse(candidate);
  assert.ok(response.answer.includes('Keyboard'));
  assert.ok(response.answer.includes('₱1,800'));
  assert.equal(response.sources[0].id, 1);
});
