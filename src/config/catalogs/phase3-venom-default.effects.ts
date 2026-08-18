import type { EffectDefinition } from '../types';

/** Phase 3 七个默认毒素亚型。原文未量化的“高层/高额/少量”保留 baseline-quantified 标签。 */
export const phase3VenomDefaultEffects: Record<string, EffectDefinition[]> = {
  'venom-hemorrhage-a-1': [{ type: 'status', target: 'target', statusId: 'bleed', stacks: 6, durationMs: 5000, tags: ['toxin-bite'] }, { type: 'damage', target: 'target', magnitude: 11, stacks: 6, durationMs: 5000, statusId: 'bleed', tags: ['per-second', 'per-stack'] }],
  'venom-hemorrhage-a-2': [{ type: 'status', target: 'area', statusId: 'bleed', stacks: 4, tags: ['fan-spray'] }],
  'venom-hemorrhage-a-3': [{ type: 'status', target: 'target', statusId: 'bleed', stacks: 4, tags: ['add-stacks'] }],
  'venom-hemorrhage-a-4': [{ type: 'damage', target: 'target', magnitude: 16, tags: ['detonate', 'per-bleed-stack', 'clear-status:bleed', 'physical'] }],
  'venom-coagulation-oscutarin-c-1': [{ type: 'status', target: 'target', statusId: 'thrombosis', stacks: 5, tags: ['toxin-bite'] }],
  'venom-coagulation-oscutarin-c-2': [{ type: 'status', target: 'area', statusId: 'thrombosis', stacks: 4, tags: ['radius:6'] }],
  'venom-coagulation-oscutarin-c-3': [{ type: 'status', target: 'target', statusId: 'thrombosis', stacks: 6, tags: ['rapid-stack'] }],
  'venom-coagulation-oscutarin-c-4': [{ type: 'damage', target: 'target', tags: ['detonate', 'per-thrombosis-stack', 'clear-status:thrombosis'] }, { type: 'status', target: 'target', statusId: 'root', stacks: 1, durationMs: 3000, tags: ['requires:thrombosis-stacks:12'] }],
  'venom-necrosis-beta-1': [{ type: 'status', target: 'target', statusId: 'ulceration', stacks: 5, tags: ['toxin-bite'] }, { type: 'damage', target: 'target', magnitude: 9, stacks: 5, durationMs: 6000, statusId: 'ulceration', tags: ['per-second', 'per-stack'] }],
  'venom-necrosis-beta-2': [{ type: 'status', target: 'area', statusId: 'ulceration', stacks: 1, tags: ['fan-wave'] }],
  'venom-necrosis-beta-3': [{ type: 'status', target: 'target', statusId: 'ulceration', stacks: 5, tags: ['add-stacks'] }],
  'venom-necrosis-beta-4': [{ type: 'damage', target: 'target', magnitude: 13, tags: ['detonate', 'per-ulceration-stack', 'clear-status:ulceration'] }],
  'venom-hallucinogen-i-1': [{ type: 'status', target: 'target', statusId: 'confusion', stacks: 1, durationMs: 2500, tags: ['toxin-bite'] }],
  'venom-hallucinogen-i-2': [{ type: 'status', target: 'area', statusId: 'confusion', stacks: 1, tags: ['wave', 'baseline-quantified', 'chance'] }],
  'venom-hallucinogen-i-3': [{ type: 'buff', target: 'target', statusId: 'confusion', tags: ['friendly-fire', 'output-increase', 'baseline-quantified'] }],
  'venom-hallucinogen-i-4': [{ type: 'trigger', target: 'area', durationMs: 3000, statusId: 'confusion', tags: ['extend-existing-status'] }],
  'venom-muscle-alpha-1': [{ type: 'status', target: 'target', statusId: 'muscle-stiffness', stacks: 1, tags: ['high-stacks', 'baseline-quantified'] }],
  'venom-muscle-alpha-2': [{ type: 'status', target: 'area', statusId: 'weakness', stacks: 1, tags: ['wave'] }, { type: 'status', target: 'area', statusId: 'muscle-stiffness', stacks: 1, tags: ['wave'] }],
  'venom-muscle-alpha-3': [{ type: 'buff', target: 'target', magnitude: 0.35, statusId: 'weakness', tags: ['attack-reduction'] }],
  'venom-muscle-alpha-4': [{ type: 'damage', target: 'target', statusId: 'muscle-stiffness', tags: ['detonate', 'per-muscle-stiffness-stack', 'clear-status:muscle-stiffness', 'baseline-quantified'] }, { type: 'trigger', target: 'target', statusId: 'muscle-stiffness', tags: ['extend-status', 'baseline-quantified'] }],
  'venom-kidney-s-1': [{ type: 'status', target: 'target', statusId: 'kidney-reprisal', stacks: 1, durationMs: 6000, tags: ['toxin-bite', 'on-enemy-skill-cast'] }],
  'venom-kidney-s-2': [{ type: 'status', target: 'area', statusId: 'kidney-reprisal', stacks: 1, tags: ['wave'] }],
  'venom-kidney-s-3': [{ type: 'buff', target: 'target', magnitude: 0.4, statusId: 'kidney-reprisal', tags: ['reprisal-damage-bonus'] }],
  'venom-kidney-s-4': [{ type: 'damage', target: 'target', statusId: 'kidney-reprisal', tags: ['detonate', 'clear-status:kidney-reprisal', 'high-visceral-damage', 'baseline-quantified'] }],
  'venom-heart-gamma-1': [{ type: 'status', target: 'target', statusId: 'heart-erosion', stacks: 1, tags: ['multiple-stacks', 'baseline-quantified', 'toxin-bite'] }],
  'venom-heart-gamma-2': [{ type: 'status', target: 'area', statusId: 'heart-erosion', stacks: 1, tags: ['wave', 'baseline-quantified'] }],
  'venom-heart-gamma-3': [{ type: 'status', target: 'target', statusId: 'heart-erosion', stacks: 1, tags: ['high-stacks', 'baseline-quantified', 'attack-reduction'] }],
  'venom-heart-gamma-4': [{ type: 'damage', target: 'target', statusId: 'heart-erosion', tags: ['detonate', 'per-heart-erosion-stack', 'clear-status:heart-erosion', 'high-cardiac-damage', 'baseline-quantified'] }],
};

