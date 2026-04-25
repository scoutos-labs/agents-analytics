import type { Entity } from '../core/types.js';

export interface IdentityPort {
  register(entity: Entity): Promise<void>;
  findById(id: string): Promise<Entity | null>;
  findByPublicKey(publicKey: string): Promise<Entity | null>;
  rotateKey(entityId: string, newPublicKey: string): Promise<void>;
  revoke(entityId: string): Promise<void>;
}
