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

const httpRequestsActive = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method', 'route']
});

const supabaseOperations = new client.Counter({
  name: 'supabase_operations_total',
  help: 'Total number of Supabase operations',
  labelNames: ['operation', 'table', 'status']
});

const supabaseConnectionsActive = new client.Gauge({
  name: 'supabase_connections_active',
  help: 'Number of active Supabase connections'
});

const supabaseQueryDuration = new client.Histogram({
  name: 'supabase_query_duration_seconds',
  help: 'Duration of Supabase queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const n8nWorkflowDuration = new client.Histogram({
  name: 'n8n_workflow_duration_seconds',
  help: 'Duration of N8N workflow calls',
  buckets: [1, 5, 10, 30, 60, 120, 300]
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestsActive);
register.registerMetric(supabaseOperations);
register.registerMetric(supabaseConnectionsActive);
register.registerMetric(supabaseQueryDuration);
register.registerMetric(n8nWorkflowDuration);

export { 
  register, 
  httpRequestDuration, 
  httpRequestTotal, 
  httpRequestsActive,
  supabaseOperations, 
  supabaseConnectionsActive,
  supabaseQueryDuration,
  n8nWorkflowDuration 
};
