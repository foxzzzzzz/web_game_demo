import type { EffectDefinition } from '../config';
import type { ActiveStatus } from '../domain';

export function filterEffectsByChance<T extends EffectDefinition>(effects: readonly T[], random: () => number, highChanceProbability: number): T[] {
  return effects.filter((effect) => {
    const tags = effect.tags ?? [];
    if (!tags.includes('chance') && !tags.includes('high-chance')) return true;
    const probability = tags.includes('chance') && Number.isFinite(effect.magnitude) ? effect.magnitude! : highChanceProbability;
    return random() < probability;
  });
}

/** Turns a copy-status trigger into the same generic status application. */
export function materializeCopiedStatus(effect: EffectDefinition, statuses: readonly ActiveStatus[]): EffectDefinition | undefined {
  const statusId = effect.tags?.find((tag) => tag.startsWith('copy-status:'))?.slice('copy-status:'.length);
  const source = statusId ? statuses.find((status) => status.statusId === statusId) : undefined;
  return source ? { type: 'status', target: effect.target, statusId: source.statusId, stacks: source.stacks, durationMs: source.remainingMs } : undefined;
}

/** Spreads an existing status while adding only the configured stack bonus. */
export function materializeSpreadStackBonus(effect: EffectDefinition, statuses: readonly ActiveStatus[]): EffectDefinition | undefined {
  if (!effect.tags?.includes('spread-stack-bonus') || !effect.statusId) return undefined;
  const source = statuses.find((status) => status.statusId === effect.statusId);
  return source ? { type: 'status', target: effect.target, statusId: source.statusId, stacks: source.stacks + (effect.stacks ?? 0), durationMs: source.remainingMs } : undefined;
}

export function getEnemyCombatModifiers(statuses: readonly ActiveStatus[]) {
  const valueFor = (tag: string) => statuses.filter((status) => status.tags?.includes(tag)).reduce((sum, status) => sum + (status.magnitude ?? 0) * (status.tags?.includes('per-stack') ? status.stacks : 1), 0);
  const attackReduction = valueFor('attack-reduction');
  const healingReduction = statuses.some((status) => status.tags?.includes('healing-disabled')) ? 1 : valueFor('healing-reduction');
  const physicalDefenseReduction = valueFor('physical-defense-reduction');
  return {
    attackMultiplier: Math.max(0, 1 - attackReduction),
    healingMultiplier: Math.max(0, 1 - healingReduction),
    physicalDamageMultiplier: Math.max(0, 1 + physicalDefenseReduction),
  };
}

export function shouldBreakStatus(status: ActiveStatus, event: { damage?: number; action?: 'move' | 'attack' | 'skill' }): boolean {
  return (status.tags ?? []).some((tag) => {
    const threshold = /^break-at-damage:(\d+(?:\.\d+)?)$/.exec(tag)?.[1];
    if (threshold !== undefined && event.damage !== undefined && event.damage >= Number(threshold)) return true;
    const actions = /^break-on:([a-z,]+)$/.exec(tag)?.[1]?.split(',');
    return event.action !== undefined && actions?.includes(event.action) === true;
  });
}

export function isDelayedStatusCarrier(effect: EffectDefinition): boolean {
  return effect.type !== 'mark' && Boolean(effect.statusId && effect.tags?.some((tag) => tag === 'delayed' || tag.startsWith('delayed-')));
}
