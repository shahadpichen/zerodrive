/**
 * Credit Operations Utility
 * Handles credit balance checks, deductions, and transaction logging
 */

import { query } from '../config/database';
import { CreditTransaction } from '../types';

// Credit cost constants
export const COST_FILE_SHARE = 1.0;      // 1 credit per file share
export const COST_EMAIL_NOTIFICATION = 0.5;  // 0.5 credit per email notification

// Transaction types
export const TRANSACTION_TYPE = {
  FILE_SHARE: 'file_share',
  EMAIL_NOTIFICATION: 'email_notification',
  INITIAL_CREDIT: 'initial_credit',
  ADMIN_GRANT: 'admin_grant',
  PURCHASE: 'purchase',
  PROMO_CODE: 'promo_code'
} as const;

/**
 * Get user's current credit balance
 */
export async function getBalance(userId: string): Promise<number> {
  const result = await query<{ credits: string }>(
    'SELECT credits FROM public_keys WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error(`User ${userId} not found`);
  }

  // PostgreSQL NUMERIC returns as string, convert to number
  return parseFloat(result.rows[0].credits);
}

/**
 * Check if user has sufficient credits
 */
export async function checkCredits(userId: string, requiredAmount: number): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= requiredAmount;
}

/**
 * Deduct credits from user's balance and log transaction
 * Returns the new balance after deduction
 */
export async function deductCredits(
  userId: string,
  amount: number,
  transactionType: string,
  metadata?: Record<string, any>
): Promise<number> {
  // Start transaction for atomic operation
  const client = await query('BEGIN');

  try {
    // 1. Check current balance
    const balanceResult = await query<{ credits: string }>(
      'SELECT credits FROM public_keys WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (balanceResult.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    const currentBalance = parseFloat(balanceResult.rows[0].credits);

    // 2. Check if sufficient credits
    if (currentBalance < amount) {
      throw new Error(
        `Insufficient credits. Required: ${amount}, Available: ${currentBalance}`
      );
    }

    // 3. Deduct credits
    const newBalance = currentBalance - amount;
    await query(
      'UPDATE public_keys SET credits = $1 WHERE user_id = $2',
      [newBalance, userId]
    );

    // 4. Log transaction
    await query<CreditTransaction>(
      `INSERT INTO credit_transactions (user_id, amount, transaction_type, balance_after, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, -amount, transactionType, newBalance, metadata ? JSON.stringify(metadata) : null]
    );

    // 5. Commit transaction
    await query('COMMIT');

    return newBalance;
  } catch (error) {
    // Rollback on error
    await query('ROLLBACK');
    throw error;
  }
}

/**
 * Add credits to user's balance (for purchases, promo codes, etc.)
 * Returns the new balance after addition
 */
export async function addCredits(
  userId: string,
  amount: number,
  transactionType: string,
  metadata?: Record<string, any>
): Promise<number> {
  // Start transaction for atomic operation
  const client = await query('BEGIN');

  try {
    // 1. Get current balance
    const balanceResult = await query<{ credits: string }>(
      'SELECT credits FROM public_keys WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (balanceResult.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    const currentBalance = parseFloat(balanceResult.rows[0].credits);

    // 2. Add credits
    const newBalance = currentBalance + amount;
    await query(
      'UPDATE public_keys SET credits = $1 WHERE user_id = $2',
      [newBalance, userId]
    );

    // 3. Log transaction
    await query<CreditTransaction>(
      `INSERT INTO credit_transactions (user_id, amount, transaction_type, balance_after, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, amount, transactionType, newBalance, metadata ? JSON.stringify(metadata) : null]
    );

    // 4. Commit transaction
    await query('COMMIT');

    return newBalance;
  } catch (error) {
    // Rollback on error
    await query('ROLLBACK');
    throw error;
  }
}

/**
 * Get transaction history for a user
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CreditTransaction[]> {
  const result = await query<CreditTransaction>(
    `SELECT * FROM credit_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows.map(row => ({
    ...row,
    amount: parseFloat(row.amount as any),
    balance_after: parseFloat(row.balance_after as any)
  }));
}
