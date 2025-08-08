import { NextRequest, NextResponse } from 'next/server';
import { httpRequestDuration, httpRequestTotal, httpRequestsActive } from './metrics';

export function withMetrics(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    const startTime = Date.now();
    const endTimer = httpRequestDuration.startTimer({ 
      method: req.method, 
      route: req.nextUrl.pathname 
    });
    
    httpRequestsActive.inc({ method: req.method, route: req.nextUrl.pathname });
    
    try {
      const response = await handler(req, ...args);
      const statusCode = response.status?.toString() || '200';
      
      httpRequestTotal.inc({ 
        method: req.method, 
        route: req.nextUrl.pathname, 
        status_code: statusCode 
      });
      endTimer({ status_code: statusCode });
      
      return response;
    } catch (error) {
      httpRequestTotal.inc({ 
        method: req.method, 
        route: req.nextUrl.pathname, 
        status_code: '500' 
      });
      endTimer({ status_code: '500' });
      throw error;
    } finally {
      httpRequestsActive.dec({ method: req.method, route: req.nextUrl.pathname });
    }
  };
}
