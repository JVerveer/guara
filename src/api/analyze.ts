import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * This fallback file is only useful if your project uses Vite + Vercel Serverless
 * instead of Next.js App Router.
 *
 * For multipart uploads in this setup, you should add a parser like formidable.
 * If your project is Next.js App Router, use api/analyze/route.ts instead and
 * delete this file.
 */
export default async function handler(_request: VercelRequest, response: VercelResponse) {
  response.status(501).json({
    error:
      'Use src/app/api/analyze/route.ts for Next.js App Router, or implement multipart parsing here for Vite + Vercel Serverless.',
  });
}
