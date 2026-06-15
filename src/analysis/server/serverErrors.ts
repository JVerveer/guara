import { ZodError } from 'zod';

export function getServerErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return `AnalysisResult validation failed: ${error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return 'Failed to analyze uploaded documents.';
}
