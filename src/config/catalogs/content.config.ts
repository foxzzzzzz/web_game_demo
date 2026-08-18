import type { BranchDefinition, EffectDefinition, OriginDefinition, PassiveDefinition, SkillDefinition, StatusDefinition, SubtypeDefinition } from '../types';
import { phase2PhysicalEffects, phase2PhysicalMetadata, phase2PhysicalPassiveDescriptions, phase2PhysicalPassiveEffects } from './phase2-physical.effects';
import { phase3VenomDefaultEffects, phase3VenomDefaultMetadata, phase3VenomDefaultPassiveEffects } from './phase3-venom-default.effects';
import { phase4VenomAEffects, phase4VenomAMetadata, phase4VenomAPassiveEffects } from './phase4-venom-a.effects';
import { phase4VenomBEffects, phase4VenomBMetadata, phase4VenomBPassiveEffects } from './phase4-venom-b.effects';
import { phase4VenomCEffects, phase4VenomCMetadata, phase4VenomCPassiveEffects } from './phase4-venom-c.effects';
import { statusStackBaselines } from '../status-stack-baselines.config';
import { statusTraitDefinitions } from '../status-traits.config';
import { applyDamageBaselines } from '../damage-baselines.config';
import { applyMechanicalBaselines } from '../mechanic-baselines.config';

/** 全内容目录：原稿明确的 CD/充能以秒转毫秒保存；只对原文“小幅/少量/高额”等量词使用 `baseline-quantified`。 */
const baseline = (statusId: string, stacks: number): EffectDefinition[] => [{ type: 'status', target: 'target', statusId, stacks, tags: ['apply-status'] }];
type Seed = readonly [string, string, string, number?, string?, number?];

function skillSet(branchId: string, subtypeId: string | undefined, defaultStatusId: string, seeds: readonly Seed[]): SkillDefinition[] {
  return seeds.map(([id, name, timing, baseDamage = 0, statusId = defaultStatusId, statusStacks = 1], index) => {
    const phaseOne = phaseOneEffects[id];
    const phaseTwo = phase2PhysicalEffects[id];
    const phaseThree = phase3VenomDefaultEffects[id];
    const phaseFourA = phase4VenomAEffects[id];
    const phaseFourB = phase4VenomBEffects[id];
    const phaseFourC = phase4VenomCEffects[id];
    const metadata = phaseOneMetadata[id] ?? phase2PhysicalMetadata[id] ?? phase3VenomDefaultMetadata[id] ?? phase4VenomAMetadata[id] ?? phase4VenomBMetadata[id] ?? phase4VenomCMetadata[id];
    const resolvedBaseDamage = metadata?.baseDamage ?? baseDamage;
    const resolvedStatusId = metadata?.statusId !== undefined ? metadata.statusId : statusId;
    const resolvedStatusStacks = metadata?.statusStacks ?? statusStacks;
    const charge = timing.startsWith('q');
    const seconds = Number(timing.replace(/^q\d+:/, ''));
    const maxCharges = charge ? Number(timing[1]) : undefined;
    const effects = applyMechanicalBaselines(applyDamageBaselines(phaseOne ?? phaseTwo ?? phaseThree ?? phaseFourA ?? phaseFourB ?? phaseFourC ?? [...(resolvedBaseDamage > 0 ? [{ type: 'damage' as const, target: 'target' as const, magnitude: resolvedBaseDamage, tags: ['skill-damage'] }, ...baseline(resolvedStatusId!, resolvedStatusStacks)] : baseline(resolvedStatusId!, resolvedStatusStacks)), ...explicitSkillEffects[id] ?? []]));
    return {
      id, branchId, subtypeId, name, order: (index + 1) as 1 | 2 | 3 | 4, unlockLevel: ([3, 5, 7, 9] as const)[index],
      ...(charge ? { maxCharges, rechargeMs: seconds * 1000 } : { cooldownMs: seconds * 1000 }),
      baseDamage: resolvedBaseDamage, damageType: branchId.startsWith('venom-') ? 'venom' : 'physical', ...(resolvedStatusId ? { statusId: resolvedStatusId } : {}), ...(resolvedStatusId ? { statusStacks: resolvedStatusStacks } : {}),
      scalesDamageWithLevel: resolvedBaseDamage > 0, effects,
    };
  });
}

export const origins: OriginDefinition[] = [{ id: 'size', name: '体型' }, { id: 'strength', name: '力量' }, { id: 'venom', name: '毒素' }];

export const branches: BranchDefinition[] = [...([
  ['size-thick-armor', 'size', '厚甲生存'], ['size-regeneration', 'size', '蜕皮再生'], ['size-stealth', 'size', '狭域潜行'], ['size-oppression', 'size', '巨躯镇压'], ['size-adversity', 'size', '逆境求生'],
  ['strength-ferocious', 'strength', '猛力搏杀'], ['strength-counter', 'strength', '反击格斗'], ['strength-rage', 'strength', '狂暴狂怒'], ['strength-strangle', 'strength', '绞杀控制'], ['strength-hunt', 'strength', '猎杀突袭'],
].map(([id, originId, name]) => ({ id, originId: originId as 'size' | 'strength', name, unlockGold: 1 })) as BranchDefinition[]),
  { id: 'venom-neuro', originId: 'venom', name: '神经毒素', unlockGold: 1, defaultSubtypeId: 'venom-neuro-alpha' },
  { id: 'venom-hemorrhage', originId: 'venom', name: '出血毒素', unlockGold: 1, defaultSubtypeId: 'venom-hemorrhage-a' },
  { id: 'venom-coagulation', originId: 'venom', name: '凝血毒素', unlockGold: 1, defaultSubtypeId: 'venom-coagulation-oscutarin-c' },
  { id: 'venom-necrosis', originId: 'venom', name: '细胞坏死毒素', unlockGold: 1, defaultSubtypeId: 'venom-necrosis-beta' },
  { id: 'venom-hallucinogen', originId: 'venom', name: '迷幻毒素', unlockGold: 1, defaultSubtypeId: 'venom-hallucinogen-i' },
  { id: 'venom-muscle', originId: 'venom', name: '肌肉毒素', unlockGold: 1, defaultSubtypeId: 'venom-muscle-alpha' },
  { id: 'venom-kidney', originId: 'venom', name: '肾脏毒素', unlockGold: 1, defaultSubtypeId: 'venom-kidney-s' },
  { id: 'venom-heart', originId: 'venom', name: '心脏毒素', unlockGold: 1, defaultSubtypeId: 'venom-heart-gamma' },
];

