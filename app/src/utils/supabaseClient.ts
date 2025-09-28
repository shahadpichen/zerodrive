/**
 * Supabase compatibility wrapper
 * This file provides a compatibility layer for existing code that uses Supabase,
 * but redirects all calls to our new self-hosted backend API.
 */

import apiClient from './apiClient';

// Mock Supabase-like interface that uses our apiClient
const supabase = {
  from: (table: string) => {
    if (table === 'public_keys') {
      return {
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            single: async () => {
              try {
                const result = await apiClient.publicKeys.get(value);
                return { data: result, error: null };
              } catch (error) {
                return { data: null, error };
              }
            }
          })
        }),
        upsert: async (data: any) => {
          try {
            const result = await apiClient.publicKeys.upsert(
              data.user_id || data.hashed_email_identifier, 
              data.public_key || JSON.stringify(data.public_key_jwk)
            );
            return { data: result, error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      };
    }
    
    if (table === 'shared_files') {
      return {
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            order: (orderBy: string, options?: any) => ({
              async then(resolve: any) {
                try {
                  const result = await apiClient.sharedFiles.getForUser(value);
                  resolve({ data: result.files, error: null });
                } catch (error) {
                  resolve({ data: null, error });
                }
              }
            })
          })
        }),
        insert: async (data: any) => {
          try {
            const result = await apiClient.sharedFiles.create({
              file_id: data.encrypted_file_blob_id || data.file_id,
              owner_user_id: data.sender_email_hash || data.owner_user_id,
              recipient_user_id: data.recipient_email_hash || data.recipient_user_id,
              encrypted_file_key: data.encrypted_file_key,
              file_name: data.file_name,
              file_size: data.file_size || 0,
              mime_type: data.file_mime_type || data.mime_type,
              access_type: 'view'
            });
            return { data: result, error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      };
    }
    
    // Return a mock for unknown tables
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      insert: async () => ({ data: null, error: null }),
      upsert: async () => ({ data: null, error: null })
    };
  }
};

export default supabase;
