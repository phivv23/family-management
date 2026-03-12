export type SupabaseLikeError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
} | null;

export function assertSupabaseQuery<T>(label: string, data: T, error: SupabaseLikeError): T {
  if (error) {
    console.error(`${label} failed`, {
      code: error.code ?? null,
      message: error.message ?? 'Unknown error',
      details: error.details ?? null,
      hint: error.hint ?? null,
    });
    throw new Error(`${label}: ${error.message ?? 'Query failed'}`);
  }
  return data;
}
