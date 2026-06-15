import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return 'Failed to analyze uploaded documents.';
}

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
    console.log('[api/analyze] Started');

    const { extractUploadedDocuments } = await import(
      '../src/analysis/server/extractUploadedDocuments'
    );

    const { buildServerAnalysisResult } = await import(
      '../src/analysis/server/buildServerAnalysisResult'
    );

    const parsedDocuments = await extractUploadedDocuments(request);

    console.log('[api/analyze] Parsed documents:', parsedDocuments.length);

    const analysisResult = buildServerAnalysisResult(parsedDocuments);

    console.log('[api/analyze] Analysis complete:', {
      documents: analysisResult.documents.length,
      vendors: analysisResult.vendors.length,
      gaps: analysisResult.gaps.length,
      evidence: analysisResult.evidence.length,
    });

    response.status(200).json(analysisResult);
  } catch (error) {
    const message = getErrorMessage(error);

    console.error('[api/analyze] Error object:', error);

    if (error instanceof Error) {
      console.error('[api/analyze] Error name:', error.name);
      console.error('[api/analyze] Error message:', error.message);
      console.error('[api/analyze] Error stack:', error.stack);
    }

    response.status(500).json({
      error: message,
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
