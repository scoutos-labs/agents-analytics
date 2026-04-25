import type { DashboardConfig } from '../core/types.js';

export interface DashboardPort {
  save(config: DashboardConfig): Promise<void>;
  findById(id: string): Promise<DashboardConfig | null>;
  listByEntity(entityId: string): Promise<DashboardConfig[]>;
}
