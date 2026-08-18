import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameShell } from './GameShell';
import type { GameUiActions, GameViewModel } from './types';

const actions: GameUiActions = {
  chooseOrigin: vi.fn(),
  chooseBranch: vi.fn(),
  createRun: vi.fn(),
  equipSkill: vi.fn(),
  openPanel: vi.fn(),
  closePanel: vi.fn(),
  selectSubtype: vi.fn(),
  unlockBranch: vi.fn(),
  unlockSubtype: vi.fn(),
  assignVenomPoint: vi.fn(),
  upgradeSkill: vi.fn(),
  resetRun: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const viewModel: GameViewModel = {
  screen: 'creation',
  selectedOriginId: 'size',
  selectedBranchId: 'thick-armor',
  origins: [
    { id: 'size', name: '体型', description: '巨躯与生存', branches: [{ id: 'thick-armor', name: '厚甲生存', description: '角质护甲', unlocked: true, passiveName: '角质增厚' }, { id: 'size-regeneration', name: '蜕皮再生', description: '快速恢复', unlockPrice: 1, lockedReason: '消耗 1 金币解锁' }] },
    { id: 'strength', name: '力量', description: '撕咬与绞杀', branches: [{ id: 'fierce-brawl', name: '猛力搏杀', description: '锐牙搏杀' }] },
    { id: 'venom', name: '毒素', description: '毒液与状态', branches: [{ id: 'neurotoxin', name: '神经毒素', description: '麻痹猎物' }] },
  ],
  player: { name: '无名蛇', level: 3, health: 76, maxHealth: 100, shield: 20, maxShield: 40, characterXp: 45, characterXpToNext: 100, skillXp: 18, gold: 1, venomPoints: 1 },
  loadout: [null, null, null, null],
  skills: [
    { id: 'wind-glide', name: '疾风滑行', slotLabel: '1', icon: '↗', unlocked: true, level: 1, maxLevel: 17, description: '快速滑行脱离险境。', openLevel: 3, cooldownRemainingMs: 1500, maxCharges: 2, charges: 1, upgradeCost: 5, canUpgrade: true },
    { id: 'mountain-slam', name: '山岳重压', slotLabel: '4', icon: '◆', unlocked: false, level: 1, maxLevel: 17, description: '重压猎物。', openLevel: 9, lockedReason: '角色等级达到 9 级后开放', upgradeCost: 20, canUpgrade: false },
  ],
  panels: ['overview', 'branches', 'subtypes', 'skills', 'loadout', 'status', 'upgrade'],
  activePanel: null,
  subtypes: [
    { id: 'alpha-neuro', name: 'α-神经毒素', branchName: '神经毒素', unlocked: true, active: true, enhanced: false, canEnhance: true, description: '以麻痹压制猎物。' },
    { id: 'beta-neuro', name: 'β-神经毒素', branchName: '神经毒素', unlocked: false, active: false, unlockPrice: 1, lockedReason: '消耗 1 金币解锁', description: '以神经冲击阻断猎物。' },
  ],
  inCombat: false,
  canEditLoadout: true,
  loadoutLockReason: null,
  activePassives: [{ id: 'keratin', name: '角质增厚', description: '获得额外护甲。' }],
  playerStatuses: [{ id: 'harden', name: '角质硬化', source: '厚甲生存', remainingMs: 4200, description: '承受伤害降低。' }],
  target: { name: '荒野巨蜥', health: 250, maxHealth: 300, statuses: [{ id: 'paralysis', name: '麻痹', stacks: 3, remainingMs: 2600, description: '移动与攻击受限。' }] },
};

function renderShell(overrides: Partial<GameViewModel> = {}) {
  return render(<GameShell viewModel={{ ...viewModel, ...overrides }} actions={actions} />);
}

describe('GameShell', () => {
  it('requires origin and branch selection before creating a run', () => {
    renderShell({ selectedOriginId: null, selectedBranchId: null });
    expect((screen.getByRole('button', { name: /化蛇入荒野/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('creates the selected origin and branch', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /化蛇入荒野/ }));
    expect(actions.createRun).toHaveBeenCalledWith('size', 'thick-armor');
  });

  it('opens all seven ESC panels', () => {
    renderShell({ screen: 'game' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '荒野面板' })).not.toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(actions.openPanel).toHaveBeenCalledWith('overview');
  });

  it('equips an unlocked skill by dropping it onto a loadout slot', () => {
    renderShell({ screen: 'game', activePanel: 'skills' });
    const skill = screen.getByTestId('skill-wind-glide');
    const slot = screen.getByTestId('loadout-slot-1');
    fireEvent.dragStart(skill, { dataTransfer: { setData: vi.fn() } });
    fireEvent.drop(slot, { dataTransfer: { getData: () => 'wind-glide' } });
    expect(actions.equipSkill).toHaveBeenCalledWith('wind-glide', 1);
  });

  it('shows a combat lock explanation for subtype switching', () => {
    renderShell({ screen: 'game', inCombat: true, activePanel: 'subtypes' });
    expect(screen.getByText('战斗中不能切换亚型')).not.toBeNull();
    expect((screen.getByRole('button', { name: '激活 α-神经毒素' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows branch price and unlocks a same-origin branch', () => {
    renderShell({ screen: 'game', activePanel: 'branches' });
    expect(screen.getByText('消耗 1 金币解锁')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '解锁 蜕皮再生（1 金币）' }));
    expect(actions.unlockBranch).toHaveBeenCalledWith('size-regeneration');
  });

  it('unlocks and enhances toxin subtypes with distinct actions', () => {
    renderShell({ screen: 'game', activePanel: 'subtypes' });
    expect(screen.getByRole('region', { name: '毒素亚型列表' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '解锁 β-神经毒素（1 金币）' }));
    fireEvent.click(screen.getByRole('button', { name: '激活 α-神经毒素' }));
    fireEvent.click(screen.getByRole('button', { name: '投入毒液点到 α-神经毒素' }));
    expect(actions.unlockSubtype).toHaveBeenCalledWith('beta-neuro');
    expect(actions.selectSubtype).toHaveBeenCalledWith('alpha-neuro');
    expect(actions.assignVenomPoint).toHaveBeenCalledWith('alpha-neuro');
  });

  it('presents cooldown, charges and upgrade cost, then upgrades an eligible skill', () => {
    renderShell({ screen: 'game', activePanel: 'upgrade' });
    expect(screen.getByText('冷却 1.5s')).not.toBeNull();
    expect(screen.getByText('充能 1/2')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '升级 疾风滑行（5 技能经验）' }));
    expect(actions.upgradeSkill).toHaveBeenCalledWith('wind-glide');
  });

  it('renders overview passives and player status detail', () => {
    renderShell({ screen: 'game', activePanel: 'overview' });
    expect(screen.getByText('角质增厚')).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '状态面板' }));
    expect(screen.getByText('角质硬化')).not.toBeNull();
    expect(screen.getByText('剩余 4.2s')).not.toBeNull();
  });

  it('renders target debuff name, stacks and remaining time in both HUD and status panel', () => {
    renderShell({ screen: 'game', activePanel: 'status' });
    expect(screen.getByLabelText('目标状态 麻痹，3 层，剩余 2.6s')).not.toBeNull();
    expect(screen.getByText('麻痹 ×3')).not.toBeNull();
    expect(screen.getByText('剩余 2.6s')).not.toBeNull();
  });

  it('exposes the notice as an accessible visual status message', () => {
    renderShell({ screen: 'game', notice: '金币不足，需要 1 金币' });
    expect(screen.getByRole('status').textContent).toBe('金币不足，需要 1 金币');
  });

  it('resets only from the death screen after R is pressed', () => {
    renderShell({ screen: 'death' });
    fireEvent.keyDown(window, { key: 'r' });
    expect(actions.resetRun).toHaveBeenCalledTimes(1);
  });
});
