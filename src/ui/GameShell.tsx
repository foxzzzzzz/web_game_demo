import { DragEvent, useEffect, useState } from 'react';
import type { GameUiActions, GameViewModel, OriginId, PanelId, UiSkill } from './types';

const panelLabels: Record<PanelId, string> = {
  overview: '角色总览',
  branches: '大分支解锁',
  subtypes: '毒素亚型',
  skills: '总技能库',
  loadout: '出战配置',
  status: '状态面板',
  upgrade: '技能升级',
};

interface GameShellProps {
  viewModel: GameViewModel;
  actions: GameUiActions;
}

export function GameShell({ viewModel, actions }: GameShellProps) {
  const [menuOpen, setMenuOpen] = useState(Boolean(viewModel.activePanel));
  const [localPanel, setLocalPanel] = useState<PanelId | null>(null);
  const activePanel = menuOpen ? (localPanel ?? viewModel.activePanel ?? viewModel.panels[0]) : viewModel.activePanel;

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && viewModel.screen === 'game') {
        event.preventDefault();
        if (menuOpen) {
          actions.closePanel();
          setLocalPanel(null);
          setMenuOpen(false);
        } else {
          document.exitPointerLock?.();
          actions.openPanel(viewModel.panels[0]);
          setLocalPanel(viewModel.panels[0]);
          setMenuOpen(true);
        }
      }
      if (event.key.toLowerCase() === 'r' && viewModel.screen === 'death') actions.resetRun();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, menuOpen, viewModel.panels, viewModel.screen]);

  if (viewModel.screen === 'creation') return <CharacterCreation viewModel={viewModel} actions={actions} />;
  if (viewModel.screen === 'death') return <DeathScreen />;

  return (
    <main className="game-shell" aria-label="蛇之荒野游戏界面">
      <GameHud viewModel={viewModel} />
      <Loadout canEdit={viewModel.canEditLoadout} lockReason={viewModel.loadoutLockReason} skills={viewModel.loadout} onEquip={actions.equipSkill} />
      {viewModel.notice ? <p className="ui-notice" role="status">{viewModel.notice}</p> : null}
      {activePanel ? (
        <EscapePanel
          viewModel={viewModel}
          activePanel={activePanel}
          onPanelChange={(panel) => {
            setLocalPanel(panel);
            actions.openPanel(panel);
          }}
          onClose={() => {
            setMenuOpen(false);
            setLocalPanel(null);
            actions.closePanel();
          }}
          actions={actions}
        />
      ) : null}
    </main>
  );
}

