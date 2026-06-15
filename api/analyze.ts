import type { VercelRequest, VercelResponse } from '@vercel/node';

import { buildServerAnalysisResult } from '../src/analysis/server/buildServerAnalysisResult';
import { extractUploadedDocuments } from '../src/analysis/server/extractUploadedDocuments';
import { getServerErrorMessage } from '../src/analysis/server/serverErrors';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Content-Type', 'application/json');

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const parsedDocuments = await extractUploadedDocuments(request);
    const analysisResult = buildServerAnalysisResult(parsedDocuments);

    response.status(200).json(analysisResult);
  } catch (error) {
    response.status(500).json({
      error: getServerErrorMessage(error),
      details:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
}
