import { expect, test } from '@playwright/test';

test.describe('Phase 1 game UI', () => {
  test('TC-CHAR-001/TC-UI-003: creates a run at 1280x720 without clipped HUD', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.getByTestId('character-creation')).toBeVisible();
    await page.getByRole('button', { name: '选择 体型' }).click();
    await page.getByRole('button', { name: /选择 厚甲生存/ }).click();
    await page.getByRole('button', { name: /化蛇入荒野/ }).click();
    await expect(page.getByTestId('game-hud')).toBeVisible();
    await expect(page.getByTestId('loadout-slot-1')).toBeVisible();
  });

  test('TC-UI-002/TC-LOADOUT-001: opens ESC panels and equips a skill', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?e2e=game');
    await expect(page.getByTestId('game-hud')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '荒野面板' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(7);
    await page.getByRole('tab', { name: '总技能库' }).click();
    await page.getByTestId('skill-size-gale-glide').dragTo(page.getByTestId('loadout-slot-1'));
    await expect(page.getByTestId('loadout-slot-1')).toContainText('疾风滑行');
  });

  test('TC-UI-002: opens every ESC panel and shows its key content', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?e2e=game');
    await expect(page.getByTestId('game-hud')).toBeVisible();
    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog', { name: '荒野面板' });
    await expect(dialog).toBeVisible();

    const panels = [
      ['角色总览', '已激活被动'],
      ['大分支解锁', '初始分支免费'],
      ['毒素亚型', '脱离战斗后可激活已解锁亚型'],
      ['总技能库', '已开放技能可拖拽到出战槽'],
      ['出战配置', '拖拽已开放技能到 1—4 槽'],
      ['状态面板', '当前未锁定目标'],
      ['技能升级', '消耗技能经验提高成长字段'],
    ] as const;

    for (const [tabName, keyContent] of panels) {
      await dialog.getByRole('tab', { name: tabName }).click();
      await expect(dialog.getByRole('heading', { name: tabName, exact: true }).first()).toBeVisible();
      await expect(dialog.getByText(keyContent, { exact: false })).toBeVisible();
    }
  });

  test('TC-UI-004: subtype actions stay visible and mouse-clickable after scrolling at 1280x720', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?testPort=1');
    await page.getByRole('button', { name: '选择 毒素' }).click();
    await page.getByRole('button', { name: /选择 出血毒素/ }).click();
    await page.getByRole('button', { name: '化蛇入荒野' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(window.__SNAKE_E2E__))).toBe(true);
    await page.evaluate(() => window.__SNAKE_E2E__?.grantReward(3_700, 600));

    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: '毒素亚型' }).click();
    const scrollRegion = page.getByRole('region', { name: '毒素亚型列表' });
    const unlock = page.getByRole('button', { name: '解锁 B亚型（1 金币）' });
    await unlock.scrollIntoViewIfNeeded();
    await expectInside(scrollRegion, unlock);
    await unlock.click();
    await expect(page.getByRole('button', { name: '激活 B亚型' })).toBeVisible();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: '毒素亚型' }).click();
    const activate = page.getByRole('button', { name: '激活 A亚型' });
    await activate.scrollIntoViewIfNeeded();
    await expectInside(scrollRegion, activate);
    await activate.click();
    await expect.poll(() => page.evaluate(() => window.__SNAKE_E2E__?.snapshot().activeSubtypeId)).toBe('venom-hemorrhage-a');
    await page.screenshot({ path: 'tmp/subtype-panel-1280x720.png' });
  });

  test('TC-DEATH-001: real enemy attacks kill the player and R resets the run', async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?testPort=1');
    await createHemorrhageRun(page);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('reborn-snake-run-v1'))).not.toBeNull();

    const canvas = page.locator('canvas[aria-label="蛇之荒野三维场景"]');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('game canvas is not visible');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('w', { delay: 1_800 });
    await expect(page.getByTestId('death-screen')).toBeVisible({ timeout: 30_000 });

    await page.keyboard.press('r');
    await expect(page.getByTestId('character-creation')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('reborn-snake-run-v1'))).toBeNull();

    await createHemorrhageRun(page);
    await expect(page.getByLabel('角色状态')).toContainText('Lv.1');
    await expect(page.getByLabel('角色状态')).toContainText('100/100');
    await expect(page.getByLabel('局内资源')).toContainText('技能经验 0');
    await expect(page.getByLabel('局内资源')).toContainText('金币 1');
    await expect(page.getByLabel('局内资源')).toContainText('毒液点 1');
  });

});

async function createHemorrhageRun(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '选择 毒素' }).click();
  await page.getByRole('button', { name: /选择 出血毒素/ }).click();
  await page.getByRole('button', { name: '化蛇入荒野' }).click();
  await expect(page.getByTestId('game-hud')).toBeVisible();
}

async function expectInside(container: import('@playwright/test').Locator, item: import('@playwright/test').Locator) {
  await expect.poll(async () => {
    const [containerBox, itemBox] = await Promise.all([container.boundingBox(), item.boundingBox()]);
    if (!containerBox || !itemBox) return false;
    return itemBox.y >= containerBox.y && itemBox.y + itemBox.height <= containerBox.y + containerBox.height;
  }).toBe(true);
}