const subtypeRows: readonly (readonly [string, string, string])[] = [
  ['venom-neuro-alpha', 'venom-neuro', 'α-神经毒素'], ['venom-neuro-beta', 'venom-neuro', 'β-神经毒素'], ['venom-neuro-kappa', 'venom-neuro', 'κ-神经毒素'], ['venom-neuro-delta', 'venom-neuro', 'δ-神经毒素'],
  ['venom-hemorrhage-a', 'venom-hemorrhage', 'A亚型'], ['venom-hemorrhage-b', 'venom-hemorrhage', 'B亚型'], ['venom-hemorrhage-c', 'venom-hemorrhage', 'C亚型'], ['venom-hemorrhage-d', 'venom-hemorrhage', 'D亚型'],
  ['venom-coagulation-oscutarin-c', 'venom-coagulation', 'Oscutarin-C'], ['venom-coagulation-small', 'venom-coagulation', '促凝小分子'], ['venom-coagulation-diffuse', 'venom-coagulation', '弥散促凝'], ['venom-coagulation-delayed', 'venom-coagulation', '迟效凝固'],
  ['venom-necrosis-beta', 'venom-necrosis', 'β细胞坏死'], ['venom-necrosis-alpha', 'venom-necrosis', 'α细胞溶解'], ['venom-necrosis-gamma', 'venom-necrosis', 'γ细胞崩解'], ['venom-necrosis-epsilon', 'venom-necrosis', 'ε组织坏死'],
  ['venom-hallucinogen-i', 'venom-hallucinogen', 'Ⅰ迷幻突触'], ['venom-hallucinogen-ii', 'venom-hallucinogen', 'Ⅱ致幻麻痹'], ['venom-hallucinogen-iii', 'venom-hallucinogen', 'Ⅲ精神耗竭'], ['venom-hallucinogen-iv', 'venom-hallucinogen', 'Ⅳ错乱后遗'],
  ['venom-muscle-alpha', 'venom-muscle', 'α肌溶毒素'], ['venom-muscle-beta', 'venom-muscle', 'β肌坏死'], ['venom-muscle-gamma', 'venom-muscle', 'γ衰弱瘫软'], ['venom-muscle-delta', 'venom-muscle', 'δ叠层增幅'],
  ['venom-kidney-s', 'venom-kidney', 'S溶血肾毒'], ['venom-kidney-l', 'venom-kidney', 'L溶血'], ['venom-kidney-m', 'venom-kidney', 'M持续耗损'], ['venom-kidney-x', 'venom-kidney', 'X爆发肾毒'],
  ['venom-heart-gamma', 'venom-heart', 'γ心毒'], ['venom-heart-delta', 'venom-heart', 'δ心肌消融'], ['venom-heart-epsilon', 'venom-heart', 'ε骤停高危'], ['venom-heart-zeta', 'venom-heart', 'ζ持久心毒'],
];
export const subtypes: SubtypeDefinition[] = subtypeRows.map(([id, branchId, name], index) => ({ id, branchId, name, unlockGold: index % 4 === 0 ? 0 : 1 }));

