import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// Read version once at module load
// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION: string = process.env.npm_package_version || '0.1.0';

interface HealthCheck {
  status: 'ok' | 'error';
  latency_ms: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime_seconds: number;
  timestamp: string;
  checks: {
    database: HealthCheck;
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = performance.now();
  try {
    const supabase = createServiceClient();

    // Lightweight query to verify database connectivity
    const { error } = await supabase
      .from('stores')
      .select('id')
      .limit(1)
      .maybeSingle();

    const latency = Math.round(performance.now() - start);

    if (error) {
      return { status: 'error', latency_ms: latency, error: error.message };
    }

    return { status: 'ok', latency_ms: latency };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return { status: 'error', latency_ms: latency, error: message };
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const database = await checkDatabase();

  const allChecksOk = database.status === 'ok';
  const overallStatus: HealthResponse['status'] = allChecksOk ? 'ok' : 'error';

  const body: HealthResponse = {
    status: overallStatus,
    version: APP_VERSION,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database,
    },
  };

  const httpStatus = overallStatus === 'ok' ? 200 : 503;

  return NextResponse.json(body, { status: httpStatus });
}
