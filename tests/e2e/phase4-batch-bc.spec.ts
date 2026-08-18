import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameE2eSnapshot } from '../../src/app/e2e-test-port';

interface Probe {
  skillId: string;
  skillName: string;
  retainedStatuses?: string[];
  removedStatuses?: string[];
  extension?: { statusId: string; durationMs: number };
}

interface Route {
  title: string;
  branchName: string;
  subtypeName: string;
  skillId: string;
  skillName: string;
  statuses: string[];
  stacks?: Record<string, number>;
  delayedTransition?: { markerStatus: string; resultStatus: string; delayMs: number };
  probe?: Probe;
}

const routes: Route[] = [
  { title: 'B 迟效凝固', branchName: '凝血毒素', subtypeName: '迟效凝固', skillId: 'venom-coagulation-delayed-1', skillName: '迟毒植入', statuses: ['toxin-seed'], delayedTransition: { markerStatus: 'toxin-seed', resultStatus: 'thrombosis', delayMs: 3_000 } },
  { title: 'B α细胞溶解', branchName: '细胞坏死毒素', subtypeName: 'α细胞溶解', skillId: 'venom-necrosis-alpha-1', skillName: '溶蚀毒牙', statuses: ['ulceration'], probe: { skillId: 'venom-necrosis-alpha-4', skillName: '溶爆毁灭', removedStatuses: ['ulceration'] } },
  { title: 'B γ细胞崩解', branchName: '细胞坏死毒素', subtypeName: 'γ细胞崩解', skillId: 'venom-necrosis-gamma-1', skillName: '崩碎毒刺', statuses: ['ulceration'], probe: { skillId: 'venom-necrosis-gamma-3', skillName: '腐毒延续', extension: { statusId: 'ulceration', durationMs: 4_000 } } },
  { title: 'B ε组织坏死', branchName: '细胞坏死毒素', subtypeName: 'ε组织坏死', skillId: 'venom-necrosis-epsilon-1', skillName: '烙印毒咬', statuses: ['lesion-mark', 'ulceration'], probe: { skillId: 'venom-necrosis-epsilon-3', skillName: '病灶激化', retainedStatuses: ['lesion-mark', 'ulceration'] } },
  { title: 'B Ⅱ致幻麻痹', branchName: '迷幻毒素', subtypeName: 'Ⅱ致幻麻痹', skillId: 'venom-hallucinogen-ii-1', skillName: '幻麻突咬', statuses: ['confusion', 'paralysis'] },
  { title: 'B Ⅲ精神耗竭', branchName: '迷幻毒素', subtypeName: 'Ⅲ精神耗竭', skillId: 'venom-hallucinogen-iii-1', skillName: '耗神毒牙', statuses: ['confusion'] },
  { title: 'B Ⅳ错乱后遗', branchName: '迷幻毒素', subtypeName: 'Ⅳ错乱后遗', skillId: 'venom-hallucinogen-iv-1', skillName: '后遗毒刺', statuses: ['confusion'] },
  { title: 'B β肌坏死', branchName: '肌肉毒素', subtypeName: 'β肌坏死', skillId: 'venom-muscle-beta-1', skillName: '坏死毒咬', statuses: ['muscle-stiffness'], probe: { skillId: 'venom-muscle-beta-4', skillName: '肌碎爆裂', removedStatuses: ['muscle-stiffness'] } },
  { title: 'C γ衰弱瘫软', branchName: '肌肉毒素', subtypeName: 'γ衰弱瘫软', skillId: 'venom-muscle-gamma-1', skillName: '瘫软毒刺', statuses: ['weakness'], stacks: { weakness: 3 }, probe: { skillId: 'venom-muscle-gamma-4', skillName: '彻底瘫软', retainedStatuses: ['muscle-stiffness'], removedStatuses: ['weakness'] } },
  { title: 'C δ叠层增幅', branchName: '肌肉毒素', subtypeName: 'δ叠层增幅', skillId: 'venom-muscle-delta-1', skillName: '速蚀毒咬', statuses: ['muscle-stiffness', 'weakness'] },
  { title: 'C L溶血', branchName: '肾脏毒素', subtypeName: 'L溶血', skillId: 'venom-kidney-l-1', skillName: '溶肾毒咬', statuses: ['kidney-reprisal', 'bleed'], probe: { skillId: 'venom-kidney-l-4', skillName: '溶肾爆', removedStatuses: ['kidney-reprisal', 'bleed'] } },
  { title: 'C M持续耗损', branchName: '肾脏毒素', subtypeName: 'M持续耗损', skillId: 'venom-kidney-m-1', skillName: '久毒毒刺', statuses: ['kidney-reprisal'], probe: { skillId: 'venom-kidney-m-3', skillName: '毒素滞留', extension: { statusId: 'kidney-reprisal', durationMs: 3_000 } } },
  { title: 'C X爆发肾毒', branchName: '肾脏毒素', subtypeName: 'X爆发肾毒', skillId: 'venom-kidney-x-1', skillName: '蓄毒毒牙', statuses: ['kidney-reprisal'] },
  { title: 'C δ心肌消融', branchName: '心脏毒素', subtypeName: 'δ心肌消融', skillId: 'venom-heart-delta-1', skillName: '融心毒咬', statuses: ['heart-erosion', 'slow'], probe: { skillId: 'venom-heart-delta-4', skillName: '心肌崩解爆', retainedStatuses: ['slow'], removedStatuses: ['heart-erosion'] } },
  { title: 'C ε骤停高危', branchName: '心脏毒素', subtypeName: 'ε骤停高危', skillId: 'venom-heart-epsilon-1', skillName: '危心毒刺', statuses: ['heart-erosion'] },
  { title: 'C ζ持久心毒', branchName: '心脏毒素', subtypeName: 'ζ持久心毒', skillId: 'venom-heart-zeta-1', skillName: '残留毒咬', statuses: ['heart-erosion'], probe: { skillId: 'venom-heart-zeta-3', skillName: '毒素延留', extension: { statusId: 'heart-erosion', durationMs: 3_000 } } },
];

