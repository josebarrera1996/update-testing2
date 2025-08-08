import client from 'prom-client';

const register = new client.Registry();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const supabaseOperations = new client.Counter({
  name: 'supabase_operations_total',
  help: 'Total number of Supabase operations',
  labelNames: ['operation', 'table', 'status']
});

const n8nWorkflowDuration = new client.Histogram({
  name: 'n8n_workflow_duration_seconds',
  help: 'Duration of N8N workflow calls',
  buckets: [1, 5, 10, 30, 60, 120, 300]
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(supabaseOperations);
register.registerMetric(n8nWorkflowDuration);

export { register, httpRequestDuration, httpRequestTotal, supabaseOperations, n8nWorkflowDuration };
