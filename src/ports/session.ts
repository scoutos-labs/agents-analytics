import type { Session } from '../core/types.js';

export interface SessionPort {
  create(session: Omit<Session, 'tokenHash'> & { tokenHash: string }): Promise<void>;
  findByTokenHash(hash: string): Promise<Session | null>;
  revoke(tokenHash: string): Promise<void>;
}