function CharacterCreation({ viewModel, actions }: GameShellProps) {
  const selectedOrigin = viewModel.origins.find((origin) => origin.id === viewModel.selectedOriginId);
  const canCreate = Boolean(viewModel.selectedOriginId && viewModel.selectedBranchId);
  return (
    <main className="creation-screen" data-testid="character-creation">
      <section className="creation-card">
        <p className="eyebrow">重生之我化为蛇</p>
        <h1>选择你的蛇之本源</h1>
        <p className="creation-lede">本局永久选择一条进化路线。荒野会记住你的每一次蜕变。</p>
        <div className="origin-grid" role="list" aria-label="本源选择">
          {viewModel.origins.map((origin) => (
            <button
              aria-label={`选择 ${origin.name}`}
              className={`origin-card ${origin.id === viewModel.selectedOriginId ? 'is-selected' : ''}`}
              key={origin.id}
              onClick={() => actions.chooseOrigin(origin.id)}
              type="button"
            >
              <span className="origin-glyph" aria-hidden="true">{origin.id === 'venom' ? '☣' : origin.id === 'strength' ? '◈' : '◒'}</span>
              <strong>{origin.name}</strong>
              <small>{origin.description}</small>
            </button>
          ))}
        </div>
        {selectedOrigin ? (
          <section className="branch-picker" aria-label="初始分支">
            <h2>免费初始分支</h2>
            <div className="branch-grid">
              {selectedOrigin.branches.map((branch) => (
                <button
                  className={branch.id === viewModel.selectedBranchId ? 'is-selected' : ''}
                  key={branch.id}
                  onClick={() => actions.chooseBranch(branch.id)}
                  type="button"
                >
                  <strong>选择 {branch.name}</strong>
                  <span>{branch.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <button
          className="enter-wilds"
          disabled={!canCreate}
          onClick={() => actions.createRun(viewModel.selectedOriginId as OriginId, viewModel.selectedBranchId as string)}
          type="button"
        >
          化蛇入荒野
        </button>
      </section>
    </main>
  );
}

function GameHud({ viewModel }: Pick<GameShellProps, 'viewModel'>) {
  const { player, target } = viewModel;
  return (
    <header className="game-hud" data-testid="game-hud">
      <section className="player-vitals" aria-label="角色状态">
        <div className="player-title"><span className="snake-mark">◒</span><strong>{player.name}</strong><b>Lv.{player.level}</b></div>
        <Meter label="生命" value={player.health} max={player.maxHealth} tone="health" />
        <Meter label="护盾" value={player.shield} max={player.maxShield} tone="shield" />
        <Meter label="经验" value={player.characterXp} max={player.characterXpToNext} tone="experience" />
      </section>
      <section className="resource-strip" aria-label="局内资源">
        <span>技能经验 <b>{player.skillXp}</b></span><span>金币 <b>{player.gold}</b></span><span>毒液点 <b>{player.venomPoints}</b></span>
      </section>
      {target ? <section className="target-vitals" aria-label="目标状态"><strong>{target.name}</strong><Meter label="" value={target.health} max={target.maxHealth} tone="target" />{target.statuses.map((status) => <span aria-label={`目标状态 ${status.name}${status.stacks ? `，${status.stacks} 层` : ''}${status.remainingMs !== undefined ? `，剩余 ${formatSeconds(status.remainingMs)}` : ''}`} className="status-chip" key={status.id}>{status.name}{status.stacks ? ` ×${status.stacks}` : ''}{status.remainingMs !== undefined ? ` · ${formatSeconds(status.remainingMs)}` : ''}</span>)}</section> : null}
    </header>
  );
}

function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  return <div className="meter"><span>{label}</span><div className={`meter-track ${tone}`}><i style={{ width: `${Math.min(100, max ? (value / max) * 100 : 0)}%` }} /></div><b>{value}/{max}</b></div>;
}

function Loadout({ skills, canEdit, lockReason, embedded = false, onEquip }: { skills: Array<UiSkill | null>; canEdit: boolean; lockReason: string | null; embedded?: boolean; onEquip: GameUiActions['equipSkill'] }) {
  function dropSkill(event: DragEvent<HTMLButtonElement>, slot: 1 | 2 | 3 | 4) {
    event.preventDefault();
    const skillId = event.dataTransfer.getData('text/plain');
    if (skillId && canEdit) onEquip(skillId, slot);
  }
  return <nav className={`loadout ${embedded ? 'loadout-embedded' : ''}`} aria-label="出战技能栏" title={lockReason ?? undefined}>{skills.map((skill, index) => {
    const slot = (index + 1) as 1 | 2 | 3 | 4;
    return <button className="loadout-slot" data-testid={`loadout-slot-${slot}`} key={slot} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropSkill(event, slot)} type="button"><kbd>{slot}</kbd>{skill ? <span>{skill.icon}<small>{skill.name}</small></span> : <em>空槽</em>}</button>;
  })}</nav>;
}

function EscapePanel({ viewModel, activePanel, onPanelChange, onClose, actions }: { viewModel: GameViewModel; activePanel: PanelId; onPanelChange: (panel: PanelId) => void; onClose: () => void; actions: GameUiActions }) {
  return <section className="escape-backdrop"><section className="escape-panel" aria-label="荒野面板" role="dialog" aria-modal="true"><header><div><p className="eyebrow">蛇之蜕变</p><h2>{panelLabels[activePanel]}</h2></div><button aria-label="关闭面板" onClick={onClose} type="button">×</button></header><div className="panel-layout"><nav aria-label="面板导航" role="tablist">{viewModel.panels.map((panel) => <button aria-selected={activePanel === panel} key={panel} onClick={() => onPanelChange(panel)} role="tab" type="button">{panelLabels[panel]}</button>)}</nav><div className="panel-content">{activePanel === 'overview' ? <OverviewPanel viewModel={viewModel} /> : null}{activePanel === 'branches' ? <BranchesPanel viewModel={viewModel} onUnlock={actions.unlockBranch} /> : null}{activePanel === 'subtypes' ? <SubtypePanel viewModel={viewModel} actions={actions} /> : null}{activePanel === 'skills' ? <SkillLibrary skills={viewModel.skills} /> : null}{activePanel === 'loadout' ? <LoadoutPanel viewModel={viewModel} onEquip={actions.equipSkill} /> : null}{activePanel === 'status' ? <StatusPanel viewModel={viewModel} /> : null}{activePanel === 'upgrade' ? <UpgradePanel skills={viewModel.skills} onUpgrade={actions.upgradeSkill} /> : null}</div></div></section></section>;
}

function SkillLibrary({ skills }: { skills: UiSkill[] }) {
  return <section><h3>总技能库</h3><p>已开放技能可拖拽到出战槽；技能等级、冷却与充能均由当前局状态提供。</p><div className="skill-list">{skills.map((skill) => <SkillCard key={skill.id} skill={skill} />)}</div></section>;
}

function SkillCard({ skill }: { skill: UiSkill }) {
  const details = [skill.cooldownRemainingMs ? `冷却 ${formatSeconds(skill.cooldownRemainingMs)}` : null, skill.charges !== undefined && skill.maxCharges !== undefined ? `充能 ${skill.charges}/${skill.maxCharges}` : null].filter(Boolean);
  return <article className={`skill-card ${skill.unlocked ? '' : 'is-locked'}`} data-testid={`skill-${skill.id}`} draggable={skill.unlocked} onDragStart={(event) => event.dataTransfer.setData('text/plain', skill.id)}><span>{skill.icon}</span><div><strong>{skill.name}</strong><small>Lv.{skill.level}/{skill.maxLevel}{skill.openLevel ? ` · ${skill.openLevel}级开放` : ''} · {skill.unlocked ? skill.description : skill.lockedReason ?? '尚未开放'}</small>{details.length ? <em>{details.join(' · ')}</em> : null}</div></article>;
}

function OverviewPanel({ viewModel }: Pick<GameShellProps, 'viewModel'>) {
  const currentOrigin = viewModel.origins.find((origin) => origin.id === viewModel.selectedOriginId);
  return <section className="overview-panel"><h3>角色总览</h3><div className="overview-stats"><div><small>当前本源</small><strong>{currentOrigin?.name ?? '尚未选择'}</strong></div><div><small>角色等级</small><strong>Lv.{viewModel.player.level}</strong></div><div><small>金币</small><strong>{viewModel.player.gold}</strong></div><div><small>毒液点</small><strong>{viewModel.player.venomPoints}</strong></div></div><h4>已激活被动</h4><div className="passive-list">{viewModel.activePassives.length ? viewModel.activePassives.map((passive) => <article key={passive.id}><strong>{passive.name}</strong><span>{passive.description}</span></article>) : <p>尚未激活被动。</p>}</div></section>;
}

function BranchesPanel({ viewModel, onUnlock }: { viewModel: GameViewModel; onUnlock: GameUiActions['unlockBranch'] }) {
  const origins = viewModel.selectedOriginId ? viewModel.origins.filter((origin) => origin.id === viewModel.selectedOriginId) : viewModel.origins;
  return <section><h3>大分支解锁</h3><p>初始分支免费，其余同本源分支消耗金币解锁并永久生效。</p><div className="branch-catalog">{origins.map((origin) => <section key={origin.id}><h4>{origin.name}</h4>{origin.branches.map((branch) => <article className={`branch-entry ${branch.unlocked ? 'is-unlocked' : ''}`} key={branch.id}><div><strong>{branch.name}</strong><small>{branch.description}</small>{branch.passiveName ? <em>被动：{branch.passiveName}</em> : null}{!branch.unlocked && branch.lockedReason ? <span className="locked-reason">{branch.lockedReason}</span> : null}</div>{branch.unlocked ? <b>已解锁</b> : <button disabled={branch.unlockPrice === undefined} onClick={() => onUnlock(branch.id)} type="button">解锁 {branch.name}（{branch.unlockPrice ?? '?'} 金币）</button>}</article>)}</section>)}</div></section>;
}

function SubtypePanel({ viewModel, actions }: { viewModel: GameViewModel; actions: GameUiActions }) {
  return <section className="subtype-panel"><h3>毒素亚型</h3>{viewModel.inCombat ? <p className="combat-lock">战斗中不能切换亚型</p> : <p>脱离战斗后可激活已解锁亚型；毒液强化不可撤回。</p>}<div aria-label="毒素亚型列表" className="subtype-list" role="region" tabIndex={0}>{viewModel.subtypes.map((subtype) => <article className="subtype-card" key={subtype.id}><div><strong>{subtype.name}{subtype.active ? ' · 当前激活' : ''}</strong><small>{subtype.branchName} · {subtype.description}</small>{!subtype.unlocked && subtype.lockedReason ? <span className="locked-reason">{subtype.lockedReason}</span> : null}{subtype.enhanced ? <em>已获得毒液强化 +15%</em> : null}</div><aside>{subtype.unlocked ? <><button disabled={viewModel.inCombat} onClick={() => actions.selectSubtype(subtype.id)} type="button">激活 {subtype.name}</button>{subtype.canEnhance ? <button className="secondary-action" onClick={() => actions.assignVenomPoint(subtype.id)} type="button">投入毒液点到 {subtype.name}</button> : null}</> : <button disabled={subtype.unlockPrice === undefined} onClick={() => actions.unlockSubtype(subtype.id)} type="button">解锁 {subtype.name}（{subtype.unlockPrice ?? '?'} 金币）</button>}</aside></article>)}</div></section>;
}

function LoadoutPanel({ viewModel, onEquip }: { onEquip: GameUiActions['equipSkill'] } & Pick<GameShellProps, 'viewModel'>) {
  return <section><h3>出战配置</h3><p>{viewModel.canEditLoadout ? '拖拽已开放技能到 1—4 槽；同一技能不能重复装备。' : viewModel.loadoutLockReason ?? '当前不能修改出战配置。'}</p><Loadout canEdit={viewModel.canEditLoadout} embedded lockReason={viewModel.loadoutLockReason} skills={viewModel.loadout} onEquip={onEquip} /><div className="loadout-library">{viewModel.skills.filter((skill) => skill.unlocked).map((skill) => <SkillCard key={skill.id} skill={skill} />)}</div></section>;
}

function StatusPanel({ viewModel }: Pick<GameShellProps, 'viewModel'>) {
  return <section><h3>状态面板</h3><div className="status-columns"><StatusList empty="自身暂无状态。" statuses={viewModel.playerStatuses} title="自身 Buff" />{viewModel.target ? <StatusList empty="目标暂无状态。" statuses={viewModel.target.statuses} title={`${viewModel.target.name} Debuff`} /> : <StatusList empty="当前未锁定目标。" statuses={[]} title="目标 Debuff" />}</div></section>;
}

function StatusList({ title, statuses, empty }: { title: string; statuses: GameViewModel['playerStatuses']; empty: string }) {
  return <section className="status-list"><h4>{title}</h4>{statuses.length ? statuses.map((status) => <article key={status.id}><strong>{status.name}{status.stacks ? ` ×${status.stacks}` : ''}</strong><span>{status.source ? `${status.source} · ` : ''}{status.description ?? '状态效果生效中。'}</span>{status.remainingMs !== undefined ? <em>剩余 {formatSeconds(status.remainingMs)}</em> : null}</article>) : <p>{empty}</p>}</section>;
}

function UpgradePanel({ skills, onUpgrade }: { skills: UiSkill[]; onUpgrade: GameUiActions['upgradeSkill'] }) {
  return <section><h3>技能升级</h3><p>消耗技能经验提高成长字段；冷却、范围与硬控时长不会随技能等级改变。</p><div className="upgrade-list">{skills.map((skill) => <article key={skill.id}><div><strong>{skill.name}</strong><small>Lv.{skill.level}/{skill.maxLevel} · {skill.unlocked ? skill.description : skill.lockedReason ?? '尚未开放'}</small>{skill.cooldownRemainingMs ? <em>冷却 {formatSeconds(skill.cooldownRemainingMs)}</em> : null}{skill.charges !== undefined && skill.maxCharges !== undefined ? <em>充能 {skill.charges}/{skill.maxCharges}</em> : null}</div><button disabled={!skill.canUpgrade} onClick={() => onUpgrade(skill.id)} type="button">升级 {skill.name}（{skill.upgradeCost ?? '?'} 技能经验）</button></article>)}</div></section>;
}

function formatSeconds(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function DeathScreen() {
  return <main className="death-screen" data-testid="death-screen"><section><p className="eyebrow">荒野吞没了你</p><h1>蛇躯已殒</h1><p>本局经验、金币、分支与装备将在重生后归于虚无。</p><kbd>R</kbd><span>按 R 重生</span></section></main>;
}
