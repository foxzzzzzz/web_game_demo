import type { EffectDefinition } from '../types';

/**
 * Phase4 B：迟效凝固、细胞坏死、迷幻与肌肉毒素金币亚型。
 * 原稿没有给出具体数值的“高额/少量/范围”等，仅以 baseline-quantified 标记交由统一首版基线处理。
 */
export const phase4VenomBEffects: Record<string, EffectDefinition[]> = {
  'venom-coagulation-delayed-1': [{ type: 'mark', target: 'target', statusId: 'toxin-seed', durationMs: 3000, tags: ['delayed-coagulation-marker'] }, { type: 'status', target: 'target', statusId: 'thrombosis', stacks: 7, durationMs: 3000, tags: ['on-toxin-seed-expire'] }],
  'venom-coagulation-delayed-2': [{ type: 'trigger', target: 'area', tags: ['toxic-field', 'on-enter:delayed-coagulation-marker'] }],
  'venom-coagulation-delayed-3': [{ type: 'trigger', target: 'target', stacks: 4, statusId: 'thrombosis', tags: ['delayed-burst-stack-bonus'] }],
  'venom-coagulation-delayed-4': [{ type: 'trigger', target: 'area', tags: ['detonate-mark:delayed-coagulation-marker'] }, { type: 'status', target: 'area', statusId: 'root', stacks: 1, tags: ['group-root', 'baseline-quantified'] }],

  'venom-necrosis-alpha-1': [{ type: 'status', target: 'target', statusId: 'ulceration', stacks: 1, tags: ['toxin-bite'] }, { type: 'buff', target: 'target', magnitude: 0.18, statusId: 'ulceration', tags: ['physical-defense-reduction'] }],
  'venom-necrosis-alpha-2': [{ type: 'trigger', target: 'area', statusId: 'ulceration', tags: ['toxic-fog', 'continuous:ulceration', 'continuous:physical-defense-reduction'] }],
  'venom-necrosis-alpha-3': [{ type: 'buff', target: 'target', magnitude: 0.22, tags: ['physical-damage-taken'] }],
  'venom-necrosis-alpha-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-ulceration-stack', 'clear-status:ulceration'] }, { type: 'trigger', target: 'target', tags: ['physical-defense-reduction', 'damage-amplified-by-defense-loss'] }],

  'venom-necrosis-gamma-1': [{ type: 'status', target: 'target', statusId: 'ulceration', stacks: 1, tags: ['high-stack', 'baseline-quantified'] }],
  'venom-necrosis-gamma-2': [{ type: 'trigger', target: 'area', statusId: 'ulceration', tags: ['toxic-field', 'continuous:ulceration'] }],
  'venom-necrosis-gamma-3': [{ type: 'trigger', target: 'target', statusId: 'ulceration', durationMs: 4000, tags: ['extend-status'] }],
  'venom-necrosis-gamma-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-ulceration-stack', 'clear-status:ulceration'] }, { type: 'trigger', target: 'area', statusId: 'ulceration', tags: ['spread:ulceration'] }],

  'venom-necrosis-epsilon-1': [{ type: 'mark', target: 'target', statusId: 'lesion-mark', tags: ['lesion-mark'] }, { type: 'status', target: 'target', statusId: 'ulceration', stacks: 1, tags: ['toxin-bite'] }],
  'venom-necrosis-epsilon-2': [{ type: 'mark', target: 'area', statusId: 'lesion-mark', tags: ['fan-projectile', 'multi-target'] }],
  'venom-necrosis-epsilon-3': [{ type: 'buff', target: 'target', magnitude: 0.3, statusId: 'lesion-mark', tags: ['requires:lesion-mark', 'venom-damage-taken'] }],
  'venom-necrosis-epsilon-4': [{ type: 'damage', target: 'area', tags: ['detonate-mark:lesion-mark', 'high-venom-burst', 'baseline-quantified'] }],

  'venom-hallucinogen-ii-1': [{ type: 'status', target: 'target', statusId: 'confusion', stacks: 1, tags: ['toxin-bite'] }, { type: 'status', target: 'target', statusId: 'paralysis', stacks: 3, tags: ['hallucinogen-paralysis'] }],
  'venom-hallucinogen-ii-2': [{ type: 'status', target: 'area', statusId: 'confusion', stacks: 1, tags: ['toxic-fog'] }, { type: 'status', target: 'area', statusId: 'slow', stacks: 1, tags: ['toxic-fog', 'baseline-quantified'] }],
  'venom-hallucinogen-ii-3': [{ type: 'buff', target: 'target', tags: ['hit-chance-reduction', 'baseline-quantified'] }],
  'venom-hallucinogen-ii-4': [{ type: 'status', target: 'area', statusId: 'confusion', stacks: 1, tags: ['area-storm'] }, { type: 'status', target: 'area', statusId: 'paralysis', stacks: 1, tags: ['large-paralysis-stacks', 'baseline-quantified'] }],

  'venom-hallucinogen-iii-1': [{ type: 'status', target: 'target', statusId: 'confusion', stacks: 1, tags: ['toxin-bite'] }, { type: 'trigger', target: 'target', statusId: 'weakness', tags: ['on-confusion-expire', 'apply:weakness'] }],
  'venom-hallucinogen-iii-2': [{ type: 'trigger', target: 'area', tags: ['toxic-fog', 'continuous:confusion,weakness'] }],
  'venom-hallucinogen-iii-3': [{ type: 'heal', target: 'self', tags: ['per-second', 'requires:confusion', 'baseline-quantified'] }],
  'venom-hallucinogen-iii-4': [{ type: 'status', target: 'target', statusId: 'stun', stacks: 1, durationMs: 1500, tags: ['on-confusion-expire'] }],

  'venom-hallucinogen-iv-1': [{ type: 'status', target: 'target', statusId: 'confusion', stacks: 1, tags: ['toxin-bite'] }, { type: 'trigger', target: 'target', tags: ['on-confusion-expire', 'wander'] }],
  'venom-hallucinogen-iv-2': [{ type: 'trigger', target: 'area', tags: ['toxic-field', 'continuous:confusion-mark'] }],
  'venom-hallucinogen-iv-3': [{ type: 'trigger', target: 'target', durationMs: 2000, tags: ['after-confusion-expire', 'wander-duration-bonus'] }],
  'venom-hallucinogen-iv-4': [{ type: 'status', target: 'area', statusId: 'confusion', stacks: 1, tags: ['large-area'] }, { type: 'trigger', target: 'area', tags: ['after-confusion-expire', 'wander'] }],

  'venom-muscle-beta-1': [{ type: 'status', target: 'target', statusId: 'muscle-stiffness', stacks: 1, tags: ['toxin-bite'] }],
  'venom-muscle-beta-2': [{ type: 'trigger', target: 'area', statusId: 'muscle-stiffness', tags: ['toxic-fog', 'continuous:muscle-stiffness'] }],
  'venom-muscle-beta-3': [{ type: 'buff', target: 'target', statusId: 'muscle-stiffness', tags: ['requires:muscle-stiffness', 'physical-damage-taken', 'baseline-quantified'] }],
  'venom-muscle-beta-4': [{ type: 'damage', target: 'target', tags: ['requires:muscle-stiffness', 'detonate', 'per-muscle-stiffness-stack', 'clear-status:muscle-stiffness', 'mixed-physical-venom-damage', 'baseline-quantified'] }],
};

