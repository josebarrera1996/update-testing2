import { NextResponse } from 'next/server';
import { register } from '@/lib/metrics';
import { updateUserMetrics } from '@/lib/userMetrics';

export async function GET() {
  try {
    await updateUserMetrics();
    
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      headers: {
        'Content-Type': register.contentType,
      },
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
