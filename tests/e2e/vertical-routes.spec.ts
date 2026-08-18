import { expect, test, type Page } from '@playwright/test';
import type { GameE2eSnapshot } from '../../src/app/e2e-test-port';

interface RouteCase {
  title: string;
  originName: string;
  branchName: string;
  skillId: string;
  skillName: string;
  finisherId?: string;
  finisherName?: string;
}

const routes: RouteCase[] = [
  { title: 'TC-E2E-001 体型路线', originName: '体型', branchName: '厚甲生存', skillId: 'size-colossus-shock', skillName: '巨躯震荡' },
  { title: 'TC-E2E-002 力量路线', originName: '力量', branchName: '猛力搏杀', skillId: 'strength-pounce-bite', skillName: '猛扑撕咬' },
  { title: 'TC-E2E-003 毒素路线', originName: '毒素', branchName: '神经毒素', skillId: 'venom-neuro-needle', skillName: '麻痹毒刺', finisherId: 'venom-neuro-alpha-4', finisherName: '麻痹爆发' },
];

test.describe('Phase 1 representative routes through real commands and runtime events', () => {
  for (const route of routes) {
    test(`${route.title}: 创建→升级→装备→施放→击败精英`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/?testPort=1');
      await expect(page.getByTestId('character-creation')).toBeVisible();

      await page.getByRole('button', { name: `选择 ${route.originName}` }).click();
      await page.getByRole('button', { name: new RegExp(`选择 ${route.branchName}`) }).click();
      await page.getByRole('button', { name: '化蛇入荒野' }).click();
      await expect(page.getByTestId('game-hud')).toBeVisible();
      await expect.poll(() => hasTestPort(page), { message: 'development test port is installed after the real runtime mounts' }).toBe(true);

      await grantReward(page, 3700, 600);
      await expect.poll(async () => (await snapshot(page)).characterLevel).toBeGreaterThanOrEqual(9);

      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: '总技能库' }).click();
      await page.getByTestId(`skill-${route.skillId}`).dragTo(page.getByTestId('loadout-slot-1'));
      await expect(page.getByTestId('loadout-slot-1')).toContainText(route.skillName);
      if (route.finisherId && route.finisherName) {
        await page.getByTestId(`skill-${route.finisherId}`).dragTo(page.getByTestId('loadout-slot-2'));
        await expect(page.getByTestId('loadout-slot-2')).toContainText(route.finisherName);
      }
      await page.keyboard.press('Escape');

      await page.keyboard.down('w');
      await page.waitForTimeout(1_700);
      await page.keyboard.up('w');
      await page.locator('canvas[aria-label="蛇之荒野三维场景"]').click({ position: { x: 640, y: 360 } });
      await expect.poll(async () => (await snapshot(page)).runtime.currentTargetId).toBe('ancient-monitor');
      const beforeCast = await snapshot(page);
      await page.keyboard.press('1');
      await expect.poll(async () => JSON.stringify((await snapshot(page)).skillRuntime[route.skillId])).not.toBe(JSON.stringify(beforeCast.skillRuntime[route.skillId]));

      for (let cycle = 0; cycle < 12; cycle += 1) {
        await advanceTime(page, 60_000);
        await page.keyboard.press('1');
        if (route.finisherId) {
          await advanceTime(page, 60_000);
          await page.keyboard.press('1');
          await page.keyboard.press('2');
        }
        if ((await snapshot(page)).objectiveCompleted) break;
      }

      await expect.poll(async () => (await snapshot(page)).objectiveCompleted, { message: 'elite objective is completed only after runtime damage emits the elite event' }).toBe(true);
      await expect.poll(async () => (await snapshot(page)).runtime.aliveEnemyIds).not.toContain('ancient-monitor');
      await expect(page.getByRole('status')).toContainText('本轮目标完成');
    });
  }
});

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
