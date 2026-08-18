import { expect, test, type Page } from '@playwright/test';
import type { GameE2eSnapshot } from '../../src/app/e2e-test-port';

const routes = [
  { title: '出血毒素 A', branchName: '出血毒素', subtypeName: 'A亚型', skillId: 'venom-hemorrhage-a-1', skillName: '裂牙撕咬', statusId: 'bleed' },
  { title: '凝血毒素 Oscutarin-C', branchName: '凝血毒素', subtypeName: 'Oscutarin-C', skillId: 'venom-coagulation-oscutarin-c-1', skillName: '促凝毒牙', statusId: 'thrombosis' },
  { title: '细胞坏死 β', branchName: '细胞坏死毒素', subtypeName: 'β细胞坏死', skillId: 'venom-necrosis-beta-1', skillName: '腐坏死咬', statusId: 'ulceration' },
  { title: '迷幻毒素 I', branchName: '迷幻毒素', subtypeName: 'Ⅰ迷幻突触', skillId: 'venom-hallucinogen-i-1', skillName: '幻惑毒咬', statusId: 'confusion' },
  { title: '肌肉毒素 α', branchName: '肌肉毒素', subtypeName: 'α肌溶毒素', skillId: 'venom-muscle-alpha-1', skillName: '肌蚀毒牙', statusId: 'muscle-stiffness' },
  { title: '肾脏毒素 S', branchName: '肾脏毒素', subtypeName: 'S溶血肾毒', skillId: 'venom-kidney-s-1', skillName: '肾蚀毒牙', statusId: 'kidney-reprisal' },
  { title: '心脏毒素 γ', branchName: '心脏毒素', subtypeName: 'γ心毒', skillId: 'venom-heart-gamma-1', skillName: '心蚀毒牙', statusId: 'heart-erosion' },
] as const;

test.describe('Phase 3 remaining default venom subtype routes', () => {
  for (const route of routes) {
    test(`${route.title}: UI选择→状态施加→真实击败精英`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/?testPort=1');
      await expect(page.getByTestId('character-creation')).toBeVisible();
      await page.getByRole('button', { name: '选择 毒素' }).click();
      await page.getByRole('button', { name: new RegExp(`选择 ${route.branchName}`) }).click();
      await page.getByRole('button', { name: '化蛇入荒野' }).click();
      await expect(page.getByTestId('game-hud')).toBeVisible();
      await expect.poll(() => hasTestPort(page)).toBe(true);
      await grantReward(page, 3_700, 600);

      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: '毒素亚型' }).click();
      await page.getByRole('button', { name: `激活 ${route.subtypeName}` }).click();
      await expect.poll(async () => (await snapshot(page)).activeSubtypeId).toBe(route.skillId.replace(/-\d+$/, ''));
      await page.getByRole('tab', { name: '总技能库' }).click();
      await page.getByTestId(`skill-${route.skillId}`).dragTo(page.getByTestId('loadout-slot-1'));
      await expect(page.getByTestId('loadout-slot-1')).toContainText(route.skillName);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: '荒野面板' })).toBeHidden();
      await focusGameCanvas(page);

      await approachEliteWithRealInput(page);
      const before = await snapshot(page);
      await page.keyboard.press('1');
      await expect.poll(async () => JSON.stringify((await snapshot(page)).skillRuntime[route.skillId])).not.toBe(JSON.stringify(before.skillRuntime[route.skillId]));
      await expect.poll(async () => (await snapshot(page)).runtime.targetStatuses.some((status) => status.statusId === route.statusId && status.stacks >= 1)).toBe(true);

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

async function approachEliteWithRealInput(page: Page) {
  const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
  await page.keyboard.down('w');
  try {
    await expect.poll(async () => (await snapshot(page)).runtime.playerPosition.z).toBeGreaterThanOrEqual(9);
  } finally {
    await page.keyboard.up('w');
  }
  let movingForward = true;
  for (let step = 0; step < 40; step += 1) {
    if ((await snapshot(page)).runtime.currentTargetId === 'ancient-monitor') return;
    await primaryAttack(canvas);
    if ((await snapshot(page)).runtime.currentTargetId === 'ancient-monitor') return;
    const { z } = (await snapshot(page)).runtime.playerPosition;
    if (z >= 14) movingForward = false;
    if (z <= 8) movingForward = true;
    await page.keyboard.press(movingForward ? 'w' : 's', { delay: 100 });
  }
  throw new Error(`real movement and basic attacks did not acquire ancient-monitor: ${JSON.stringify(await snapshot(page))}`);
}

async function focusGameCanvas(page: Page) {
  const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('game canvas is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function primaryAttack(canvas: ReturnType<Page['locator']>) {
  await canvas.dispatchEvent('pointerdown', { button: 0 });
}

async function hasTestPort(page: Page) {
  return page.evaluate(() => Boolean(window.__SNAKE_E2E__));
}

async function grantReward(page: Page, characterXp: number, skillXp: number) {
  await page.evaluate(({ characterXp: xp, skillXp: sxp }) => window.__SNAKE_E2E__?.grantReward(xp, sxp), { characterXp, skillXp });
}

async function snapshot(page: Page): Promise<GameE2eSnapshot> {
  return page.evaluate(() => {
    if (!window.__SNAKE_E2E__) throw new Error('E2E test port is not installed');
    return window.__SNAKE_E2E__.snapshot();
  });
}