const passiveRows: readonly (readonly [string, string, string, string?])[] = [
  ['size-thick-armor-passive', '角质增厚', 'size-thick-armor'], ['size-regeneration-passive', '再生体质', 'size-regeneration'], ['size-stealth-passive', '幽行适应', 'size-stealth'], ['size-oppression-passive', '巨兽体魄', 'size-oppression'], ['size-adversity-passive', '绝境韧性', 'size-adversity'],
  ['strength-ferocious-passive', '锐牙', 'strength-ferocious'], ['strength-counter-passive', '见招拆招', 'strength-counter'], ['strength-rage-passive', '嗜血狂性', 'strength-rage'], ['strength-strangle-passive', '绞压精通', 'strength-strangle'], ['strength-hunt-passive', '猎手直觉', 'strength-hunt'],
  ['venom-neuro-alpha-passive', '缓麻累积', 'venom-neuro', 'venom-neuro-alpha'], ['venom-neuro-beta-passive', '锐毒速侵', 'venom-neuro', 'venom-neuro-beta'], ['venom-neuro-kappa-passive', '能力封锁', 'venom-neuro', 'venom-neuro-kappa'], ['venom-neuro-delta-passive', '潜伏毒种', 'venom-neuro', 'venom-neuro-delta'],
  ['venom-hemorrhage-a-passive', '裂伤扩增', 'venom-hemorrhage', 'venom-hemorrhage-a'], ['venom-hemorrhage-b-passive', '血蚀腐蚀', 'venom-hemorrhage', 'venom-hemorrhage-b'], ['venom-hemorrhage-c-passive', '断血封禁', 'venom-hemorrhage', 'venom-hemorrhage-c'], ['venom-hemorrhage-d-passive', '猎血感应', 'venom-hemorrhage', 'venom-hemorrhage-d'],
  ['venom-coagulation-oscutarin-c-passive', '促凝爆发', 'venom-coagulation', 'venom-coagulation-oscutarin-c'], ['venom-coagulation-small-passive', '速凝扩散', 'venom-coagulation', 'venom-coagulation-small'], ['venom-coagulation-diffuse-passive', '毒核残留', 'venom-coagulation', 'venom-coagulation-diffuse'], ['venom-coagulation-delayed-passive', '迟滞血凝', 'venom-coagulation', 'venom-coagulation-delayed'],
  ['venom-necrosis-beta-passive', '腐坏蔓延', 'venom-necrosis', 'venom-necrosis-beta'], ['venom-necrosis-alpha-passive', '溶甲蚀皮', 'venom-necrosis', 'venom-necrosis-alpha'], ['venom-necrosis-gamma-passive', '持续崩解', 'venom-necrosis', 'venom-necrosis-gamma'], ['venom-necrosis-epsilon-passive', '病灶印记', 'venom-necrosis', 'venom-necrosis-epsilon'],
  ['venom-hallucinogen-i-passive', '迷幻扰动', 'venom-hallucinogen', 'venom-hallucinogen-i'], ['venom-hallucinogen-ii-passive', '幻麻交织', 'venom-hallucinogen', 'venom-hallucinogen-ii'], ['venom-hallucinogen-iii-passive', '精神透支', 'venom-hallucinogen', 'venom-hallucinogen-iii'], ['venom-hallucinogen-iv-passive', '错乱后遗', 'venom-hallucinogen', 'venom-hallucinogen-iv'],
  ['venom-muscle-alpha-passive', '肌蚀硬化', 'venom-muscle', 'venom-muscle-alpha'], ['venom-muscle-beta-passive', '肌腐易伤', 'venom-muscle', 'venom-muscle-beta'], ['venom-muscle-gamma-passive', '衰弱加深', 'venom-muscle', 'venom-muscle-gamma'], ['venom-muscle-delta-passive', '急速积毒', 'venom-muscle', 'venom-muscle-delta'],
  ['venom-kidney-s-passive', '毒肾反激', 'venom-kidney', 'venom-kidney-s'], ['venom-kidney-l-passive', '溶肾流血', 'venom-kidney', 'venom-kidney-l'], ['venom-kidney-m-passive', '耗毒久存', 'venom-kidney', 'venom-kidney-m'], ['venom-kidney-x-passive', '蓄毒待发', 'venom-kidney', 'venom-kidney-x'],
  ['venom-heart-gamma-passive', '心衰压制', 'venom-heart', 'venom-heart-gamma'], ['venom-heart-delta-passive', '心蚀滞行', 'venom-heart', 'venom-heart-delta'], ['venom-heart-epsilon-passive', '心脏危象', 'venom-heart', 'venom-heart-epsilon'], ['venom-heart-zeta-passive', '残毒余悸', 'venom-heart', 'venom-heart-zeta'],
];
const passiveDetails: Record<string, { description: string; effects: EffectDefinition[] }> = {
  'size-thick-armor-passive': { description: '永久获得12%物理伤害减免。', effects: [{ type: 'buff', target: 'self', magnitude: 0.12, tags: ['physical-damage-reduction', 'permanent'] }] },
  'size-regeneration-passive': { description: '自身所有持续回血治疗量永久提高30%。', effects: [{ type: 'buff', target: 'self', magnitude: 0.3, tags: ['heal-over-time-multiplier', 'permanent'] }] },
  'size-stealth-passive': { description: '草丛、洞穴环境中的移动速度永久提高22%。', effects: [{ type: 'buff', target: 'self', magnitude: 0.22, tags: ['move-speed', 'environment:grass,cave', 'permanent'] }] },
  'size-oppression-passive': { description: '自身最大生命值永久增加220点。', effects: [{ type: 'buff', target: 'self', magnitude: 220, tags: ['max-health', 'permanent'] }] },
  'size-adversity-passive': { description: '每损失10%生命提高4.5%物理减伤，最高36%。', effects: [{ type: 'trigger', target: 'self', magnitude: 0.045, stacks: 8, tags: ['per-missing-health-10-percent', 'physical-damage-reduction', 'cap:0.36'] }] },
  'strength-ferocious-passive': { description: '撕咬基础伤害永久增加25点。', effects: [{ type: 'buff', target: 'self', magnitude: 25, tags: ['bite-base-damage', 'permanent'] }] },
  'strength-counter-passive': { description: '格挡反击成功后获得5秒锐化，攻击伤害提高26%。', effects: [{ type: 'trigger', target: 'self', magnitude: 0.26, durationMs: 5000, statusId: 'sharpen', tags: ['on-counter-success', 'attack-damage'] }] },
  'strength-rage-passive': { description: '每损失10%生命提高7%攻击伤害，最高35%。', effects: [{ type: 'trigger', target: 'self', magnitude: 0.07, stacks: 5, tags: ['per-missing-health-10-percent', 'attack-damage', 'cap:0.35'] }] },
  'strength-strangle-passive': { description: '缠绕、禁锢类控制持续时间提高35%。', effects: [{ type: 'buff', target: 'self', magnitude: 0.35, tags: ['root-duration', 'control-duration'] }] },
  'strength-hunt-passive': { description: '永久拥有猎手感知，可透视周围受伤猎物位置。', effects: [{ type: 'buff', target: 'self', statusId: 'hunter-sense', tags: ['permanent', 'injured-target-reveal'] }] },
  'venom-neuro-alpha-passive': { description: '毒咬叠加麻痹；达到10层时直接眩晕2秒。', effects: [{ type: 'trigger', target: 'target', stacks: 10, durationMs: 2000, statusId: 'stun', tags: ['on-venom-bite', 'paralysis-threshold'] }] },
  'venom-neuro-beta-passive': { description: '麻痹叠层速度提高50%，但麻痹持续时间缩短40%。', effects: [{ type: 'buff', target: 'target', magnitude: 0.5, tags: ['paralysis-stack-rate'] }, { type: 'buff', target: 'target', magnitude: 0.4, tags: ['paralysis-duration-reduction'] }] },
  'venom-neuro-kappa-passive': { description: '毒素命中有30%概率施加4秒封能，使敌方专属被动失效。', effects: [{ type: 'trigger', target: 'target', magnitude: 0.3, durationMs: 4000, statusId: 'energy-seal', tags: ['on-venom-hit', 'chance'] }] },
  'venom-neuro-delta-passive': { description: '攻击留下毒素种子，8秒后自动爆发5层麻痹。', effects: [{ type: 'trigger', target: 'target', durationMs: 8000, stacks: 5, statusId: 'paralysis', tags: ['on-attack', 'delayed-toxin-seed'] }] },
  'venom-hemorrhage-a-passive': { description: '流血Debuff最大可叠加层数增加3层。', effects: [{ type: 'buff', target: 'target', stacks: 3, statusId: 'bleed', tags: ['max-stacks'] }] },
  'venom-hemorrhage-b-passive': { description: '流血同时附带每秒8点毒素腐蚀伤害。', effects: [{ type: 'damage', target: 'target', magnitude: 8, durationMs: 1000, statusId: 'bleed', tags: ['per-second', 'venom-corrosion'] }] },
  'venom-hemorrhage-c-passive': { description: '流血攻击有40%概率施加4秒破愈，禁止一切回血治疗。', effects: [{ type: 'trigger', target: 'target', magnitude: 0.4, durationMs: 4000, statusId: 'anti-heal', tags: ['on-bleed-hit', 'chance', 'healing-disabled'] }] },
  'venom-hemorrhage-d-passive': { description: '带流血Debuff的敌人永久被猎手感知标记位置。', effects: [{ type: 'mark', target: 'target', statusId: 'hunter-sense', tags: ['requires:bleed', 'permanent-reveal'] }] },
  'venom-coagulation-oscutarin-c-passive': { description: '技能叠加血栓层数的效率提高45%。', effects: [{ type: 'buff', target: 'target', magnitude: 0.45, statusId: 'thrombosis', tags: ['stack-efficiency'] }] },
  'venom-coagulation-small-passive': { description: '血栓可由目标扩散到周围2个敌人。', effects: [{ type: 'trigger', target: 'area', stacks: 2, statusId: 'thrombosis', tags: ['spread-target-count'] }] },
  'venom-coagulation-diffuse-passive': { description: '技能留下毒核标记，触碰敌人持续叠加血栓。', effects: [{ type: 'mark', target: 'area', statusId: 'toxin-core', tags: ['on-contact', 'apply:thrombosis'] }] },
  'venom-coagulation-delayed-passive': { description: '种下延时血凝标记，3秒后开始大量叠加血栓。', effects: [{ type: 'trigger', target: 'target', durationMs: 3000, statusId: 'thrombosis', tags: ['delayed-coagulation'] }] },
  'venom-necrosis-beta-passive': { description: '溃烂Debuff可向周边敌人小幅传染。', effects: [{ type: 'trigger', target: 'area', statusId: 'ulceration', tags: ['spread', 'baseline-quantified'] }] },
  'venom-necrosis-alpha-passive': { description: '溃烂降低敌人物理防御。', effects: [{ type: 'buff', target: 'target', statusId: 'ulceration', tags: ['physical-defense-reduction', 'baseline-quantified'] }] },
  'venom-necrosis-gamma-passive': { description: '溃烂结束后额外残留2秒毒素伤害。', effects: [{ type: 'damage', target: 'target', durationMs: 2000, statusId: 'ulceration', tags: ['after-expire', 'venom-residual'] }] },
  'venom-necrosis-epsilon-passive': { description: '攻击施加病灶印记，并提高对应引爆伤害。', effects: [{ type: 'mark', target: 'target', statusId: 'lesion-mark', tags: ['on-attack', 'detonation-bonus', 'baseline-quantified'] }] },
  'venom-hallucinogen-i-passive': { description: '混乱持续时间增加1秒。', effects: [{ type: 'buff', target: 'target', durationMs: 1000, statusId: 'confusion', tags: ['duration-bonus'] }] },
  'venom-hallucinogen-ii-passive': { description: '混乱同时附带少量麻痹层数。', effects: [{ type: 'trigger', target: 'target', statusId: 'paralysis', tags: ['on-confusion', 'baseline-quantified'] }] },
  'venom-hallucinogen-iii-passive': { description: '混乱结束后敌人攻击力降低25%，持续4秒。', effects: [{ type: 'buff', target: 'target', magnitude: 0.25, durationMs: 4000, statusId: 'weakness', tags: ['after-confusion-expire', 'attack-reduction'] }] },
  'venom-hallucinogen-iv-passive': { description: '混乱结束后敌人无目的四处乱跑。', effects: [{ type: 'trigger', target: 'target', statusId: 'confusion', tags: ['after-expire', 'wander'] }] },
  'venom-muscle-alpha-passive': { description: '肌肉僵直持续时间增加1秒。', effects: [{ type: 'buff', target: 'target', durationMs: 1000, statusId: 'muscle-stiffness', tags: ['duration-bonus'] }] },
  'venom-muscle-beta-passive': { description: '肌肉僵直目标受到的全部物理伤害提高25%。', effects: [{ type: 'buff', target: 'target', magnitude: 0.25, statusId: 'muscle-stiffness', tags: ['requires:muscle-stiffness', 'physical-damage-taken'] }] },
  'venom-muscle-gamma-passive': { description: '衰弱Debuff的全部效果提高。', effects: [{ type: 'buff', target: 'target', statusId: 'weakness', tags: ['effect-strength', 'baseline-quantified'] }] },
  'venom-muscle-delta-passive': { description: '肌肉类Debuff叠层速度提高50%。', effects: [{ type: 'buff', target: 'target', magnitude: 0.5, tags: ['muscle-debuff-stack-rate'] }] },
  'venom-kidney-s-passive': { description: '敌人释放技能时造成的肾毒反噬伤害提高。', effects: [{ type: 'buff', target: 'target', statusId: 'kidney-reprisal', tags: ['on-enemy-skill-cast', 'damage-bonus', 'baseline-quantified'] }] },
  'venom-kidney-l-passive': { description: '肾毒反噬同时附带流血Debuff。', effects: [{ type: 'trigger', target: 'target', statusId: 'bleed', tags: ['on-kidney-reprisal'] }] },
  'venom-kidney-m-passive': { description: '肾毒反噬持续时间增加3秒。', effects: [{ type: 'buff', target: 'target', durationMs: 3000, statusId: 'kidney-reprisal', tags: ['duration-bonus'] }] },
  'venom-kidney-x-passive': { description: '敌人多次释放技能会使肾毒积蓄层数并触发爆发。', effects: [{ type: 'trigger', target: 'target', statusId: 'kidney-reprisal', tags: ['on-enemy-skill-cast', 'stack-and-detonate'] }] },
  'venom-heart-gamma-passive': { description: '心蚀层数越高，敌人攻击力下降幅度越大。', effects: [{ type: 'buff', target: 'target', statusId: 'heart-erosion', tags: ['per-stack', 'attack-reduction', 'baseline-quantified'] }] },
  'venom-heart-delta-passive': { description: '心蚀同时附带减速效果。', effects: [{ type: 'trigger', target: 'target', statusId: 'slow', tags: ['on-heart-erosion'] }] },
  'venom-heart-epsilon-passive': { description: '心蚀叠满12层时有概率短暂造成心脏僵直。', effects: [{ type: 'trigger', target: 'target', stacks: 12, statusId: 'stun', tags: ['heart-erosion-threshold', 'chance', 'baseline-quantified'] }] },
  'venom-heart-zeta-passive': { description: '心蚀结束后残留2秒心脏毒素伤害。', effects: [{ type: 'damage', target: 'target', durationMs: 2000, statusId: 'heart-erosion', tags: ['after-expire', 'venom-residual'] }] },
};
export const passives: PassiveDefinition[] = passiveRows.map(([id, name, branchId, subtypeId]) => ({ id, name, branchId, subtypeId, ...(phase2PhysicalPassiveDescriptions[id] ? { description: phase2PhysicalPassiveDescriptions[id], effects: phase2PhysicalPassiveEffects[id] } : phase3VenomDefaultPassiveEffects[id] ? { ...passiveDetails[id], effects: phase3VenomDefaultPassiveEffects[id] } : phase4VenomAPassiveEffects[id] ? { ...passiveDetails[id], effects: phase4VenomAPassiveEffects[id] } : phase4VenomBPassiveEffects[id] ? { ...passiveDetails[id], effects: phase4VenomBPassiveEffects[id] } : phase4VenomCPassiveEffects[id] ? { ...passiveDetails[id], effects: phase4VenomCPassiveEffects[id] } : passiveDetails[id]) })).map((passive) => ({ ...passive, effects: applyMechanicalBaselines(applyDamageBaselines(passive.effects)) }));

