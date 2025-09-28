/**
 * PostgreSQL Database Configuration (TypeScript)
 */

import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import logger from '../utils/logger';
import { DatabaseConfig, QueryResult } from '../types';

// Database configuration
const dbConfig: DatabaseConfig = {
  user: process.env.DB_USER || 'zerodrive_app',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zerodrive',
  password: process.env.DB_PASSWORD || 'localdev123',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  // SSL configuration (disable for local development)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err: Error) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Handle pool connection events
pool.on('connect', () => {
  logger.debug('Connected to PostgreSQL database');
});

/**
 * Test database connection
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    
    const timeResult = result.rows[0].current_time;
    const versionParts = result.rows[0].version.split(' ');
    const version = `${versionParts[0]} ${versionParts[1]}`;
    
    logger.info('Database connection successful', {
      time: timeResult,
      version
    });
    
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection failed', error as Error);
    return false;
  }
};

/**
 * Execute a database query with error handling and logging
 */
export const query = async <T extends Record<string, any> = any>(
  text: string, 
  params: any[] = []
): Promise<QueryResult<T>> => {
  const start = Date.now();
  
  try {
    const result: PgQueryResult<T> = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.query(text, duration, result.rowCount || 0);
    
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      command: result.command,
      oid: result.oid,
      fields: result.fields
    };
  } catch (error) {
    const duration = Date.now() - start;
    const err = error as Error;
    
    logger.queryError(text, duration, err);
    throw err;
  }
};

/**
 * Get a client from the pool for transactions
 */
export const getClient = async (): Promise<PoolClient> => {
  try {
    return await pool.connect();
  } catch (error) {
    logger.error('Failed to get database client', error as Error);
    throw error;
  }
};

/**
 * Execute a transaction with automatic rollback on error
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    
    logger.debug('Transaction committed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', error as Error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Execute multiple queries in a transaction
 */
export const batchQuery = async <T extends Record<string, any> = any>(
  queries: Array<{ text: string; params?: any[] }>
): Promise<QueryResult<T>[]> => {
  return transaction(async (client) => {
    const results: QueryResult<T>[] = [];
    
    for (const { text, params = [] } of queries) {
      const start = Date.now();
      
      try {
        const result: PgQueryResult<T> = await client.query(text, params);
        const duration = Date.now() - start;
        
        logger.query(text, duration, result.rowCount || 0);
        
        results.push({
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command,
          oid: result.oid,
          fields: result.fields
        });
      } catch (error) {
        const duration = Date.now() - start;
        logger.queryError(text, duration, error as Error);
        throw error;
      }
    }
    
    return results;
  });
};

/**
 * Close the database pool gracefully
 */
export const closePool = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool', error as Error);
  }
};

// Handle process termination
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

// Export pool for direct access if needed
export { pool };

// Default export
const database = {
  pool,
  query,
  getClient,
  transaction,
  batchQuery,
  testConnection,
  closePool
};

export default database;