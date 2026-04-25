export interface Entity {
  id: string;
  publicKey: string;
  label: string;
  metadata: Record<string, string>;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface Session {
  tokenHash: string;
  tokenRaw?: string;
  entityId: string;
  scope: string[];
  expiresAt: Date;
  refreshableUntil: Date;
  createdAt: Date;
}

export interface TelemetryEvent {
  id?: number;
  entityId: string;
  eventTime: Date;
  eventName: string;
  metricValue: number;
  dimensions: Record<string, string>;
  ingestionTime: Date;
  batchId?: string;
}

export interface DashboardConfig {
  id: string;
  entityId: string;
  workspaceId?: string;
  title: string;
  widgets: WidgetConfig[];
  timeRange: { preset: string } | { from: string; to: string };
  refreshIntervalSeconds: number;
  createdAt: Date;
}

export interface WidgetConfig {
  type: 'timeseries_line' | 'metric_card';
  title: string;
  query: {
    eventName: string;
    aggregation: 'count' | 'sum' | 'avg';
    groupBy?: string;
  };
}

export interface TimeSeriesPoint {
  bucket: string;
  value: number;
  group?: string;
}

export interface AnalyticsQuery {
  entityId?: string;
  workspaceId?: string;
  eventName: string;
  from: Date;
  to: Date;
  intervalSeconds: number;
  aggregation: 'count' | 'sum' | 'avg';
  groupBy?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdBy: string;
  createdAt: Date;
}

export interface WorkspaceMembership {
  workspaceId: string;
  entityId: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}
