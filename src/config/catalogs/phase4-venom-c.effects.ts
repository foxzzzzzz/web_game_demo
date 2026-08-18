import type { EffectDefinition } from '../types';

/**
 * Phase4 C：其余肌肉、肾脏与心脏毒素金币亚型。
 * “高层、快速、大范围、长效”等原稿未量化词统一保留 baseline-quantified，数值由首版基线处理。
 */
export const phase4VenomCEffects: Record<string, EffectDefinition[]> = {
  'venom-muscle-gamma-1': [{ type: 'status', target: 'target', statusId: 'weakness', stacks: 3, tags: ['high-stack', 'baseline-quantified'] }],
  'venom-muscle-gamma-2': [{ type: 'status', target: 'area', statusId: 'weakness', stacks: 1, tags: ['large-area', 'baseline-quantified'] }],
  'venom-muscle-gamma-3': [{ type: 'buff', target: 'target', tags: ['move-speed-reduction', 'attack-speed-reduction', 'baseline-quantified'] }],
  'venom-muscle-gamma-4': [{ type: 'trigger', target: 'target', statusId: 'muscle-stiffness', tags: ['requires:weakness-stacks:3', 'convert:weakness', 'baseline-quantified'] }],

  'venom-muscle-delta-1': [{ type: 'status', target: 'target', statusId: 'muscle-stiffness', stacks: 1, tags: ['rapid-stack', 'baseline-quantified'] }, { type: 'status', target: 'target', statusId: 'weakness', stacks: 1, tags: ['rapid-stack', 'baseline-quantified'] }],
  'venom-muscle-delta-2': [{ type: 'trigger', target: 'target', stacks: 1, tags: ['bounce-target-count:1', 'copy-muscle-debuff'] }],
  'venom-muscle-delta-3': [{ type: 'buff', target: 'self', tags: ['muscle-debuff-stack-rate', 'short-duration', 'baseline-quantified'] }],
  'venom-muscle-delta-4': [{ type: 'status', target: 'area', statusId: 'muscle-stiffness', stacks: 1, tags: ['large-area', 'baseline-quantified'] }, { type: 'status', target: 'area', statusId: 'weakness', stacks: 1, tags: ['large-area', 'baseline-quantified'] }],

  'venom-kidney-l-1': [{ type: 'status', target: 'target', statusId: 'kidney-reprisal', stacks: 1, tags: ['toxin-bite'] }, { type: 'status', target: 'target', statusId: 'bleed', stacks: 1, tags: ['toxin-bite'] }],
  'venom-kidney-l-2': [{ type: 'status', target: 'area', statusId: 'kidney-reprisal', stacks: 1, tags: ['toxic-fog'] }, { type: 'status', target: 'area', statusId: 'bleed', stacks: 1, tags: ['toxic-fog'] }],
  'venom-kidney-l-3': [{ type: 'buff', target: 'target', tags: ['requires:kidney-reprisal', 'requires:bleed', 'damage-taken-increase', 'baseline-quantified'] }],
  'venom-kidney-l-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-kidney-reprisal-stack', 'clear-status:kidney-reprisal'] }, { type: 'damage', target: 'target', tags: ['detonate', 'per-bleed-stack', 'clear-status:bleed'] }],

  'venom-kidney-m-1': [{ type: 'status', target: 'target', statusId: 'kidney-reprisal', stacks: 1, tags: ['long-duration', 'baseline-quantified'] }],
  'venom-kidney-m-2': [{ type: 'trigger', target: 'area', statusId: 'kidney-reprisal', tags: ['field', 'refresh-status'] }],
  'venom-kidney-m-3': [{ type: 'trigger', target: 'target', statusId: 'kidney-reprisal', durationMs: 3000, tags: ['delay-status-expiry', 'baseline-quantified'] }],
  'venom-kidney-m-4': [{ type: 'trigger', target: 'area', statusId: 'kidney-reprisal', tags: ['detonate-residual-mark:kidney-reprisal'] }],

  'venom-kidney-x-1': [{ type: 'mark', target: 'target', statusId: 'kidney-reprisal', tags: ['charge-on-enemy-skill-cast'] }],
  'venom-kidney-x-2': [{ type: 'mark', target: 'area', statusId: 'kidney-reprisal', tags: ['fan-projectile', 'multi-target', 'charge-on-enemy-skill-cast'] }],
  'venom-kidney-x-3': [{ type: 'buff', target: 'target', statusId: 'kidney-reprisal', tags: ['charge-rate-increase', 'baseline-quantified'] }],
  'venom-kidney-x-4': [{ type: 'damage', target: 'area', tags: ['detonate-mark:kidney-reprisal', 'internal-burst', 'baseline-quantified'] }],

  'venom-heart-delta-1': [{ type: 'status', target: 'target', statusId: 'heart-erosion', stacks: 1, tags: ['toxin-bite'] }, { type: 'status', target: 'target', statusId: 'slow', stacks: 1, tags: ['move-speed-reduction'] }],
  'venom-heart-delta-2': [{ type: 'trigger', target: 'area', tags: ['toxic-fog', 'continuous:heart-erosion,slow'] }],
  'venom-heart-delta-3': [{ type: 'buff', target: 'target', tags: ['attack-speed-reduction', 'move-speed-reduction', 'baseline-quantified'] }],
  'venom-heart-delta-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-heart-erosion-stack', 'clear-status:heart-erosion'] }, { type: 'status', target: 'target', statusId: 'slow', stacks: 1, tags: ['retained-after-detonation', 'baseline-quantified'] }],

  'venom-heart-epsilon-1': [{ type: 'status', target: 'target', statusId: 'heart-erosion', stacks: 1, tags: ['rapid-stack', 'baseline-quantified'] }],
  'venom-heart-epsilon-2': [{ type: 'status', target: 'area', statusId: 'heart-erosion', stacks: 1, tags: ['group-rapid-stack', 'baseline-quantified'] }],
  'venom-heart-epsilon-3': [{ type: 'buff', target: 'target', statusId: 'heart-erosion', tags: ['threshold-control-chance-increase', 'baseline-quantified'] }],
  'venom-heart-epsilon-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-heart-erosion-stack', 'clear-status:heart-erosion'] }, { type: 'trigger', target: 'target', statusId: 'stun', tags: ['high-chance', 'heart-erosion-control', 'baseline-quantified'] }],

  'venom-heart-zeta-1': [{ type: 'status', target: 'target', statusId: 'heart-erosion', stacks: 1, tags: ['long-duration', 'baseline-quantified'] }],
  'venom-heart-zeta-2': [{ type: 'mark', target: 'area', statusId: 'heart-erosion', tags: ['large-area', 'long-duration', 'baseline-quantified'] }],
  'venom-heart-zeta-3': [{ type: 'trigger', target: 'target', statusId: 'heart-erosion', durationMs: 3000, tags: ['extend-status'] }],
  'venom-heart-zeta-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-heart-erosion-stack', 'clear-status:heart-erosion'] }, { type: 'damage', target: 'target', durationMs: 2000, statusId: 'heart-erosion', tags: ['after-expire', 'venom-residual', 'per-second'] }],
};

