import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameE2eSnapshot } from '../../src/app/e2e-test-port';

test.describe('Phase 4 final deep browser mechanics', () => {
  test('跨亚型切换保留已施加的旧 Debuff', async ({ page }) => {
    await createVenomRun(page, '出血毒素');
    await openSubtypePanel(page);
    await unlockAndActivate(page, 'B亚型');
    await openSkillLibrary(page);
    await equip(page, 'venom-hemorrhage-b-1', '腐血突咬', 1);
    await equip(page, 'venom-hemorrhage-b-3', '血肉消融', 2);
    await closePanelAndFocus(page);
    await approachElite(page);
    await cast(page, '1', 'venom-hemorrhage-b-1');
    await cast(page, '2', 'venom-hemorrhage-b-3');
    await expectEnemyStatus(page, 'ancient-monitor', 'bleed');
    await advanceTime(page, 5_100);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '荒野面板' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    const subtypeTab = page.getByRole('tab', { name: '毒素亚型' });
    await mouseClick(page, subtypeTab);
    await expect(subtypeTab).toHaveAttribute('aria-selected', 'true');
    const activateDefault = page.getByRole('button', { name: '激活 A亚型' });
    await activateDefault.scrollIntoViewIfNeeded();
    await mouseClick(page, activateDefault);
    await expect.poll(async () => (await snapshot(page)).activeSubtypeId).toBe('venom-hemorrhage-a');
    await expectEnemyStatus(page, 'ancient-monitor', 'bleed');
  });

  test('毒液点强化把六层麻痹按 +15% 提升到七层', async ({ page }) => {
    await createVenomRun(page, '神经毒素');
    await openSubtypePanel(page);
    await page.getByRole('button', { name: '投入毒液点到 α-神经毒素' }).click();
    await expect(page.getByText('已获得毒液强化 +15%', { exact: true })).toBeVisible();
    await openSkillLibrary(page);
    await equip(page, 'venom-neuro-needle', '麻痹毒刺', 1);
    await closePanelAndFocus(page);
    await approachElite(page);
    await advanceTime(page, 10_000);
    await cast(page, '1', 'venom-neuro-needle');
    await expect.poll(async () => status(page, 'ancient-monitor', 'paralysis').then((value) => value?.stacks)).toBe(7);
  });

  test('出血腐蚀 DOT 周期扣血并在 ESC 暂停时冻结', async ({ page }) => {
    await createVenomRun(page, '出血毒素');
    await openSubtypePanel(page);
    await unlockAndActivate(page, 'B亚型');
    await openSkillLibrary(page);
    await equip(page, 'venom-hemorrhage-b-1', '腐血突咬', 1);
    await closePanelAndFocus(page);
    await approachElite(page);
    await cast(page, '1', 'venom-hemorrhage-b-1');
    const beforePause = (await snapshot(page)).runtime.currentTargetHealth!;

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '荒野面板' })).toBeVisible();
    await page.waitForTimeout(1_200);
    expect((await snapshot(page)).runtime.currentTargetHealth).toBe(beforePause);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_200);
    expect((await snapshot(page)).runtime.currentTargetHealth).toBeLessThan(beforePause);
  });

  test('坏死残留在溃烂到期后继续周期扣血', async ({ page }) => {
    await createVenomRun(page, '细胞坏死毒素');
    await openSubtypePanel(page);
    await unlockAndActivate(page, 'γ细胞崩解');
    await openSkillLibrary(page);
    await equip(page, 'venom-necrosis-gamma-1', '崩碎毒刺', 1);
    await closePanelAndFocus(page);
    await approachElite(page);
    await cast(page, '1', 'venom-necrosis-gamma-1');
    const beforeResidual = (await snapshot(page)).runtime.currentTargetHealth!;
    await advanceTime(page, 6_100);
    await page.waitForTimeout(2_100);
    const afterResidual = await snapshot(page);
    expect(afterResidual.runtime.currentTargetId).toBe('ancient-monitor');
    expect(afterResidual.runtime.currentTargetHealth).toBeLessThan(beforeResidual);
  });

  test('弥散毒核 hazard 周期施加并由引爆技能清场', async ({ page }) => {
    await createVenomRun(page, '凝血毒素');
    await openSubtypePanel(page);
    await unlockAndActivate(page, '弥散促凝');
    await openSkillLibrary(page);
    await equip(page, 'venom-coagulation-diffuse-1', '布放毒核', 1);
    await equip(page, 'venom-coagulation-diffuse-4', '毒核连锁引爆', 2);
    await closePanelAndFocus(page);
    await approachElite(page);
    await cast(page, '1', 'venom-coagulation-diffuse-1');
    await page.keyboard.down('s');
    try {
      await page.waitForTimeout(1_200);
    } finally {
      await page.keyboard.up('s');
    }
    await expectEnemyStatus(page, 'ancient-monitor', 'thrombosis');
    await cast(page, '2', 'venom-coagulation-diffuse-4');
    await expectEnemyStatus(page, 'ancient-monitor', 'thrombosis');
    await advanceTime(page, 6_100);
    await expect.poll(async () => Boolean(await status(page, 'ancient-monitor', 'thrombosis'))).toBe(false);
    await page.waitForTimeout(1_200);
    expect(await status(page, 'ancient-monitor', 'thrombosis')).toBeUndefined();
  });

  test('促凝小分子把血栓扩散到邻近目标', async ({ page }) => {
    await createVenomRun(page, '凝血毒素');
    await openSubtypePanel(page);
    await unlockAndActivate(page, '促凝小分子');
    await openSkillLibrary(page);
    await equip(page, 'venom-coagulation-small-1', '扩散毒刺', 1);
    await closePanelAndFocus(page);
    await approachElite(page);
    const sourceId = await convergeEnemies(page);
    await cast(page, '1', 'venom-coagulation-small-1');
    await expectEnemyStatus(page, sourceId, 'thrombosis');
    await expect.poll(async () => Object.entries((await snapshot(page)).enemyStatuses)
      .filter(([enemyId]) => enemyId !== sourceId)
      .filter(([, statuses]) => statuses.some((entry) => entry.statusId === 'thrombosis')).length).toBeGreaterThanOrEqual(1);
  });

  test('肾毒反噬在敌方动作时真实反伤', async ({ page }) => {
    await createVenomRun(page, '肾脏毒素');
    await openSubtypePanel(page);
    await openSkillLibrary(page);
    await equip(page, 'venom-kidney-s-1', '肾蚀毒牙', 1);
    await closePanelAndFocus(page);
    await approachElite(page);
    await cast(page, '1', 'venom-kidney-s-1');
    await expectEnemyStatus(page, 'ancient-monitor', 'kidney-reprisal');
    const beforeEnemyAction = (await snapshot(page)).runtime.currentTargetHealth!;
    await page.waitForTimeout(2_500);
    const afterEnemyAction = await snapshot(page);
    if (afterEnemyAction.runtime.currentTargetHealth === undefined) expect(afterEnemyAction.runtime.aliveEnemyIds).not.toContain('ancient-monitor');
    else expect(afterEnemyAction.runtime.currentTargetHealth).toBeLessThan(beforeEnemyAction);
  });
});

