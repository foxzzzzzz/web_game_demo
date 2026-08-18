export type OriginId = 'size' | 'strength' | 'venom' | string;
export type PanelId = 'overview' | 'branches' | 'subtypes' | 'skills' | 'loadout' | 'status' | 'upgrade';
export type GameScreen = 'creation' | 'game' | 'death';

export interface UiBranch {
  id: string;
  name: string;
  description: string;
  unlocked?: boolean;
  unlockPrice?: number;
  lockedReason?: string;
  passiveName?: string;
}

export interface UiOrigin {
  id: OriginId;
  name: string;
  description: string;
  branches: UiBranch[];
}

export interface UiSkill {
  id: string;
  name: string;
  slotLabel: string;
  icon: string;
  description: string;
  unlocked: boolean;
  level: number;
  maxLevel: number;
  openLevel?: number;
  cooldownRemainingMs?: number;
  charges?: number;
  maxCharges?: number;
  upgradeCost?: number;
  canUpgrade?: boolean;
  lockedReason?: string;
}

export interface UiSubtype {
  id: string;
  name: string;
  branchName: string;
  description: string;
  unlocked: boolean;
  active: boolean;
  unlockPrice?: number;
  lockedReason?: string;
  enhanced?: boolean;
  canEnhance?: boolean;
}

export interface UiStatus {
  id: string;
  name: string;
  stacks?: number;
  source?: string;
  description?: string;
  remainingMs?: number;
}

export interface GameViewModel {
  screen: GameScreen;
  selectedOriginId: OriginId | null;
  selectedBranchId: string | null;
  origins: UiOrigin[];
  player: {
    name: string;
    level: number;
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;
    characterXp: number;
    characterXpToNext: number;
    skillXp: number;
    gold: number;
    venomPoints: number;
  };
  loadout: Array<UiSkill | null>;
  skills: UiSkill[];
  panels: PanelId[];
  activePanel: PanelId | null;
  subtypes: UiSubtype[];
  inCombat: boolean;
  canEditLoadout: boolean;
  loadoutLockReason: string | null;
  activePassives: Array<{ id: string; name: string; description: string }>;
  playerStatuses: UiStatus[];
  target: { name: string; health: number; maxHealth: number; statuses: UiStatus[] } | null;
  notice?: string;
}

export interface GameUiActions {
  chooseOrigin(originId: OriginId): void;
  chooseBranch(branchId: string): void;
  createRun(originId: OriginId, branchId: string): void;
  equipSkill(skillId: string, slot: 1 | 2 | 3 | 4): void;
  openPanel(panelId: PanelId): void;
  closePanel(): void;
  selectSubtype(subtypeId: string): void;
  unlockBranch(branchId: string): void;
  unlockSubtype(subtypeId: string): void;
  assignVenomPoint(subtypeId: string): void;
  upgradeSkill(skillId: string): void;
  resetRun(): void;
}
