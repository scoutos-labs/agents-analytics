import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    entityId: string;
    scope: string[];
  }
}
