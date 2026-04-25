<script lang="ts">
  import { onMount } from 'svelte';
  import TimeSeriesChart from './components/TimeSeriesChart.svelte';
  import { fetchDashboard, fetchTimeseries } from './api';

  let dashboard: any = null;
  let widgetData = new Map<number, any>();
  let error = '';
  let loading = true;

  async function load() {
    const pathMatch = location.pathname.match(/\/view\/([a-zA-Z0-9_]+)/);
    const dashboardId = pathMatch ? pathMatch[1] : null;

    if (!dashboardId) {
      error = 'No dashboard ID in URL. Expected /view/:id';
      loading = false;
      return;
    }

    try {
      dashboard = await fetchDashboard(dashboardId);
      const timeRange = dashboard.timeRange || { preset: 'last_24h' };
      const now = new Date();
      let from: Date;
      let to: Date = now;

      if ('preset' in timeRange) {
        if (timeRange.preset === 'last_24h') from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        else if (timeRange.preset === 'last_7d') from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        else if (timeRange.preset === 'last_1h') from = new Date(now.getTime() - 60 * 60 * 1000);
        else from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else {
        from = new Date(timeRange.from);
        to = new Date(timeRange.to);
      }

      const workspaceId = dashboard.workspaceId || undefined;

      for (let i = 0; i < (dashboard.widgets || []).length; i++) {
        const w = dashboard.widgets[i];
        if (w.type === 'timeseries_line' || w.type === 'metric_card') {
          const params: any = {
            event_name: w.query.eventName,
            from: from.toISOString(),
            to: to.toISOString(),
            interval: '3600',
            aggregation: w.query.aggregation || 'count',
            group_by: w.query.groupBy || '',
          };
          if (workspaceId) params.workspace_id = workspaceId;

          const data = await fetchTimeseries(params);
          widgetData.set(i, data);
        }
      }
      widgetData = widgetData; // trigger reactivity
      loading = false;
    } catch (e: any) {
      error = e.message || 'Failed to load dashboard';
      loading = false;
    }
  }

  onMount(() => {
    load();
    const interval = dashboard?.refreshIntervalSeconds ? dashboard.refreshIntervalSeconds * 1000 : 60000;
    const iv = setInterval(load, interval);
    return () => clearInterval(iv);
  });
</script>

{#if loading}
  <div style="padding: 2rem; text-align: center; color: #a1a1aa;">Loading...</div>
{:else if error}
  <div style="padding: 2rem; color: #f87171;">{error}</div>
{:else}
  <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
    <header style="margin-bottom: 1.5rem; border-bottom: 1px solid #27272a; padding-bottom: 1rem;">
      <h1 style="margin: 0; font-size: 1.5rem;">{dashboard?.title || 'Dashboard'}</h1>
      <div style="color: #a1a1aa; font-size: 0.875rem;">
        {#if dashboard?.workspaceId}
          Workspace: {dashboard.workspaceId}
        {:else}
          Entity: {dashboard?.entityId}
        {/if}
      </div>
    </header>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
      {#each dashboard?.widgets || [] as widget, i}
        <div style="background: #18181b; border: 1px solid #27272a; border-radius: 0.75rem; padding: 1rem;">
          <div style="font-weight: 600; margin-bottom: 0.75rem;">{widget.title}</div>
          {#if widgetData.has(i)}
            <TimeSeriesChart
              title={widget.title}
              data={{ points: widgetData.get(i).points || [] }}
            />
          {:else}
            <div style="color: #71717a; font-size: 0.875rem;">No data</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
