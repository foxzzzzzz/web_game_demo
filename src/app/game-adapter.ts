import type { GameConfig, OriginId } from '../config';
import type { GameState } from '../domain';
import type { GameViewModel, PanelId, UiSkill } from '../ui/types';

export interface AdapterSelection {
  selectedOriginId: OriginId | null;
  selectedBranchId: string | null;
  activePanel: PanelId | null;
  target?: GameViewModel['target'];
}

const originDescriptions: Record<OriginId, string> = {
  size: '厚甲、生存与控场',
  strength: '撕咬、缠绕与爆发',
  venom: '叠毒、引爆与亚型切换',
};

const panels: PanelId[] = ['overview', 'branches', 'subtypes', 'skills', 'loadout', 'status', 'upgrade'];

export function buildGameViewModel(state: GameState, config: GameConfig, selection: AdapterSelection): GameViewModel {
  const currentOrigin = state.originId;
  const selectedOriginId = selection.selectedOriginId ?? currentOrigin ?? null;
  const selectedBranchId = selection.selectedBranchId ?? state.unlockedBranchIds[0] ?? null;
  const availableSkills = config.skills.filter((skill) => {
    const branch = config.branches.find((entry) => entry.id === skill.branchId);
    return !currentOrigin || branch?.originId === currentOrigin;
  });
  const skills = availableSkills.map((skill) => mapSkill(skill.id, state, config));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const nextThreshold = config.levelXpThresholds[state.characterLevel] ?? config.levelXpThresholds.at(-1) ?? state.characterXp;

  return {
    screen: state.phase === 'active' ? 'game' : state.phase === 'dead' ? 'death' : 'creation',
    selectedOriginId,
    selectedBranchId,
    origins: config.origins.map((origin) => ({
      id: origin.id,
      name: `${origin.name}系`,
      description: originDescriptions[origin.id],
      branches: config.branches.filter((branch) => branch.originId === origin.id).map((branch) => {
        const unlocked = state.unlockedBranchIds.includes(branch.id);
        return {
          id: branch.id,
          name: branch.name,
          description: origin.id === 'venom' ? '以专属毒素状态塑造战斗节奏' : '解锁四项主动技能与永久被动',
          unlocked,
          unlockPrice: unlocked ? undefined : branch.unlockGold,
          lockedReason: unlocked ? undefined : state.gold < branch.unlockGold ? `金币不足，需要 ${branch.unlockGold}` : `消耗 ${branch.unlockGold} 金币解锁`,
          passiveName: config.passives.find((passive) => passive.branchId === branch.id && !passive.subtypeId)?.name,
        };
      }),
    })),
    player: {
      name: currentOrigin ? `${config.origins.find((origin) => origin.id === currentOrigin)?.name ?? ''}之蛇` : '无名蛇',
      level: state.characterLevel,
      health: state.player.health,
      maxHealth: state.player.maxHealth,
      shield: state.player.shield,
      maxShield: Math.max(100, state.player.shield),
      characterXp: state.characterXp,
      characterXpToNext: nextThreshold,
      skillXp: state.skillXp,
      gold: state.gold,
      venomPoints: state.venomPoints,
    },
    loadout: ([1, 2, 3, 4] as const).map((slot) => {
      const skillId = state.loadout[slot];
      return skillId ? skillById.get(skillId) ?? null : null;
    }),
    skills,
    panels,
    activePanel: selection.activePanel,
    subtypes: config.subtypes.map((subtype) => ({
      id: subtype.id,
      name: subtype.name,
      branchName: config.branches.find((branch) => branch.id === subtype.branchId)?.name ?? '',
      description: state.enhancedSubtypeIds.includes(subtype.id) ? '已获得毒液强化 +15%' : '切换后替换整套主动与被动',
      unlocked: state.unlockedSubtypeIds.includes(subtype.id),
      active: state.activeSubtypeId === subtype.id,
      unlockPrice: state.unlockedSubtypeIds.includes(subtype.id) ? undefined : subtype.unlockGold,
      lockedReason: state.unlockedBranchIds.includes(subtype.branchId) ? `消耗 ${subtype.unlockGold} 金币解锁` : '需先解锁所属大分支',
      enhanced: state.enhancedSubtypeIds.includes(subtype.id),
      canEnhance: state.venomPoints > 0 && state.unlockedSubtypeIds.includes(subtype.id) && !state.enhancedSubtypeIds.includes(subtype.id),
    })),
    inCombat: state.inCombat,
    canEditLoadout: state.phase === 'active' && !state.inCombat,
    loadoutLockReason: state.inCombat ? '战斗中不能修改出战配置' : null,
    activePassives: config.passives.filter((passive) => state.originId === 'venom'
      ? passive.subtypeId === state.activeSubtypeId
      : state.unlockedBranchIds.includes(passive.branchId) && !passive.subtypeId).map((passive) => ({
      id: passive.id,
      name: passive.name,
      description: passive.description,
    })),
    playerStatuses: [],
    target: selection.target ?? null,
    notice: state.objectiveCompleted ? '本轮目标完成！你可以继续无尽游玩。' : undefined,
  };
}

function mapSkill(skillId: string, state: GameState, config: GameConfig): UiSkill {
  const skill = config.skills.find((entry) => entry.id === skillId)!;
  const runtime = state.skillRuntime[skill.id];
  const cooldown = runtime?.cooldownRemainingMs ? ` · 冷却 ${(runtime.cooldownRemainingMs / 1000).toFixed(1)}s` : '';
  const charge = runtime?.charges !== undefined ? ` · 充能 ${runtime.charges}/${skill.maxCharges}` : '';
  return {
    id: skill.id,
    name: skill.name,
    slotLabel: String(skill.order),
    icon: skill.damageType === 'venom' ? '☣' : skill.baseDamage > 80 ? '◆' : '↗',
    description: `${skill.baseDamage ? `${skill.baseDamage} ${skill.damageType === 'venom' ? '毒素' : '物理'}伤害` : '战术技能'}${cooldown}${charge}`,
    unlocked: state.openSkillIds.includes(skill.id),
    level: state.skillLevels[skill.id] ?? 1,
    maxLevel: config.maxSkillLevel,
    openLevel: skill.unlockLevel,
    cooldownRemainingMs: runtime?.cooldownRemainingMs,
    charges: runtime?.charges,
    maxCharges: skill.maxCharges,
    upgradeCost: config.skillUpgradeXpCost,
    canUpgrade: state.openSkillIds.includes(skill.id) && state.skillXp >= config.skillUpgradeXpCost && (state.skillLevels[skill.id] ?? 1) < config.maxSkillLevel,
    lockedReason: state.openSkillIds.includes(skill.id) ? undefined : `角色达到 ${skill.unlockLevel} 级且解锁所属分支后开放`,
  };
}
