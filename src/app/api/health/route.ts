import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  const startTime = Date.now();
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      n8n: 'unknown'
    }
  };

  try {
    const supabase = createRouteHandlerClient({
      cookies: () => Promise.resolve(cookies()),
    });
    
    const { error } = await supabase.from('hestia_chats').select('id').limit(1);
    health.services.database = error ? 'unhealthy' : 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
  }

  try {
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      health.services.n8n = 'configured';
    }
  } catch (error) {
    health.services.n8n = 'unhealthy';
  }

  const responseTime = Date.now() - startTime;
  health.responseTime = `${responseTime}ms`;

  const status = Object.values(health.services).includes('unhealthy') ? 503 : 200;
  
  return NextResponse.json(health, { status });
}
