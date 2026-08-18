import type { EffectDefinition } from '../types';

/** Phase4 A：三神经、三出血、两凝血金币亚型。仅模糊量词保留 baseline 标签。 */
export const phase4VenomAEffects: Record<string, EffectDefinition[]> = {
  'venom-neuro-beta-1': [{ type: 'move', target: 'self', tags: ['short-pounce'] }, { type: 'status', target: 'target', statusId: 'paralysis', stacks: 4, tags: ['short-duration'] }],
  'venom-neuro-beta-2': [{ type: 'damage', target: 'target', tags: ['line-wave', 'interrupt-cast'] }, { type: 'status', target: 'target', statusId: 'paralysis', stacks: 3, tags: ['direct-apply'] }],
  'venom-neuro-beta-3': [{ type: 'buff', target: 'self', statusId: 'toxin-amplified', durationMs: 5000, tags: ['toxin-apply-rate:x2'] }, { type: 'damage', target: 'self', magnitude: 12, durationMs: 1000, tags: ['per-second', 'self-cost'] }],
  'venom-neuro-beta-4': [{ type: 'trigger', target: 'area', stacks: 1, tags: ['bounce-target-count:1', 'copy-status:paralysis'] }],
  'venom-neuro-kappa-1': [{ type: 'status', target: 'target', statusId: 'energy-seal', stacks: 1, durationMs: 4000, tags: ['high-chance', 'toxin-fang', 'baseline-quantified'] }],
  'venom-neuro-kappa-2': [{ type: 'status', target: 'area', statusId: 'silence', stacks: 1, durationMs: 3000, tags: ['radius:7', 'toxin-fog'] }],
  'venom-neuro-kappa-3': [{ type: 'buff', target: 'target', statusId: 'weakness', magnitude: 0.3, durationMs: 4000, tags: ['attack-reduction'] }],
  'venom-neuro-kappa-4': [{ type: 'damage', target: 'target', magnitude: 220, tags: ['requires:energy-seal'] }, { type: 'damage', target: 'target', magnitude: 110, tags: ['requires:not-energy-seal'] }],
  'venom-neuro-delta-1': [{ type: 'mark', target: 'target', statusId: 'toxin-seed', durationMs: 8000, tags: ['delayed'] }, { type: 'status', target: 'target', statusId: 'paralysis', stacks: 5, durationMs: 8000, tags: ['on-seed-expire'] }],
  'venom-neuro-delta-2': [{ type: 'buff', target: 'self', statusId: 'stealth', durationMs: 2500, tags: ['short-stealth'] }, { type: 'move', target: 'self', tags: ['pounce'] }, { type: 'mark', target: 'target', statusId: 'toxin-seed', durationMs: 8000, tags: ['on-hit'] }],
  'venom-neuro-delta-3': [{ type: 'trigger', target: 'area', tags: ['field-radius:6', 'on-enter:toxin-seed'] }],
  'venom-neuro-delta-4': [{ type: 'trigger', target: 'area', tags: ['detonate-mark:toxin-seed', 'area-paralysis-burst'] }],
  'venom-hemorrhage-b-1': [{ type: 'status', target: 'target', statusId: 'bleed', stacks: 4, tags: ['toxin-bite'] }, { type: 'damage', target: 'target', magnitude: 8, durationMs: 1000, tags: ['per-second', 'venom-corrosion'] }],
  'venom-hemorrhage-b-2': [{ type: 'trigger', target: 'area', tags: ['toxic-cloud', 'continuous:bleed,corrosion'] }],
  'venom-hemorrhage-b-3': [{ type: 'trigger', target: 'target', durationMs: 3000, statusId: 'bleed', tags: ['extend-status'] }],
  'venom-hemorrhage-b-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-bleed-stack', 'clear-status:bleed'] }, { type: 'trigger', target: 'area', tags: ['spread:venom-corrosion'] }],
  'venom-hemorrhage-c-1': [{ type: 'status', target: 'target', statusId: 'bleed', stacks: 1, tags: ['toxin-bite'] }, { type: 'status', target: 'target', statusId: 'anti-heal', stacks: 1, durationMs: 4000, tags: ['high-chance', 'baseline-quantified'] }],
  'venom-hemorrhage-c-2': [{ type: 'status', target: 'area', statusId: 'bleed', stacks: 1, tags: ['toxin-fog'] }, { type: 'status', target: 'area', statusId: 'anti-heal', stacks: 1, durationMs: 4000, tags: ['toxin-fog'] }],
  'venom-hemorrhage-c-3': [{ type: 'buff', target: 'target', statusId: 'bleed', magnitude: 0.5, tags: ['requires:bleed', 'healing-reduction'] }],
  'venom-hemorrhage-c-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-bleed-stack', 'clear-status:bleed'] }, { type: 'buff', target: 'target', magnitude: 0.55, statusId: 'anti-heal', tags: ['requires:anti-heal', 'damage-bonus'] }],
  'venom-hemorrhage-d-1': [{ type: 'move', target: 'self', tags: ['requires:bleed', 'pounce'] }, { type: 'status', target: 'target', statusId: 'bleed', stacks: 5, tags: ['toxin-bite'] }],
  'venom-hemorrhage-d-2': [{ type: 'damage', target: 'target', tags: ['wave', 'requires:bleed', 'auto-lock'] }],
  'venom-hemorrhage-d-3': [{ type: 'buff', target: 'self', statusId: 'hunter-sense', magnitude: 12, tags: ['detect-radius-bonus'] }],
  'venom-hemorrhage-d-4': [{ type: 'damage', target: 'area', tags: ['requires:bleed', 'detonate', 'per-bleed-stack', 'clear-status:bleed'] }],
  'venom-coagulation-small-1': [{ type: 'status', target: 'target', statusId: 'thrombosis', stacks: 4, tags: ['toxin-bite'] }, { type: 'trigger', target: 'area', stacks: 2, tags: ['spread-target-count:2', 'copy-status:thrombosis'] }],
  'venom-coagulation-small-2': [{ type: 'status', target: 'area', statusId: 'thrombosis', stacks: 1, tags: ['large-area', 'baseline-quantified'] }],
  'venom-coagulation-small-3': [{ type: 'trigger', target: 'area', stacks: 2, statusId: 'thrombosis', tags: ['spread-stack-bonus'] }],
  'venom-coagulation-small-4': [{ type: 'damage', target: 'area', tags: ['requires:thrombosis', 'detonate', 'per-thrombosis-stack', 'clear-status:thrombosis'] }],
  'venom-coagulation-diffuse-1': [{ type: 'mark', target: 'self', statusId: 'toxin-core', stacks: 1, tags: ['place-ground-core'] }],
  'venom-coagulation-diffuse-2': [{ type: 'mark', target: 'self', statusId: 'toxin-core', stacks: 3, tags: ['place-ground-core'] }],
  'venom-coagulation-diffuse-3': [{ type: 'buff', target: 'area', statusId: 'toxin-core', magnitude: 2, tags: ['tick-rate-multiplier'] }],
  // 首版无地面指针输入：引爆命令以施法者为中心触发，由 Runtime 查询场上的毒核标记。
  'venom-coagulation-diffuse-4': [{ type: 'damage', target: 'self', tags: ['detonate-mark:toxin-core', 'apply:thrombosis'] }],
};