/** 原稿中可直接量化的技能补充效果。其余技能的施加状态、伤害、CD/充能同样由 seed 与 skillSet 结构化生成。 */
const explicitSkillEffects: Record<string, EffectDefinition[]> = {
  'size-gale-glide': [{ type: 'move', target: 'self', magnitude: 8, tags: ['forward-dash'] }, { type: 'buff', target: 'self', magnitude: 0.25, durationMs: 3000, statusId: 'dodge', tags: ['dodge', 'refresh-not-stack'] }],
  'size-flexible-dodge': [{ type: 'buff', target: 'self', magnitude: 0.45, durationMs: 2500, statusId: 'dodge', tags: ['dodge-chance'] }],
  'size-hide-harden': [{ type: 'buff', target: 'self', magnitude: 0.35, durationMs: 6000, statusId: 'keratin', tags: ['physical-damage-reduction'] }, { type: 'buff', target: 'self', magnitude: 0.2, durationMs: 6000, tags: ['move-speed-reduction'] }],
  'size-colossus-shock': [{ type: 'status', target: 'area', durationMs: 3000, statusId: 'muscle-stiffness', tags: ['radius:6'] }],
  'size-force-molt': [{ type: 'dispel', target: 'self', stacks: 3, tags: ['negative-debuff'] }, { type: 'heal', target: 'self', magnitude: 120, durationMs: 8000, statusId: 'life-surge', tags: ['total-over-duration'] }],
  'size-molt-shock': [{ type: 'trigger', target: 'area', tags: ['radius:5', 'knockback:small'] }],
  'size-wound-surge': [{ type: 'heal', target: 'self', magnitude: 22, durationMs: 7000, tags: ['per-second', 'radius:7'] }],
  'size-rotting-smoke': [{ type: 'buff', target: 'self', magnitude: 0.3, durationMs: 5000, statusId: 'dodge', tags: ['dodge', 'smoke-radius:9'] }],
  'size-body-compress': [{ type: 'buff', target: 'self', durationMs: 4000, statusId: 'semi-stealth', tags: ['break-on:attack,skill'] }, { type: 'buff', target: 'self', magnitude: 0.15, tags: ['move-speed-reduction'] }],
  'size-ground-hide': [{ type: 'buff', target: 'self', durationMs: 12000, statusId: 'stealth', tags: ['break-on:move,attack,skill'] }],
  'size-burrow-ambush': [{ type: 'move', target: 'self', magnitude: 6, tags: ['requires:stealth'] }, { type: 'buff', target: 'self', magnitude: 0.4, tags: ['this-attack-damage-bonus'] }],
  'size-ground-root': [{ type: 'status', target: 'target', durationMs: 4000, statusId: 'root', tags: ['break-at-damage:160'] }, { type: 'damage', target: 'target', magnitude: 45, durationMs: 1000, tags: ['per-second', 'squeeze'] }],
  'size-mountain-crush': [{ type: 'status', target: 'area', durationMs: 3000, statusId: 'slow', magnitude: 0.3, tags: ['radius:5', 'move-speed-reduction'] }],
  'size-chain-quake': [{ type: 'status', target: 'area', stacks: 3, durationMs: 4000, statusId: 'weakness', magnitude: 0.18, tags: ['radius:7', 'move-speed-reduction-per-stack'] }],
  'size-brutal-ram': [{ type: 'move', target: 'self', magnitude: 11, tags: ['dash'] }, { type: 'trigger', target: 'target', tags: ['knockup:small,medium'] }],
  'size-hold-stance': [{ type: 'shield', target: 'self', magnitude: 240, durationMs: 5000, statusId: 'shield', tags: ['cannot-move'] }, { type: 'buff', target: 'self', magnitude: 0.42, durationMs: 5000, tags: ['physical-damage-reduction'] }],
  'size-escape': [{ type: 'dispel', target: 'self', statusId: 'root', tags: ['root,bind'] }, { type: 'buff', target: 'self', durationMs: 3000, statusId: 'escape-immunity', tags: ['control-immunity'] }],
  'size-pain-endure': [{ type: 'buff', target: 'self', magnitude: 0.32, durationMs: 4000, tags: ['all-damage-reduction', 'slow-immunity'] }],
  'size-tail-decoy': [{ type: 'move', target: 'self', magnitude: 7, tags: ['backward-teleport'] }, { type: 'shield', target: 'self', magnitude: 110, statusId: 'shield', tags: ['decoy-duration:6000', 'taunt'] }],
  'size-life-overdraw': [{ type: 'damage', target: 'self', magnitude: 0.22, tags: ['current-health-cost'] }, { type: 'buff', target: 'self', magnitude: 0.35, durationMs: 6000, tags: ['move-speed'] }, { type: 'buff', target: 'self', magnitude: 0.28, durationMs: 6000, tags: ['all-attack-damage'] }],
  'strength-lock-coil': [{ type: 'move', target: 'self', tags: ['pounce'] }, { type: 'status', target: 'target', durationMs: 4000, statusId: 'root', tags: ['break-at-damage:180'] }],
  'strength-force-burst': [{ type: 'buff', target: 'target', magnitude: 0.08, stacks: 10, tags: ['requires:root', 'per-missing-health-10-percent', 'damage-bonus'] }],
  'strength-savage-charge': [{ type: 'move', target: 'self', magnitude: 10, tags: ['dash'] }, { type: 'trigger', target: 'target', tags: ['knockback'] }],
  'strength-pounce-bite': [{ type: 'move', target: 'self', magnitude: 9, tags: ['long-range-pounce'] }],
  'strength-defensive-stance': [{ type: 'buff', target: 'self', magnitude: 0.3, durationMs: 3500, tags: ['damage-reduction', 'on-melee-hit:counterattack'] }],
  'strength-swing-bite': [{ type: 'damage', target: 'target', magnitude: 12, durationMs: 6000, stacks: 5, statusId: 'bleed', tags: ['per-stack-per-second'] }],
  'strength-chain-pounce': [{ type: 'trigger', target: 'target', stacks: 2, tags: ['pounce-count'] }],
  'strength-armor-break-ram': [{ type: 'buff', target: 'target', magnitude: 0.35, tags: ['ignore-physical-defense'] }],
  'strength-rage-form': [{ type: 'buff', target: 'self', magnitude: 0.4, durationMs: 5000, statusId: 'rage', tags: ['attack-damage'] }, { type: 'buff', target: 'self', magnitude: 0.25, durationMs: 5000, tags: ['damage-taken-increase'] }],
  'strength-rage-charge': [{ type: 'move', target: 'self', magnitude: 12, tags: ['requires:rage', 'dash'] }],
  'strength-blood-bite': [{ type: 'heal', target: 'self', magnitude: 0.35, tags: ['of-this-damage'] }],
  'strength-anger-shock': [{ type: 'buff', target: 'target', magnitude: 0.45, statusId: 'bleed', tags: ['requires:bleed', 'damage-taken'] }],
  'strength-multi-coil': [{ type: 'move', target: 'self', tags: ['pounce'] }, { type: 'status', target: 'target', statusId: 'root', tags: ['single-target'] }],
  'strength-choke': [{ type: 'damage', target: 'target', magnitude: 60, durationMs: 1000, statusId: 'root', tags: ['per-second', 'requires:root'] }],
  'strength-drag-tear': [{ type: 'move', target: 'target', tags: ['requires:root', 'pull-to-caster'] }],
  'strength-tight-root': [{ type: 'status', target: 'target', statusId: 'root', tags: ['break-at-damage:240'] }],
  'strength-low-flight': [{ type: 'move', target: 'self', magnitude: 7, tags: ['fast-pounce'] }],
  'strength-ambush-bite': [{ type: 'buff', target: 'target', magnitude: 0.6, tags: ['requires:back-attack', 'damage-bonus'] }],
  'strength-rapid-bite': [{ type: 'trigger', target: 'target', stacks: 2, tags: ['rapid-bite-count'] }],
  'strength-hunt-charge': [{ type: 'move', target: 'self', magnitude: 14, tags: ['requires:injured-target', 'locked-charge'] }],
};

