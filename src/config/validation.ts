import { z } from 'zod';
import { registeredEffectTags, registeredEffectTypes } from './catalogs/content.config';
import type { EffectDefinition, GameConfig, StatusFamily, StatusTrait } from './types';

const effectSchema = z.object({
  type: z.enum(['damage', 'heal', 'shield', 'status', 'move', 'buff', 'dispel', 'mark', 'trigger']),
  target: z.enum(['self', 'target', 'area']), magnitude: z.number().min(0).optional(), durationMs: z.number().positive().optional(),
  stacks: z.number().int().positive().optional(), statusId: z.string().min(1).optional(), tags: z.array(z.string().min(1)).optional(),
});
const skillSchema = z.object({
  id: z.string().min(1), branchId: z.string().min(1), subtypeId: z.string().min(1).optional(), name: z.string().min(1),
  order: z.number().int().min(1).max(4), unlockLevel: z.number().int(), cooldownMs: z.number().optional(),
  maxCharges: z.number().int().optional(), rechargeMs: z.number().optional(), baseDamage: z.number().min(0),
  damageType: z.enum(['physical', 'venom']), statusId: z.string().min(1).optional(), statusStacks: z.number().int().positive().optional(),
  scalesDamageWithLevel: z.boolean(), effects: z.array(effectSchema).min(1),
});
const passiveSchema = z.object({ id: z.string().min(1), name: z.string().min(1), description: z.string().min(1), branchId: z.string().min(1), subtypeId: z.string().min(1).optional(), effects: z.array(effectSchema).min(1) });
const allowedLevels = new Set([3, 5, 7, 9]);

/** 启动时验证全量内容目录的数量、唯一性、引用与 CD/充能模型；错误信息面向配置维护者。 */
export function validateGameConfig(input: unknown): GameConfig {
  const config = input as GameConfig;
  if (!Number.isFinite(config.combatExitDelayMs) || config.combatExitDelayMs <= 0) throw new Error('脱战延迟必须为正数');
  if (!Number.isInteger(config.roundObjectiveLevel) || config.roundObjectiveLevel < 1) throw new Error('本轮目标等级必须为正整数');
  const parsedSkills = z.array(skillSchema).parse(config.skills);
  const parsedPassives = z.array(passiveSchema).parse(config.passives);
  const originIds = unique(config.origins.map((origin) => origin.id), '本源');
  const branchIds = unique(config.branches.map((branch) => branch.id), '分支');
  const subtypeIds = unique(config.subtypes.map((subtype) => subtype.id), '亚型');
  unique(parsedSkills.map((skill) => skill.id), '技能');
  unique(parsedPassives.map((passive) => passive.id), '被动');
  unique(Object.keys(config.statuses), '状态');
  validateStatusTraits(config);
  if (originIds.size !== 3 || branchIds.size !== 18 || subtypeIds.size !== 32 || parsedSkills.length !== 168 || parsedPassives.length !== 42) throw new Error('全量目录数量必须为 3 本源、18 分支、32 亚型、168 主动技能、42 被动');

  for (const subtype of config.subtypes) if (!branchIds.has(subtype.branchId)) throw new Error(`亚型 ${subtype.id} 引用了不存在的分支: ${subtype.branchId}`);
  for (const branch of config.branches) {
    if (!originIds.has(branch.originId)) throw new Error(`分支 ${branch.id} 引用了不存在的本源: ${branch.originId}`);
    if (branch.defaultSubtypeId && !subtypeIds.has(branch.defaultSubtypeId)) throw new Error(`分支 ${branch.id} 引用了不存在的默认亚型`);
  }
  for (const skill of parsedSkills) {
    validateSkill(skill, branchIds, subtypeIds, config);
  }
  for (const passive of parsedPassives) {
    if (!branchIds.has(passive.branchId)) throw new Error(`被动 ${passive.id} 引用了不存在的分支`);
    if (passive.subtypeId && !subtypeIds.has(passive.subtypeId)) throw new Error(`被动 ${passive.id} 引用了不存在的亚型`);
    validateEffects(passive.effects, config, `被动 ${passive.id}`);
  }
  for (const branch of config.branches.filter((entry) => entry.originId !== 'venom')) requireCount(parsedSkills.filter((skill) => skill.branchId === branch.id && !skill.subtypeId), 4, `分支 ${branch.id} 技能`);
  for (const subtype of config.subtypes) requireCount(parsedSkills.filter((skill) => skill.subtypeId === subtype.id), 4, `亚型 ${subtype.id} 技能`);
  for (const branch of config.branches.filter((entry) => entry.originId !== 'venom')) requireCount(parsedPassives.filter((passive) => passive.branchId === branch.id && !passive.subtypeId), 1, `分支 ${branch.id} 被动`);
  for (const subtype of config.subtypes) requireCount(parsedPassives.filter((passive) => passive.subtypeId === subtype.id), 1, `亚型 ${subtype.id} 被动`);
  return config;
}