export const phase4VenomAMetadata: Record<string, { baseDamage?: number; statusId?: string | null; statusStacks?: number }> = Object.fromEntries(Object.entries(phase4VenomAEffects).map(([id, effects]) => { const status = effects.find((effect) => effect.type === 'status'); const damage = effects.find((effect) => effect.type === 'damage' && effect.magnitude !== undefined); return [id, { baseDamage: damage?.magnitude ?? 0, statusId: status?.statusId ?? null, statusStacks: status?.stacks }]; }));
export const phase4VenomAPassiveEffects: Record<string, EffectDefinition[]> = {
  'venom-neuro-beta-passive': [{ type: 'buff', target: 'target', magnitude: 0.5, tags: ['paralysis-stack-rate'] }, { type: 'buff', target: 'target', magnitude: 0.4, tags: ['paralysis-duration-reduction'] }],
  'venom-neuro-kappa-passive': [{ type: 'trigger', target: 'target', magnitude: 0.3, durationMs: 4000, statusId: 'energy-seal', tags: ['on-venom-hit', 'chance'] }],
  'venom-neuro-delta-passive': [{ type: 'trigger', target: 'target', durationMs: 8000, stacks: 5, statusId: 'paralysis', tags: ['on-attack', 'delayed-toxin-seed'] }],
  'venom-hemorrhage-b-passive': [{ type: 'damage', target: 'target', magnitude: 8, durationMs: 1000, statusId: 'bleed', tags: ['per-second', 'venom-corrosion'] }],
  'venom-hemorrhage-c-passive': [{ type: 'trigger', target: 'target', magnitude: 0.4, durationMs: 4000, statusId: 'anti-heal', tags: ['on-bleed-hit', 'chance', 'healing-disabled'] }],
  'venom-hemorrhage-d-passive': [{ type: 'mark', target: 'target', statusId: 'hunter-sense', tags: ['requires:bleed', 'permanent-reveal'] }],
  'venom-coagulation-small-passive': [{ type: 'trigger', target: 'area', stacks: 2, statusId: 'thrombosis', tags: ['spread-target-count'] }],
  'venom-coagulation-diffuse-passive': [{ type: 'mark', target: 'area', statusId: 'toxin-core', tags: ['on-contact', 'apply:thrombosis'] }],
};