/** Phase 1 三条垂直路线的逐项真实效果，覆盖默认生成器无法表达的目标、条件与持续结算。 */
const phaseOneEffects: Record<string, EffectDefinition[]> = {
  'size-gale-glide': [{ type: 'move', target: 'self', magnitude: 8, tags: ['dash', 'forward'] }, { type: 'buff', target: 'self', magnitude: 0.25, durationMs: 3000, statusId: 'dodge', tags: ['dodge-chance', 'refresh-not-stack'] }],
  'size-flexible-dodge': [{ type: 'buff', target: 'self', magnitude: 0.45, durationMs: 2500, statusId: 'dodge', tags: ['dodge-chance'] }],
  'size-hide-harden': [{ type: 'buff', target: 'self', magnitude: 0.35, durationMs: 6000, statusId: 'keratin', tags: ['physical-damage-reduction'] }, { type: 'buff', target: 'self', magnitude: 0.2, durationMs: 6000, tags: ['move-speed-reduction'] }],
  'size-colossus-shock': [{ type: 'damage', target: 'area', magnitude: 80, tags: ['radius:6', 'blunt'] }, { type: 'status', target: 'area', durationMs: 3000, statusId: 'muscle-stiffness', stacks: 1, tags: ['radius:6'] }],
  'strength-lock-coil': [{ type: 'move', target: 'self', tags: ['pounce'] }, { type: 'status', target: 'target', durationMs: 4000, statusId: 'root', stacks: 1, tags: ['break-at-damage:180'] }, { type: 'damage', target: 'target', magnitude: 52, durationMs: 4000, tags: ['per-second', 'squeeze'] }],
  'strength-force-burst': [{ type: 'damage', target: 'target', magnitude: 160, tags: ['requires:root'] }, { type: 'trigger', target: 'target', magnitude: 0.08, tags: ['requires:root', 'per-missing-health:0.1', 'damage-bonus'] }],
  'strength-savage-charge': [{ type: 'move', target: 'self', magnitude: 10, tags: ['dash'] }, { type: 'damage', target: 'target', magnitude: 170, tags: ['physical'] }, { type: 'trigger', target: 'target', magnitude: 3, tags: ['knockback'] }],
  'strength-pounce-bite': [{ type: 'move', target: 'self', magnitude: 9, tags: ['long-range-pounce'] }, { type: 'damage', target: 'target', magnitude: 210, tags: ['bite'] }],
  'venom-neuro-needle': [{ type: 'status', target: 'target', statusId: 'paralysis', stacks: 6, tags: ['direct-apply', 'toxin-fang'] }],
  'venom-neuro-alpha-2': [{ type: 'trigger', target: 'area', tags: ['radius:6', 'ring-wave'] }, { type: 'status', target: 'area', statusId: 'paralysis', stacks: 4, tags: ['direct-apply'] }, { type: 'status', target: 'area', statusId: 'slow', stacks: 1, durationMs: 3000, tags: ['direct-apply'] }],
  'venom-neuro-alpha-3': [{ type: 'status', target: 'target', statusId: 'silence', stacks: 1, durationMs: 3500, tags: ['active-skill-blocked', 'normal-attack-allowed'] }],
  'venom-neuro-alpha-4': [{ type: 'damage', target: 'target', magnitude: 14, tags: ['detonate', 'per-paralysis-stack'] }, { type: 'status', target: 'target', statusId: 'stun', stacks: 1, durationMs: 2500, tags: ['detonate', 'requires:paralysis-stacks:10'] }],
};