test.describe('Phase 4 batch B/C browser acceptance', () => {
  for (const route of routes) {
    test(`${route.title}: UI装备施放→状态契约→真实击败精英`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/?testPort=1');
      await page.getByRole('button', { name: '选择 毒素' }).click();
      await page.getByRole('button', { name: new RegExp(`选择 ${route.branchName}`) }).click();
      await page.getByRole('button', { name: '化蛇入荒野' }).click();
      await expect(page.getByTestId('game-hud')).toBeVisible();
      await expect.poll(() => hasTestPort(page)).toBe(true);
      await grantReward(page, 3_700, 600);

      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: '毒素亚型' }).click();
      await page.getByRole('button', { name: `解锁 ${route.subtypeName}（1 金币）` }).click();
      await page.getByRole('button', { name: `激活 ${route.subtypeName}` }).click();
      await expect.poll(async () => (await snapshot(page)).activeSubtypeId).toBe(route.skillId.replace(/-\d+$/, ''));
      await page.getByRole('tab', { name: '总技能库' }).click();
      await equip(page, route.skillId, route.skillName, 1);
      if (route.probe) await equip(page, route.probe.skillId, route.probe.skillName, 2);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: '荒野面板' })).toBeHidden();
      await focusGameCanvas(page);

      await approachEliteWithRealInput(page);
      if (route.delayedTransition) {
        const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
        for (let attack = 0; attack < 6; attack += 1) await primaryAttack(canvas);
        expect((await snapshot(page)).objectiveCompleted).toBe(false);
        await advanceTime(page, 10_000);
        expect(((await snapshot(page)).enemyStatuses['ancient-monitor'] ?? []).some((status) => [route.delayedTransition!.markerStatus, route.delayedTransition!.resultStatus].includes(status.statusId))).toBe(false);
      }
      await castAndExpectRuntimeChange(page, '1', route.skillId);
      await expectStatuses(page, route.statuses, route.stacks);
      if (route.delayedTransition) await expectDelayedTransition(page, route.delayedTransition);

      if (route.probe) await exerciseProbe(page, route.probe);

      const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
      for (let attack = 0; attack < 12; attack += 1) {
        await primaryAttack(canvas);
        if ((await snapshot(page)).objectiveCompleted) break;
      }
      await expect.poll(async () => (await snapshot(page)).objectiveCompleted).toBe(true);
      await expect.poll(async () => (await snapshot(page)).runtime.aliveEnemyIds).not.toContain('ancient-monitor');
      await expect(page.getByRole('status')).toContainText('本轮目标完成');
    });
  }
});

async function exerciseProbe(page: Page, probe: Probe) {
  const beforeStatuses = (await snapshot(page)).runtime.targetStatuses;
  await castAndExpectRuntimeChange(page, '2', probe.skillId);
  if (probe.retainedStatuses) await expectStatuses(page, probe.retainedStatuses);
  if (probe.removedStatuses) {
    for (const statusId of probe.removedStatuses) {
      await expect.poll(async () => (await snapshot(page)).runtime.targetStatuses.some((status) => status.statusId === statusId)).toBe(false);
    }
  }
  if (probe.extension) {
    const before = beforeStatuses.find((status) => status.statusId === probe.extension!.statusId)?.remainingMs ?? 0;
    await expect.poll(async () => (await snapshot(page)).runtime.targetStatuses.find((status) => status.statusId === probe.extension!.statusId)?.remainingMs ?? 0)
      .toBeGreaterThanOrEqual(before + probe.extension.durationMs - 500);
  }
}

