import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { memoryStore } from '../lib/memoryDb.js';
import { buildAssistantResponse } from '../services/assistant.js';
import { assistantQuestionSchema } from '../validators/schemas.js';

const router = Router();

const assistantLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

router.post('/questions', assistantLimiter, async (request, response, next) => {
  try {
    const parsed = assistantQuestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(422).json({
        error: {
          code: 'INVALID_QUESTION',
          message: 'Question must contain between 3 and 300 characters.'
        }
      });
    }

    try {
      const products = await prisma.product.findMany({ where: { active: true }, orderBy: { price: 'asc' } });
      const assistantResult = await buildAssistantResponse(products, parsed.data.question);
      response.json(assistantResult);
    } catch {
      const products = [...memoryStore.products.filter((p) => p.active)].sort((a, b) => a.price - b.price);
      const assistantResult = await buildAssistantResponse(products, parsed.data.question);
      response.json(assistantResult);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
