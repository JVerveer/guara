import { NextResponse } from 'next/server';
import { analyzeServerPackage } from '../../src/analysis/server/analyzeServerPackage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const files = formData
      .getAll('files')
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: 'No files were uploaded.',
        },
        { status: 400 }
      );
    }

    const analysisResult = await analyzeServerPackage(files);

    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('[api/analyze] Failed to analyze uploaded package:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze uploaded documents.',
      },
      { status: 500 }
    );
  }
}
