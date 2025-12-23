/**
 * Memory Search Utility
 * 
 * Uses MiniSearch for local semantic search on memory blocks.
 * Excludes conversation_patterns from search results.
 */

import MiniSearch from 'minisearch';
import type { MemoryBlock } from '../types';

// Blocks to exclude from semantic search
const EXCLUDED_BLOCKS = ['conversation_patterns'];

/**
 * Search memory blocks using MiniSearch for relevance matching.
 * 
 * @param blocks - All available memory blocks
 * @param query - The search query (usually the user's input text)
 * @returns Relevant blocks sorted by relevance, or all searchable blocks if no query/no results
 */
export function searchMemoryBlocks(blocks: MemoryBlock[], query: string): MemoryBlock[] {
  // Filter out excluded blocks
  const searchableBlocks = blocks.filter(b => !EXCLUDED_BLOCKS.includes(b.label));
  
  // If no query or empty, return all searchable blocks
  if (!query?.trim()) {
    return searchableBlocks;
  }
  
  // Create MiniSearch index
  const miniSearch = new MiniSearch({
    fields: ['label', 'value'],      // Fields to index for full-text search
    storeFields: ['id', 'label'],    // Fields to return with search results
    searchOptions: {
      prefix: true,                   // Enable prefix matching (e.g., 'prog' matches 'programming')
      fuzzy: 0.2,                     // Enable fuzzy matching with 0.2 edit distance
      boost: { label: 2 }             // Boost label matches 2x over value matches
    }
  });
  
  // Index blocks with unique IDs
  miniSearch.addAll(searchableBlocks.map((b, index) => ({
    id: b.id || `block-${index}`,
    label: b.label,
    value: b.value
  })));
  
  // Search
  const results = miniSearch.search(query);
  
  // If no results, return all searchable blocks as fallback
  if (results.length === 0) {
    return searchableBlocks;
  }
  
  // Map results back to full block objects, maintaining relevance order
  const resultIds = new Set(results.map(r => r.id));
  return searchableBlocks.filter(b => resultIds.has(b.id));
}