export const phase3VenomDefaultMetadata: Record<string, { baseDamage?: number; statusId?: string | null; statusStacks?: number }> = Object.fromEntries(Object.entries(phase3VenomDefaultEffects).map(([id, effects]) => {
  const status = effects.find((effect) => effect.type === 'status' && effect.target !== 'self');
  const damage = effects.find((effect) => effect.type === 'damage' && effect.magnitude !== undefined && !effect.tags?.includes('per-second'));
  return [id, { baseDamage: damage?.magnitude ?? 0, statusId: status?.statusId ?? null, statusStacks: status?.stacks }];
}));

export const phase3VenomDefaultPassiveEffects: Record<string, EffectDefinition[]> = {
  'venom-hemorrhage-a-passive': [{ type: 'buff', target: 'target', statusId: 'bleed', stacks: 3, tags: ['max-stacks'] }],
  'venom-coagulation-oscutarin-c-passive': [{ type: 'buff', target: 'target', statusId: 'thrombosis', magnitude: 0.45, tags: ['stack-efficiency'] }],
  'venom-necrosis-beta-passive': [{ type: 'trigger', target: 'area', statusId: 'ulceration', tags: ['spread', 'baseline-quantified'] }],
  'venom-hallucinogen-i-passive': [{ type: 'buff', target: 'target', statusId: 'confusion', durationMs: 1000, tags: ['duration-bonus'] }],
  'venom-muscle-alpha-passive': [{ type: 'buff', target: 'target', statusId: 'muscle-stiffness', durationMs: 1000, tags: ['duration-bonus'] }],
  'venom-kidney-s-passive': [{ type: 'buff', target: 'target', statusId: 'kidney-reprisal', tags: ['on-enemy-skill-cast', 'damage-bonus', 'baseline-quantified'] }],
  'venom-heart-gamma-passive': [{ type: 'buff', target: 'target', statusId: 'heart-erosion', tags: ['per-stack', 'attack-reduction', 'baseline-quantified'] }],
};