async function createVenomRun(page: Page, branchName: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?testPort=1');
  await page.getByRole('button', { name: '选择 毒素' }).click();
  await page.getByRole('button', { name: new RegExp(`选择 ${branchName}`) }).click();
  await page.getByRole('button', { name: '化蛇入荒野' }).click();
  await expect(page.getByTestId('game-hud')).toBeVisible();
  await expect.poll(() => hasTestPort(page)).toBe(true);
  await grantReward(page, 3_700, 600);
}

async function openSubtypePanel(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '毒素亚型' }).click();
}

async function unlockAndActivate(page: Page, subtypeName: string) {
  await page.getByRole('button', { name: `解锁 ${subtypeName}（1 金币）` }).click();
  await page.getByRole('button', { name: `激活 ${subtypeName}` }).click();
}

async function openSkillLibrary(page: Page) {
  await page.getByRole('tab', { name: '总技能库' }).click();
}

async function equip(page: Page, skillId: string, skillName: string, slot: 1 | 2) {
  await page.getByTestId(`skill-${skillId}`).dragTo(page.getByTestId(`loadout-slot-${slot}`));
  await expect(page.getByTestId(`loadout-slot-${slot}`)).toContainText(skillName);
}

async function closePanelAndFocus(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '荒野面板' })).toBeHidden();
  const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('game canvas is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function approachElite(page: Page) {
  const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
  const start = await snapshot(page);
  let priorHealth = start.runtime.currentTargetId === 'ancient-monitor' ? start.runtime.currentTargetHealth : undefined;
  let forward = true;
  for (let step = 0; step < 80; step += 1) {
    await primaryAttack(canvas);
    const current = await snapshot(page);
    if (current.runtime.currentTargetId === 'ancient-monitor' && current.runtime.currentTargetHealth !== undefined
      && (priorHealth === undefined || current.runtime.currentTargetHealth < priorHealth)
      && Math.abs(current.runtime.playerPosition.z - start.runtime.playerPosition.z) >= 0.5) return;
    if (current.runtime.currentTargetId === 'ancient-monitor') priorHealth = current.runtime.currentTargetHealth;
    if (current.runtime.playerPosition.z >= 16) forward = false;
    if (current.runtime.playerPosition.z <= -12) forward = true;
    await page.keyboard.press(forward ? 'w' : 's', { delay: 100 });
  }
  throw new Error(`real input did not hit ancient-monitor: ${JSON.stringify(await snapshot(page))}`);
}

async function convergeEnemies(page: Page) {
  let movingLeft = true;
  for (let step = 0; step < 50; step += 1) {
    const current = await snapshot(page);
    const positions = current.runtime.enemyPositions;
    const sourceId = current.runtime.currentTargetId;
    const source = sourceId ? positions[sourceId] : undefined;
    if (sourceId && source && Object.entries(positions).some(([enemyId, position]) => enemyId !== sourceId && Math.hypot(position.x - source.x, position.z - source.z) <= 6)) return sourceId;
    const x = current.runtime.playerPosition.x;
    if (x <= -6) movingLeft = false;
    if (x >= 6) movingLeft = true;
    await page.keyboard.press(movingLeft ? 'a' : 'd', { delay: 100 });
  }
  throw new Error(`enemies did not converge within spread radius: ${JSON.stringify(await snapshot(page))}`);
}

async function cast(page: Page, key: '1' | '2', skillId: string) {
  const before = (await snapshot(page)).skillRuntime[skillId];
  await page.keyboard.press(key);
  await expect.poll(async () => JSON.stringify((await snapshot(page)).skillRuntime[skillId])).not.toBe(JSON.stringify(before));
}

async function expectEnemyStatus(page: Page, enemyId: string, statusId: string) {
  await expect.poll(async () => Boolean(await status(page, enemyId, statusId))).toBe(true);
}

async function status(page: Page, enemyId: string, statusId: string) {
  return (await snapshot(page)).enemyStatuses[enemyId]?.find((entry) => entry.statusId === statusId);
}

async function primaryAttack(canvas: Locator) {
  await canvas.dispatchEvent('pointerdown', { button: 0 });
}

async function mouseClick(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error('mouse target is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
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