const phaseOneMetadata: Record<string, { baseDamage?: number; statusId?: string | null; statusStacks?: number }> = {
  'size-gale-glide': { baseDamage: 0, statusId: null }, 'size-flexible-dodge': { baseDamage: 0, statusId: null }, 'size-hide-harden': { baseDamage: 0, statusId: null },
  'strength-lock-coil': { baseDamage: 52, statusId: 'root', statusStacks: 1 }, 'strength-force-burst': { baseDamage: 160, statusId: null }, 'strength-savage-charge': { baseDamage: 170, statusId: null }, 'strength-pounce-bite': { baseDamage: 210, statusId: null },
  'venom-neuro-needle': { baseDamage: 0, statusId: 'paralysis', statusStacks: 6 }, 'venom-neuro-alpha-2': { baseDamage: 0, statusId: 'paralysis', statusStacks: 4 }, 'venom-neuro-alpha-3': { baseDamage: 0, statusId: 'silence', statusStacks: 1 }, 'venom-neuro-alpha-4': { baseDamage: 0, statusId: null },
};

const physicalSkills: readonly (readonly [string, readonly Seed[]])[] = [
  ['size-thick-armor', [['size-gale-glide', '疾风滑行', 'q2:8', 0, 'dodge'], ['size-flexible-dodge', '柔骨闪避', '18', 0, 'dodge'], ['size-hide-harden', '厚皮硬化', '24', 0, 'keratin'], ['size-colossus-shock', '巨躯震荡', '28', 80, 'muscle-stiffness']]],
  ['size-regeneration', [['size-force-molt', '强制蜕皮', 'q2:14', 0, 'life-surge'], ['size-molt-shock', '蜕皮冲击', '16', 60], ['size-wound-surge', '愈伤涌动', '32', 0, 'life-surge'], ['size-rotting-smoke', '腐皮迷烟', '26', 0, 'dodge']]],
  ['size-stealth', [['size-body-compress', '躯体压缩', '14', 0, 'semi-stealth'], ['size-ground-hide', '贴地隐匿', '30', 0, 'stealth'], ['size-burrow-ambush', '地穴突袭', 'q3:9', 130], ['size-ground-root', '地面禁锢缠绕', '27', 45, 'root']]],
  ['size-oppression', [['size-mountain-crush', '山岳重压', '15', 140, 'slow'], ['size-chain-quake', '连环震地', '24', 165, 'weakness'], ['size-brutal-ram', '蛮横顶撞', 'q2:18', 200], ['size-hold-stance', '固守姿态', '35', 0, 'shield']]],
  ['size-adversity', [['size-escape', '绝境脱身', 'q2:16', 0, 'escape-immunity'], ['size-pain-endure', '疼痛耐受', '29', 0, 'slow-immunity'], ['size-tail-decoy', '断尾诱敌', '33', 0, 'shield'], ['size-life-overdraw', '生命透支', '38', 0, 'damage-boost']]],
  ['strength-ferocious', [['strength-lock-coil', '锁死缠绕', '14', 52, 'root'], ['strength-force-burst', '绞力爆发', 'q2:12', 160], ['strength-savage-charge', '野蛮冲撞', '26', 170], ['strength-pounce-bite', '猛扑撕咬', 'q3:11', 210]]],
  ['strength-counter', [['strength-defensive-stance', '防御架势', '17', 90], ['strength-swing-bite', '甩咬撕裂', 'q2:14', 120, 'bleed', 5], ['strength-chain-pounce', '连环扑击', '25', 200], ['strength-armor-break-ram', '破防顶撞', '28', 150]]],
  ['strength-rage', [['strength-rage-form', '狂暴化', '16', 0, 'rage'], ['strength-rage-charge', '狂怒冲锋', 'q2:15', 140], ['strength-blood-bite', '噬血撕咬', '27', 180], ['strength-anger-shock', '怒火震荡', '34', 110]]],
  ['strength-strangle', [['strength-multi-coil', '多重缠绕', 'q2:13', 0, 'root'], ['strength-choke', '绞杀锁喉', '20', 60, 'root'], ['strength-drag-tear', '拖拽撕扯', '26', 0, 'root'], ['strength-tight-root', '紧缚禁锢', '32', 0, 'root']]],
  ['strength-hunt', [['strength-low-flight', '低空飞袭', 'q3:8', 110], ['strength-ambush-bite', '伏击猛咬', '20', 0], ['strength-rapid-bite', '速袭连咬', '24', 190], ['strength-hunt-charge', '追猎冲刺', '31', 175]]],
];

