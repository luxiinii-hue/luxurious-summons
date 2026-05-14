// scripts/multi-spawn-counter.js — pure-logic counter for Animate Dead's
// multi-variant + multi-token spawn UX. Per-variant counts that sum to ≤
// maxActive. Frozen-shape (each mutation returns a new counter — no in-place mutation).

export function createCounter({ maxActive }) {
  return { maxActive, counts: {} };
}

export function totalCount(counter) {
  return Object.values(counter.counts).reduce((a, b) => a + b, 0);
}

export function canIncrement(counter) {
  return totalCount(counter) < counter.maxActive;
}

export function increment(counter, variantId) {
  if (!canIncrement(counter)) return counter;
  return {
    ...counter,
    counts: { ...counter.counts, [variantId]: (counter.counts[variantId] ?? 0) + 1 }
  };
}

export function decrement(counter, variantId) {
  const current = counter.counts[variantId] ?? 0;
  if (current <= 1) {
    const { [variantId]: _, ...rest } = counter.counts;
    return { ...counter, counts: rest };
  }
  return { ...counter, counts: { ...counter.counts, [variantId]: current - 1 } };
}

/**
 * Flatten the counter's per-variant counts into a sequence of variantIds
 * suitable for sequential placement. E.g., { skeleton: 2, zombie: 1 } →
 * ["skeleton", "skeleton", "zombie"].
 */
export function toPlacementSequence(counter) {
  const seq = [];
  for (const [variantId, count] of Object.entries(counter.counts)) {
    for (let i = 0; i < count; i++) seq.push(variantId);
  }
  return seq;
}