export const phase4VenomBMetadata: Record<string, { baseDamage?: number; statusId?: string | null; statusStacks?: number }> = Object.fromEntries(Object.entries(phase4VenomBEffects).map(([id, effects]) => {
  const status = effects.find((effect) => effect.type === 'status');
  const damage = effects.find((effect) => effect.type === 'damage' && effect.magnitude !== undefined);
  return [id, { baseDamage: damage?.magnitude ?? 0, statusId: status?.statusId ?? null, statusStacks: status?.stacks }];
}));

export const phase4VenomBPassiveEffects: Record<string, EffectDefinition[]> = {
  'venom-coagulation-delayed-passive': [{ type: 'trigger', target: 'target', durationMs: 3000, statusId: 'thrombosis', tags: ['delayed-coagulation', 'baseline-quantified'] }],
  'venom-necrosis-alpha-passive': [{ type: 'buff', target: 'target', statusId: 'ulceration', tags: ['physical-defense-reduction', 'baseline-quantified'] }],
  'venom-necrosis-gamma-passive': [{ type: 'damage', target: 'target', durationMs: 2000, statusId: 'ulceration', tags: ['after-expire', 'venom-residual', 'per-second'] }],
  'venom-necrosis-epsilon-passive': [{ type: 'mark', target: 'target', statusId: 'lesion-mark', tags: ['on-attack', 'detonation-bonus', 'baseline-quantified'] }],
  'venom-hallucinogen-ii-passive': [{ type: 'trigger', target: 'target', statusId: 'paralysis', tags: ['on-confusion', 'baseline-quantified'] }],
  'venom-hallucinogen-iii-passive': [{ type: 'buff', target: 'target', magnitude: 0.25, durationMs: 4000, statusId: 'weakness', tags: ['after-confusion-expire', 'attack-reduction'] }],
  'venom-hallucinogen-iv-passive': [{ type: 'trigger', target: 'target', statusId: 'confusion', tags: ['after-expire', 'wander'] }],
  'venom-muscle-beta-passive': [{ type: 'buff', target: 'target', magnitude: 0.25, statusId: 'muscle-stiffness', tags: ['requires:muscle-stiffness', 'physical-damage-taken'] }],
};
