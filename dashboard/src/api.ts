const API_BASE = '';

function getToken(): string {
  const params = new URLSearchParams(location.search);
  return params.get('token') || localStorage.getItem('agentsig_token') || '';
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDashboard(dashboardId: string) {
  return apiFetch(`/v1/dashboards/${dashboardId}`);
}

export async function fetchTimeseries(params: {
  event_name: string;
  from: string;
  to: string;
  interval?: string;
  aggregation?: string;
  group_by?: string;
}) {
  const query = new URLSearchParams(params as Record<string, string>);
  return apiFetch(`/v1/analytics/timeseries?${query.toString()}`);
}