const venomSkills: readonly (readonly [string, string, readonly Seed[]])[] = [
  ['venom-neuro-alpha', 'paralysis', [['venom-neuro-needle', '麻痹毒刺', 'q2:10', 0, 'paralysis', 6], ['venom-neuro-alpha-2', '神经震荡波', '21', 0, 'paralysis', 4], ['venom-neuro-alpha-3', '迟感封印', '28', 0, 'silence'], ['venom-neuro-alpha-4', '麻痹爆发', '33', 140, 'paralysis', 10]]],
  ['venom-neuro-beta', 'paralysis', [['venom-neuro-beta-1', '速毒突咬', 'q3:7', 0, 'paralysis', 4], ['venom-neuro-beta-2', '断招毒浪', '19', 0, 'paralysis', 3], ['venom-neuro-beta-3', '神经锐化', '26', 0, 'toxin-amplified'], ['venom-neuro-beta-4', '连锁毒闪', '32', 0, 'paralysis']]],
  ['venom-neuro-kappa', 'energy-seal', [['venom-neuro-kappa-1', '神经封蚀', '15'], ['venom-neuro-kappa-2', '缄默毒雾', '23', 0, 'silence'], ['venom-neuro-kappa-3', '意志瓦解', '27', 0, 'weakness'], ['venom-neuro-kappa-4', '神经反噬', '35', 220]]],
  ['venom-neuro-delta', 'toxin-seed', [['venom-neuro-delta-1', '毒种植入', '13'], ['venom-neuro-delta-2', '幽隐毒袭', '20', 0, 'toxin-seed'], ['venom-neuro-delta-3', '延时麻痹领域', '29'], ['venom-neuro-delta-4', '引爆毒种', '34', 0, 'paralysis']]],
  ['venom-hemorrhage-a', 'bleed', [['venom-hemorrhage-a-1', '裂牙撕咬', 'q2:10', 0, 'bleed', 6], ['venom-hemorrhage-a-2', '溅射血毒', '20', 0, 'bleed', 4], ['venom-hemorrhage-a-3', '伤口恶化', '28', 0, 'bleed', 4], ['venom-hemorrhage-a-4', '血潮引爆', '33', 16, 'bleed']]],
  ['venom-hemorrhage-b', 'bleed', [['venom-hemorrhage-b-1', '腐血突咬', 'q2:9'], ['venom-hemorrhage-b-2', '腐蚀毒云', '21'], ['venom-hemorrhage-b-3', '血肉消融', '27'], ['venom-hemorrhage-b-4', '腐血爆裂', '34']]],
  ['venom-hemorrhage-c', 'anti-heal', [['venom-hemorrhage-c-1', '断愈毒牙', '15', 0, 'bleed'], ['venom-hemorrhage-c-2', '封禁毒雾', '22', 0, 'bleed'], ['venom-hemorrhage-c-3', '创伤禁锢', '29'], ['venom-hemorrhage-c-4', '绝命血爆', '36', 0, 'bleed']]],
  ['venom-hemorrhage-d', 'bleed', [['venom-hemorrhage-d-1', '寻血扑击', 'q2:9', 0, 'bleed', 5], ['venom-hemorrhage-d-2', '追踪毒浪', '20'], ['venom-hemorrhage-d-3', '血猎感知', '26', 0, 'hunter-sense'], ['venom-hemorrhage-d-4', '猎血屠戮', '32']]],
  ['venom-coagulation-oscutarin-c', 'thrombosis', [['venom-coagulation-oscutarin-c-1', '促凝毒牙', 'q2:10', 0, 'thrombosis', 5], ['venom-coagulation-oscutarin-c-2', '血栓冲击波', '22', 0, 'thrombosis', 4], ['venom-coagulation-oscutarin-c-3', '血液固化', '28', 0, 'thrombosis', 6], ['venom-coagulation-oscutarin-c-4', '血栓禁锢爆发', '34', 0, 'thrombosis', 12]]],
  ['venom-coagulation-small', 'thrombosis', [['venom-coagulation-small-1', '扩散毒刺', '12', 0, 'thrombosis', 4], ['venom-coagulation-small-2', '弥散毒雾', '21'], ['venom-coagulation-small-3', '连锁血凝', '27'], ['venom-coagulation-small-4', '全域血凝', '33']]],
  ['venom-coagulation-diffuse', 'toxin-core', [['venom-coagulation-diffuse-1', '布放毒核', '15'], ['venom-coagulation-diffuse-2', '毒核喷撒', '23'], ['venom-coagulation-diffuse-3', '毒核激化', '29'], ['venom-coagulation-diffuse-4', '毒核连锁引爆', '35', 0, 'thrombosis']]],
  ['venom-coagulation-delayed', 'thrombosis', [['venom-coagulation-delayed-1', '迟毒植入', '13', 0, 'thrombosis', 7], ['venom-coagulation-delayed-2', '迟毒领域', '20'], ['venom-coagulation-delayed-3', '延时增幅', '28'], ['venom-coagulation-delayed-4', '迟凝大爆', '34', 0, 'root']]],
  ['venom-necrosis-beta', 'ulceration', [['venom-necrosis-beta-1', '腐坏死咬', 'q2:11', 0, 'ulceration', 5], ['venom-necrosis-beta-2', '坏死毒波', '21'], ['venom-necrosis-beta-3', '病灶加深', '28', 0, 'ulceration', 5], ['venom-necrosis-beta-4', '溃烂崩解', '33', 13]]],
  ['venom-necrosis-alpha', 'ulceration', [['venom-necrosis-alpha-1', '溶蚀毒牙', '14'], ['venom-necrosis-alpha-2', '溶解毒雾', '22'], ['venom-necrosis-alpha-3', '脆化躯体', '27'], ['venom-necrosis-alpha-4', '溶爆毁灭', '34']]],
  ['venom-necrosis-gamma', 'ulceration', [['venom-necrosis-gamma-1', '崩碎毒刺', '13'], ['venom-necrosis-gamma-2', '崩解领域', '23'], ['venom-necrosis-gamma-3', '腐毒延续', '29'], ['venom-necrosis-gamma-4', '连锁崩灭', '35']]],
  ['venom-necrosis-epsilon', 'lesion-mark', [['venom-necrosis-epsilon-1', '烙印毒咬', '14', 0, 'ulceration'], ['venom-necrosis-epsilon-2', '病灶散播', '21'], ['venom-necrosis-epsilon-3', '病灶激化', '28'], ['venom-necrosis-epsilon-4', '病灶大爆炸', '36']]],
  ['venom-hallucinogen-i', 'confusion', [['venom-hallucinogen-i-1', '幻惑毒咬', 'q2:12'], ['venom-hallucinogen-i-2', '迷幻毒波', '22'], ['venom-hallucinogen-i-3', '心智搅乱', '29'], ['venom-hallucinogen-i-4', '癫狂爆发', '34']]],
  ['venom-hallucinogen-ii', 'confusion', [['venom-hallucinogen-ii-1', '幻麻突咬', '14', 0, 'paralysis', 3], ['venom-hallucinogen-ii-2', '幻雾迷障', '23'], ['venom-hallucinogen-ii-3', '感官错乱', '28'], ['venom-hallucinogen-ii-4', '幻麻风暴', '35', 0, 'paralysis']]],
  ['venom-hallucinogen-iii', 'confusion', [['venom-hallucinogen-iii-1', '耗神毒牙', '13'], ['venom-hallucinogen-iii-2', '耗竭毒云', '21'], ['venom-hallucinogen-iii-3', '心力掠夺', '27'], ['venom-hallucinogen-iii-4', '精神崩塌', '33', 0, 'stun']]],
  ['venom-hallucinogen-iv', 'confusion', [['venom-hallucinogen-iv-1', '后遗毒刺', '15'], ['venom-hallucinogen-iv-2', '疯乱领域', '24'], ['venom-hallucinogen-iv-3', '后遗延长', '30'], ['venom-hallucinogen-iv-4', '全域疯魔', '37']]],
  ['venom-muscle-alpha', 'muscle-stiffness', [['venom-muscle-alpha-1', '肌蚀毒牙', 'q2:10'], ['venom-muscle-alpha-2', '肌毒冲击波', '21', 0, 'weakness'], ['venom-muscle-alpha-3', '肌无力', '28', 0, 'weakness'], ['venom-muscle-alpha-4', '肌溶崩溃', '33']]],
  ['venom-muscle-beta', 'muscle-stiffness', [['venom-muscle-beta-1', '坏死毒咬', '14'], ['venom-muscle-beta-2', '肌腐毒雾', '22'], ['venom-muscle-beta-3', '肌脆化', '27'], ['venom-muscle-beta-4', '肌碎爆裂', '34']]],
  ['venom-muscle-gamma', 'weakness', [['venom-muscle-gamma-1', '瘫软毒刺', '13'], ['venom-muscle-gamma-2', '瘫软毒浪', '20'], ['venom-muscle-gamma-3', '四肢瘫废', '29'], ['venom-muscle-gamma-4', '彻底瘫软', '35', 0, 'muscle-stiffness']]],
  ['venom-muscle-delta', 'muscle-stiffness', [['venom-muscle-delta-1', '速蚀毒咬', 'q3:8'], ['venom-muscle-delta-2', '扩散肌毒', '21'], ['venom-muscle-delta-3', '叠毒激化', '26'], ['venom-muscle-delta-4', '肌毒大爆发', '32']]],
  ['venom-kidney-s', 'kidney-reprisal', [['venom-kidney-s-1', '肾蚀毒牙', 'q2:11'], ['venom-kidney-s-2', '肾毒毒波', '22'], ['venom-kidney-s-3', '毒肾激化', '28'], ['venom-kidney-s-4', '肾毒爆裂', '34']]],
  ['venom-kidney-l', 'kidney-reprisal', [['venom-kidney-l-1', '溶肾毒咬', '14', 0, 'bleed'], ['venom-kidney-l-2', '溶毒毒雾', '23'], ['venom-kidney-l-3', '耗损双增', '27'], ['venom-kidney-l-4', '溶肾爆', '35']]],
  ['venom-kidney-m', 'kidney-reprisal', [['venom-kidney-m-1', '久毒毒刺', '13'], ['venom-kidney-m-2', '耗竭领域', '21'], ['venom-kidney-m-3', '毒素滞留', '29'], ['venom-kidney-m-4', '无尽耗毒', '33']]],
  ['venom-kidney-x', 'kidney-reprisal', [['venom-kidney-x-1', '蓄毒毒牙', '15'], ['venom-kidney-x-2', '蓄毒散播', '24'], ['venom-kidney-x-3', '爆毒预充', '30'], ['venom-kidney-x-4', '肾毒大爆轰', '36']]],
  ['venom-heart-gamma', 'heart-erosion', [['venom-heart-gamma-1', '心蚀毒牙', 'q2:11'], ['venom-heart-gamma-2', '心毒震荡波', '22'], ['venom-heart-gamma-3', '心脏重压', '28'], ['venom-heart-gamma-4', '心衰爆发', '34']]],
  ['venom-heart-delta', 'heart-erosion', [['venom-heart-delta-1', '融心毒咬', '14', 0, 'slow'], ['venom-heart-delta-2', '融心毒雾', '23'], ['venom-heart-delta-3', '心力衰弱', '27'], ['venom-heart-delta-4', '心肌崩解爆', '35']]],
  ['venom-heart-epsilon', 'heart-erosion', [['venom-heart-epsilon-1', '危心毒刺', '13'], ['venom-heart-epsilon-2', '高危毒浪', '21'], ['venom-heart-epsilon-3', '心脏高压', '29'], ['venom-heart-epsilon-4', '心脏骤停爆发', '36', 0, 'stun']]],
  ['venom-heart-zeta', 'heart-erosion', [['venom-heart-zeta-1', '残留毒咬', '15'], ['venom-heart-zeta-2', '心毒弥散', '24'], ['venom-heart-zeta-3', '毒素延留', '30'], ['venom-heart-zeta-4', '持久心衰爆', '37']]],
];
export const skills: SkillDefinition[] = [...physicalSkills.flatMap(([branchId, seeds]) => skillSet(branchId, undefined, 'bleed', seeds)), ...venomSkills.flatMap(([subtypeId, statusId, seeds]) => skillSet(subtypes.find((subtype) => subtype.id === subtypeId)!.branchId, subtypeId, statusId, seeds))];