export const phase4VenomCMetadata: Record<string, { baseDamage?: number; statusId?: string | null; statusStacks?: number }> = Object.fromEntries(Object.entries(phase4VenomCEffects).map(([id, effects]) => {
  const status = effects.find((effect) => effect.type === 'status');
  const damage = effects.find((effect) => effect.type === 'damage' && effect.magnitude !== undefined);
  return [id, { baseDamage: damage?.magnitude ?? 0, statusId: status?.statusId ?? null, statusStacks: status?.stacks }];
}));

export const phase4VenomCPassiveEffects: Record<string, EffectDefinition[]> = {
  'venom-muscle-gamma-passive': [{ type: 'buff', target: 'target', statusId: 'weakness', tags: ['effect-strength', 'baseline-quantified'] }],
  'venom-muscle-delta-passive': [{ type: 'buff', target: 'target', magnitude: 0.5, tags: ['muscle-debuff-stack-rate'] }],
  'venom-kidney-l-passive': [{ type: 'trigger', target: 'target', statusId: 'bleed', tags: ['on-kidney-reprisal'] }],
  'venom-kidney-m-passive': [{ type: 'buff', target: 'target', durationMs: 3000, statusId: 'kidney-reprisal', tags: ['duration-bonus'] }],
  'venom-kidney-x-passive': [{ type: 'trigger', target: 'target', statusId: 'kidney-reprisal', tags: ['on-enemy-skill-cast', 'stack-and-detonate', 'baseline-quantified'] }],
  'venom-heart-delta-passive': [{ type: 'trigger', target: 'target', statusId: 'slow', tags: ['on-heart-erosion'] }],
  'venom-heart-epsilon-passive': [{ type: 'trigger', target: 'target', stacks: 12, statusId: 'stun', tags: ['heart-erosion-threshold', 'chance', 'baseline-quantified'] }],
  'venom-heart-zeta-passive': [{ type: 'damage', target: 'target', durationMs: 2000, statusId: 'heart-erosion', tags: ['after-expire', 'venom-residual', 'per-second'] }],
};
