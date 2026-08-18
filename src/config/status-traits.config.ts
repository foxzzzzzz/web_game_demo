import type { StatusDefinition } from './types';

/** 状态家族与特征由目录集中声明，供领域、Runtime 与 App 共用，禁止依技能 ID 推断。 */
export const statusTraitDefinitions: Partial<Record<string, Pick<StatusDefinition, 'families' | 'traits' | 'immunityFamilies' | 'immunityTraits'>>> = {
  paralysis: { families: ['control'], traits: ['paralysis'] },
  stun: { families: ['control'], traits: ['hard-control'] },
  root: { families: ['control', 'mobility'], traits: ['root'] },
  slow: { families: ['mobility'], traits: ['slow'] },
  'muscle-stiffness': { families: ['muscle'], traits: [] },
  weakness: { families: ['muscle'], traits: [] },
  'escape-immunity': { families: [], traits: [], immunityFamilies: ['control'] },
  'slow-immunity': { families: [], traits: [], immunityTraits: ['slow'] },
};