async function equip(page: Page, skillId: string, skillName: string, slot: 1 | 2) {
  await page.getByTestId(`skill-${skillId}`).dragTo(page.getByTestId(`loadout-slot-${slot}`));
  await expect(page.getByTestId(`loadout-slot-${slot}`)).toContainText(skillName);
}

async function expectStatuses(page: Page, statusIds: string[], expectedStacks: Record<string, number> = {}) {
  for (const statusId of statusIds) {
    await expect.poll(async () => (await snapshot(page)).runtime.targetStatuses.some((status) => status.statusId === statusId && status.stacks >= (expectedStacks[statusId] ?? 1) && status.remainingMs > 0)).toBe(true);
  }
}

async function expectDelayedTransition(page: Page, transition: NonNullable<Route['delayedTransition']>) {
  expect(((await snapshot(page)).enemyStatuses['ancient-monitor'] ?? []).some((status) => status.statusId === transition.resultStatus)).toBe(false);
  await page.keyboard.down('s');
  try {
    await page.waitForTimeout(transition.delayMs + 250);
  } finally {
    await page.keyboard.up('s');
  }
  await expect.poll(async () => ((await snapshot(page)).enemyStatuses['ancient-monitor'] ?? []).some((status) => status.statusId === transition.markerStatus)).toBe(false);
  const afterDelay = await snapshot(page);
  expect((afterDelay.enemyStatuses['ancient-monitor'] ?? []).some((status) => status.statusId === transition.resultStatus && status.remainingMs > 0), JSON.stringify(afterDelay)).toBe(true);
  await approachEliteWithRealInput(page);
}

async function castAndExpectRuntimeChange(page: Page, key: '1' | '2', skillId: string) {
  const before = await snapshot(page);
  await page.keyboard.press(key);
  await expect.poll(async () => JSON.stringify((await snapshot(page)).skillRuntime[skillId])).not.toBe(JSON.stringify(before.skillRuntime[skillId]));
}

async function approachEliteWithRealInput(page: Page) {
  const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
  await ensureRuntimeAcceptsMovement(page);
  const start = await snapshot(page);
  let priorHealth = start.runtime.currentTargetId === 'ancient-monitor' ? start.runtime.currentTargetHealth : undefined;
  let movingForward = true;
  for (let step = 0; step < 80; step += 1) {
    await primaryAttack(canvas);
    const current = await snapshot(page);
    if (current.runtime.currentTargetId === 'ancient-monitor' && current.runtime.currentTargetHealth !== undefined
      && (priorHealth === undefined || current.runtime.currentTargetHealth < priorHealth)
      && Math.abs(current.runtime.playerPosition.z - start.runtime.playerPosition.z) >= 0.5) return;
    if (current.runtime.currentTargetId === 'ancient-monitor') priorHealth = current.runtime.currentTargetHealth;
    const { z } = current.runtime.playerPosition;
    if (z >= 16) movingForward = false;
    if (z <= -12) movingForward = true;
    await page.keyboard.press(movingForward ? 'w' : 's', { delay: 100 });
  }
  throw new Error(`real movement and basic attacks did not acquire ancient-monitor: ${JSON.stringify(await snapshot(page))}`);
}

async function ensureRuntimeAcceptsMovement(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = (await snapshot(page)).runtime.playerPosition.z;
    await focusGameCanvas(page);
    await page.keyboard.press('w', { delay: 150 });
    if ((await snapshot(page)).runtime.playerPosition.z > before) return;
  }
  throw new Error(`runtime did not accept focused movement input: ${JSON.stringify(await snapshot(page))}`);
}

async function focusGameCanvas(page: Page) {
  const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('game canvas is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function primaryAttack(canvas: Locator) {
  await canvas.dispatchEvent('pointerdown', { button: 0 });
}

async function hasTestPort(page: Page) {
  return page.evaluate(() => Boolean(window.__SNAKE_E2E__));
}

async function grantReward(page: Page, characterXp: number, skillXp: number) {
  await page.evaluate(({ characterXp: xp, skillXp: sxp }) => window.__SNAKE_E2E__?.grantReward(xp, sxp), { characterXp, skillXp });
}

async function advanceTime(page: Page, deltaMs: number) {
  await page.evaluate((milliseconds) => window.__SNAKE_E2E__?.advanceTime(milliseconds), deltaMs);
}

async function snapshot(page: Page): Promise<GameE2eSnapshot> {
  return page.evaluate(() => {
    if (!window.__SNAKE_E2E__) throw new Error('E2E test port is not installed');
    return window.__SNAKE_E2E__.snapshot();
  });
}
