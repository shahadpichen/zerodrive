/**
 * Credits Routes
 * API endpoints for managing user credits
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { asyncHandler, ApiErrors } from '../middleware/errorHandler';
import { getBalance, getTransactionHistory } from '../utils/creditOperations';
import { CreditBalanceResponse } from '../types';

const router = Router();

// Validation schemas
const getUserIdSchema = Joi.object({
  userId: Joi.string().required()
});

const getTransactionHistorySchema = Joi.object({
  userId: Joi.string().required(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * GET /api/credits/balance/:userId
 * Get user's current credit balance
 */
router.get('/balance/:userId', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters
  const { error, value } = getUserIdSchema.validate(req.params);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { userId } = value;

  try {
    const balance = await getBalance(userId);

    const response: CreditBalanceResponse = {
      user_id: userId,
      balance: balance
    };

    res.apiSuccess(response, 'Credit balance retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw ApiErrors.NotFound(`User ${userId} not found`);
    }
    throw ApiErrors.InternalServer('Failed to retrieve credit balance');
  }
}));

/**
 * GET /api/credits/transactions/:userId
 * Get user's credit transaction history
 */
router.get('/transactions/:userId', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters and query
  const { error: paramError, value: paramValue } = getUserIdSchema.validate(req.params);
  if (paramError) {
    throw ApiErrors.ValidationError(paramError.details[0].message);
  }

  const querySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
  });

  const { error: queryError, value: queryValue } = querySchema.validate(req.query);
  if (queryError) {
    throw ApiErrors.ValidationError(queryError.details[0].message);
  }

  const { userId } = paramValue;
  const { limit, offset } = queryValue;

  try {
    const transactions = await getTransactionHistory(userId, limit, offset);

    res.apiSuccess({
      transactions,
      count: transactions.length
    }, 'Transaction history retrieved successfully');
  } catch (error) {
    throw ApiErrors.InternalServer('Failed to retrieve transaction history');
  }
}));

export default router;
