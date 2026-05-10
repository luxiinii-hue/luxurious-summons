// scripts/handlers/index.js — per-template extra-action handler registry
//
// Registration pattern: each handler module calls registerHandler(...) on import.
// Dispatch: callHandler(id, ctx) looks up the function by string id.

const _registry = new Map();

export function registerHandler(id, fn) {
  if (_registry.has(id)) console.warn(`[luxurious-summons] handler ${id} already registered; overwriting`);
  _registry.set(id, fn);
}

export async function callHandler(id, ctx) {
  const fn = _registry.get(id);
  if (!fn) {
    console.warn(`[luxurious-summons] no handler registered for ${id}`);
    return;
  }
  return await fn(ctx);
}

export function listHandlers() {
  return [..._registry.keys()];
}
