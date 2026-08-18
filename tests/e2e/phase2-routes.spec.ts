import { expect, test, type Page } from '@playwright/test';
import type { GameE2eSnapshot } from '../../src/app/e2e-test-port';

interface PhaseTwoRoute {
  title: string;
  originName: string;
  branchName: string;
  skillId: string;
  skillName: string;
  setupSkillId?: string;
  setupSkillName?: string;
}

const routes: readonly PhaseTwoRoute[] = [
  { title: '再生', originName: '体型', branchName: '蜕皮再生', skillId: 'size-molt-shock', skillName: '蜕皮冲击' },
  { title: '潜行', originName: '体型', branchName: '狭域潜行', skillId: 'size-burrow-ambush', skillName: '地穴突袭' },
  { title: '反击', originName: '力量', branchName: '反击格斗', skillId: 'strength-chain-pounce', skillName: '连环扑击' },
  { title: '狂暴', originName: '力量', branchName: '狂暴狂怒', skillId: 'strength-blood-bite', skillName: '噬血撕咬' },
  { title: '绞杀', originName: '力量', branchName: '绞杀控制', setupSkillId: 'strength-multi-coil', setupSkillName: '多重缠绕', skillId: 'strength-choke', skillName: '绞杀锁喉' },
  { title: '猎杀', originName: '力量', branchName: '猎杀突袭', skillId: 'strength-rapid-bite', skillName: '速袭连咬' },
];

test.describe('Phase 2 representative routes', () => {
  for (const route of routes) {
    test(`${route.title}: 创建→升级→装备→施放→击败精英`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/?testPort=1');
      await expect(page.getByTestId('character-creation')).toBeVisible();
      await page.getByRole('button', { name: `选择 ${route.originName}` }).click();
      await page.getByRole('button', { name: new RegExp(`选择 ${route.branchName}`) }).click();
      await page.getByRole('button', { name: '化蛇入荒野' }).click();
      await expect(page.getByTestId('game-hud')).toBeVisible();
      await expect.poll(() => hasTestPort(page)).toBe(true);

      await grantReward(page, 3_700, 600);
      await expect.poll(async () => (await snapshot(page)).characterLevel).toBeGreaterThanOrEqual(9);
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: '总技能库' }).click();
      if (route.setupSkillId) {
        await page.getByTestId(`skill-${route.setupSkillId}`).dragTo(page.getByTestId('loadout-slot-1'));
        await expect(page.getByTestId('loadout-slot-1')).toContainText(route.setupSkillName!);
      }
      const damageSlot = route.setupSkillId ? 2 : 1;
      await page.getByTestId(`skill-${route.skillId}`).dragTo(page.getByTestId(`loadout-slot-${damageSlot}`));
      await expect(page.getByTestId(`loadout-slot-${damageSlot}`)).toContainText(route.skillName);
      await page.keyboard.press('Escape');

      await approachEliteWithRealInput(page);

      const beforeCast = await snapshot(page);
      if (route.setupSkillId) await page.keyboard.press('1');
      await page.keyboard.press(String(damageSlot));
      await expect.poll(async () => JSON.stringify((await snapshot(page)).skillRuntime[route.skillId])).not.toBe(JSON.stringify(beforeCast.skillRuntime[route.skillId]));
      for (let cast = 0; cast < 12; cast += 1) {
        await advanceTime(page, 60_000);
        if (route.setupSkillId) await page.keyboard.press('1');
        await page.keyboard.press(String(damageSlot));
        if ((await snapshot(page)).objectiveCompleted) break;
      }

      await expect.poll(async () => (await snapshot(page)).objectiveCompleted).toBe(true);
      await expect.poll(async () => (await snapshot(page)).runtime.aliveEnemyIds).not.toContain('ancient-monitor');
      await expect(page.getByRole('status')).toContainText('本轮目标完成');
    });
  }
});

async function hasTestPort(page: Page) {
  return page.evaluate(() => Boolean(window.__SNAKE_E2E__));
}

async function approachEliteWithRealInput(page: Page) {
  const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('game canvas is not visible');
  await page.keyboard.down('w');
  try {
    for (let step = 0; step < 24; step += 1) {
      await page.waitForTimeout(100);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      if ((await snapshot(page)).runtime.currentTargetId === 'ancient-monitor') return;
    }
  } finally {
    await page.keyboard.up('w');
  }
  throw new Error('real movement and basic attacks did not acquire ancient-monitor');
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