function validateStatusTraits(config: GameConfig): void {
  const families = new Set<StatusFamily>(['control', 'mobility', 'muscle']);
  const traits = new Set<StatusTrait>(['hard-control', 'slow', 'root', 'paralysis']);
  for (const status of Object.values(config.statuses)) {
    if (status.families.some((family) => !families.has(family)) || status.immunityFamilies?.some((family) => !families.has(family))) throw new Error(`状态 ${status.id} 使用了未知家族`);
    if (status.traits.some((trait) => !traits.has(trait)) || status.immunityTraits?.some((trait) => !traits.has(trait))) throw new Error(`状态 ${status.id} 使用了未知特征`);
  }
}

function validateSkill(skill: z.infer<typeof skillSchema>, branchIds: Set<string>, subtypeIds: Set<string>, config: GameConfig): void {
  if (!branchIds.has(skill.branchId)) throw new Error(`技能 ${skill.id} 引用了不存在的分支: ${skill.branchId}`);
  if (skill.subtypeId && !subtypeIds.has(skill.subtypeId)) throw new Error(`技能 ${skill.id} 引用了不存在的亚型: ${skill.subtypeId}`);
  if (!allowedLevels.has(skill.unlockLevel) || skill.unlockLevel !== skill.order * 2 + 1) throw new Error(`技能 ${skill.id} 的开放等级必须与序号对应为 3/5/7/9`);
  if (skill.cooldownMs !== undefined && skill.cooldownMs <= 0) throw new Error(`技能 ${skill.id} 的冷却必须为正数`);
  if (skill.maxCharges !== undefined && (!Number.isInteger(skill.maxCharges) || skill.maxCharges <= 0 || !skill.rechargeMs || skill.rechargeMs <= 0 || skill.cooldownMs !== undefined)) throw new Error(`充能技能 ${skill.id} 必须仅配置正的单充冷却`);
  if (skill.maxCharges === undefined && skill.cooldownMs === undefined) throw new Error(`普通技能 ${skill.id} 必须配置冷却`);
  if (skill.statusId && !config.statuses[skill.statusId]) throw new Error(`技能 ${skill.id} 引用了不存在的状态: ${skill.statusId}`);
  if (skill.statusId && skill.statusStacks !== undefined && !skill.effects.some((effect) => effect.type === 'status' && effect.statusId === skill.statusId && effect.stacks === skill.statusStacks)) throw new Error(`技能 ${skill.id} 的状态层数必须与结构化效果一致`);
  if (!skill.effects.some((effect) => effect.tags?.some((tag) => tag !== 'baseline-quantified'))) throw new Error(`技能 ${skill.id} 不能只使用模糊量词基线效果`);
  if (skill.baseDamage > 0 && !skill.effects.some((effect) => effect.type === 'damage' && effect.magnitude === skill.baseDamage)) throw new Error(`技能 ${skill.id} 的明确基础伤害必须映射到效果`);
  validateEffects(skill.effects, config, `技能 ${skill.id}`);
}

function validateEffects(effects: EffectDefinition[], config: GameConfig, owner: string): void {
  for (const effect of effects) {
    if (!registeredEffectTypes.has(effect.type)) throw new Error(`${owner} 使用了未注册效果类型: ${effect.type}`);
    for (const tag of effect.tags ?? []) if (!registeredEffectTags.has(tag)) throw new Error(`${owner} 使用了未注册效果标签: ${tag}`);
    if (effect.statusId && !config.statuses[effect.statusId]) throw new Error(`${owner} 效果引用了不存在的状态: ${effect.statusId}`);
  }
}

function unique(ids: string[], label: string): Set<string> {
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) throw new Error(`重复${label} ID`);
  return uniqueIds;
}

function requireCount<T>(entries: T[], expected: number, label: string): void {
  if (entries.length !== expected) throw new Error(`${label} 必须为 ${expected} 个`);
}
