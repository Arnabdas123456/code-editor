import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ProjectFile } from '../types/database';

export interface CodeChunk {
  filePath: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
}

export interface RetrievedContext {
  filePath: string;
  content: string;
  similarity: number;
  startLine: number;
  endLine: number;
}

/**
 * Split source files into overlapping chunks suitable for semantic search and context retrieval.
 */
export function chunkFile(filePath: string, content: string, chunkSize = 60, overlap = 15): CodeChunk[] {
  const lines = content.split('\n');
  if (lines.length <= chunkSize) {
    return [
      {
        filePath,
        chunkIndex: 0,
        startLine: 1,
        endLine: lines.length,
        content,
      },
    ];
  }

  const chunks: CodeChunk[] = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + chunkSize, lines.length);
    const chunkContent = lines.slice(start, end).join('\n');
    chunks.push({
      filePath,
      chunkIndex,
      startLine: start + 1,
      endLine: end,
      content: chunkContent,
    });
    chunkIndex++;
    if (end >= lines.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Compute Gemini text embedding for a snippet of code or prompt
 */
export async function getGeminiEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = 'text-embedding-004';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: `models/${model}`,
      content: {
        parts: [{ text: text.slice(0, 8000) }],
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding generation failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    embedding?: { values?: number[] };
  };

  const values = json.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Gemini returned empty embedding values');
  }

  return values;
}

/**
 * Calculate Cosine Similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Indexes project files into the project_embeddings table
 */
export async function indexProjectFiles(
  supabase: SupabaseClient<Database>,
  projectId: string,
  files: ProjectFile[]
): Promise<{ indexed: number; error: Error | null }> {
  try {
    const codeFiles = files.filter(
      (f) =>
        !f.is_folder &&
        !f.path.includes('package-lock.json') &&
        !f.path.includes('node_modules') &&
        f.content &&
        f.content.trim().length > 0
    );

    let totalIndexed = 0;

    for (const file of codeFiles) {
      const chunks = chunkFile(file.path, file.content);

      for (const chunk of chunks) {
        try {
          const embedding = await getGeminiEmbedding(
            `File: ${chunk.filePath}\nContent:\n${chunk.content}`
          );

          await (supabase as any).from('project_embeddings').upsert(
            {
              project_id: projectId,
              file_id: file.id,
              chunk_index: chunk.chunkIndex,
              content: chunk.content,
              embedding: embedding,
              metadata: {
                path: chunk.filePath,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
              },
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'project_id,file_id,chunk_index' }
          );

          totalIndexed++;
        } catch (e) {
          // If embedding fails for one chunk, continue with others
          console.warn(`[RAG] Failed to embed chunk ${chunk.chunkIndex} for ${chunk.filePath}:`, e);
        }
      }
    }

    return { indexed: totalIndexed, error: null };
  } catch (err) {
    return { indexed: 0, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Retrieve the most semantically relevant file chunks for a given prompt/task
 */
export async function retrieveContextForPrompt(
  supabase: SupabaseClient<Database>,
  projectId: string,
  prompt: string,
  limit = 5
): Promise<RetrievedContext[]> {
  try {
    const queryEmbedding = await getGeminiEmbedding(prompt);

    const { data: rows, error } = await (supabase as any)
      .from('project_embeddings')
      .select('id, content, embedding, metadata')
      .eq('project_id', projectId);

    if (error || !rows || rows.length === 0) {
      return [];
    }

    const scored: RetrievedContext[] = [];

    for (const row of rows) {
      if (!row.embedding || !Array.isArray(row.embedding)) continue;
      const sim = cosineSimilarity(queryEmbedding, row.embedding);
      const meta = row.metadata || {};
      scored.push({
        filePath: meta.path || 'unknown',
        content: row.content,
        similarity: sim,
        startLine: meta.startLine || 1,
        endLine: meta.endLine || 1,
      });
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  } catch (err) {
    console.warn('[RAG] Retrieval failed, falling back to static context:', err);
    return [];
  }
}