const statusRows: readonly (readonly [string, string, 'buff' | 'debuff' | 'control', boolean, number?, string?, number?])[] = [
  ['paralysis', '麻痹', 'debuff', false, 10], ['stun', '眩晕', 'control', true], ['bleed', '流血', 'debuff', false, 8], ['root', '禁锢缠绕', 'control', true], ['silence', '沉默', 'debuff', false], ['energy-seal', '封能', 'debuff', false], ['toxin-seed', '毒素种子', 'debuff', false], ['thrombosis', '血栓凝血', 'debuff', false, 12, 'root', 12], ['ulceration', '溃烂', 'debuff', false, 10], ['confusion', '混乱', 'debuff', false], ['heart-erosion', '心蚀', 'debuff', false, 12], ['muscle-stiffness', '肌肉僵直', 'debuff', false], ['weakness', '衰弱', 'debuff', false], ['kidney-reprisal', '肾毒反噬', 'debuff', false], ['anti-heal', '破愈', 'debuff', false], ['slow', '减速', 'debuff', false], ['dodge', '闪避', 'buff', false], ['keratin', '角质硬化', 'buff', false], ['life-surge', '生命涌动', 'buff', false], ['escape-immunity', '挣脱免疫', 'buff', false], ['shield', '护盾', 'buff', false], ['rage', '狂暴', 'buff', false], ['sharpen', '锐化', 'buff', false], ['toxin-amplified', '毒素激化', 'buff', false], ['hunter-sense', '猎手感知', 'buff', false], ['stealth', '隐身', 'buff', false], ['semi-stealth', '半隐身', 'buff', false], ['slow-immunity', '减速免疫', 'buff', false], ['damage-boost', '伤害强化', 'buff', false], ['toxin-core', '毒核标记', 'debuff', false], ['lesion-mark', '病灶印记', 'debuff', false],
];
const statusRestrictions: Partial<Record<string, Pick<StatusDefinition, 'blocksMovement' | 'blocksActions' | 'blocksSkills'>>> = {
  stun: { blocksMovement: true, blocksActions: true, blocksSkills: true },
  root: { blocksMovement: true },
  silence: { blocksSkills: true },
};
export const statuses: Record<string, StatusDefinition> = Object.fromEntries(statusRows.map(([id, name, kind, hardControl, maxStacks, thresholdStatusId, thresholdStacks]) => [id, { id, name, kind, durationMs: 6000, maxStacks: maxStacks ?? statusStackBaselines[id] ?? 1, stackMode: 'refresh-and-stack', hardControl, families: statusTraitDefinitions[id]?.families ?? [], traits: statusTraitDefinitions[id]?.traits ?? [], immunityFamilies: statusTraitDefinitions[id]?.immunityFamilies, immunityTraits: statusTraitDefinitions[id]?.immunityTraits, thresholdStatusId, thresholdStacks, ...statusRestrictions[id] }]));

/** 已审核效果机制注册表；配置校验会拒绝未登记的 type/tag，避免解析层出现隐式规则。 */
export const registeredEffectTypes = new Set<EffectDefinition['type']>(['damage', 'heal', 'shield', 'status', 'move', 'buff', 'dispel', 'mark', 'trigger']);
export const registeredEffectTags = new Set([...skills, ...passives].flatMap((entry) => entry.effects.flatMap((effect) => effect.tags ?? [])));
