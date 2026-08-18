# 《重生之我化为蛇》实施计划

## 1. 计划基线

- 产品基线：`docs/PRD.md` v0.2。
- 实施原则：先测试用例、后代码；每个 Phase 验收通过后才进入下一 Phase。
- 交付目标：桌面浏览器可玩的单机 3D 动作成长游戏，最终覆盖 3 本源、18 个大分支、32 个毒素亚型、168 个主动技能和 42 个被动。
- Git 约束：可以修改工作区，但任何 `commit`、`push`、`tag` 前必须完成 diff 审核并取得用户明确批准；禁止 `git add -A`。

## 2. 技术调研与选型

### 2.1 调研结论

| 方案 | 优点 | 局限 | 结论 |
|------|------|------|------|
| Babylon.js | TypeScript 友好，WebGL/WebGPU 3D 引擎，场景、镜头、输入、材质、碰撞工具集中 | 包体比纯 Three.js 大 | 选择，减少独立拼装 3D 基础设施 |
| Three.js | 生态大、渲染层灵活 | 游戏循环、碰撞和实体管理需自行组合更多库 | 不选，当前项目更重视快速形成稳定玩法闭环 |
| React | 适合复杂 HUD、面板、拖拽和状态可视化 | 不应承担逐帧世界更新 | 选择，仅负责 UI 层 |
| Zustand vanilla store | 轻量、类型安全、可供 Babylon 与 React 共同订阅 | 需明确高频与低频状态边界 | 选择，保存产品态和 UI 态；逐帧坐标留在场景内 |
| Zod | 配置 Schema 与运行时校验直观 | 增加小量运行时代码 | 选择，阻止 168 技能配置静默缺字段 |
| Vitest | 与 Vite/TypeScript 集成，适合规则单测 | 不能替代真实浏览器 E2E | 选择，用于领域规则、配置和组件测试 |
| Playwright | 真实浏览器流程与跨浏览器能力 | 3D 像素级断言易脆弱 | 选择，断言产品状态和关键 UI，不依赖逐像素截图 |

调研参考：Babylon.js 官方仓库、Zustand 官方 TypeScript 指南、Vitest 官方仓库与指南、Playwright 官方仓库。只复用架构思路和公开 API，不复制第三方游戏业务代码。

### 2.2 技术栈

- Node.js 24，pnpm 11。
- Vite + React + TypeScript，严格类型检查。
- `@babylonjs/core`：3D 世界、镜头、输入、材质与碰撞。
- `zustand/vanilla` + React binding：领域状态与 UI 同步。
- Zod：全局、技能、状态、敌人配置校验。
- Vitest + Testing Library：单元、组件和集成测试。
- Playwright：Chromium/Edge 关键路径 E2E。
- ESLint + Prettier：静态检查和格式化。

版本在初始化时使用当前兼容稳定版，并由 `pnpm-lock.yaml` 锁定；不在本文写死可能漂移的包版本。

## 3. 架构

### 3.1 分层

```text
React UI
  ↕ selectors/actions
Game Store（低频产品状态、存档快照）
  ↕ commands/events
Domain Core（纯 TypeScript 规则）
  ↕ ports
Babylon Runtime（逐帧移动、场景实体、碰撞、表现）
  ↕
External Config（全局、技能、状态、敌人、地图）
```

- `domain` 不依赖 React、DOM 或 Babylon，可用确定性时钟和随机源测试。
- `runtime` 把 Babylon 命中、位移和实体事件转换为领域命令，不保存经济真相。
- `ui` 只通过 store selector 读取，不直接修改场景对象。
- 高频位置、粒子和动画不写入 React store；HUD 只接收节流后的可见数据。
- 专属技能由可组合效果定义；只有无法表达的新机制才新增通用 effect handler。

### 3.2 目录

```text
src/
  app/                 应用入口、路由式界面状态
  config/              JSON/TS 数据、Schema、加载与校验
  domain/              角色、经济、技能、充能、伤害、状态、存档
  game/                Babylon 引擎、场景、实体、输入、AI、表现
  store/               vanilla store、selector、持久化适配器
  ui/                  HUD、角色创建、ESC 七面板、死亡界面
  test-support/        固定时钟、随机源、fixture、测试驱动接口
tests/
  unit/                纯规则与配置测试
  integration/         store/runtime 边界测试
  e2e/                 Playwright 关键流程
public/
  assets/              模型、贴图、音频或占位资源
```

### 3.3 核心接口

```ts
type GameCommand =
  | { type: 'CREATE_RUN'; originId: string; branchId: string }
  | { type: 'GAIN_REWARD'; characterXp: number; skillXp: number }
  | { type: 'UNLOCK_BRANCH'; branchId: string }
  | { type: 'UNLOCK_SUBTYPE'; subtypeId: string }
  | { type: 'ASSIGN_VENOM_POINT'; subtypeId: string }
  | { type: 'EQUIP_SKILL'; skillId: string; slot: 1 | 2 | 3 | 4 }
  | { type: 'CAST_SKILL'; slot: 1 | 2 | 3 | 4; targetIds: string[] }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'PLAYER_DIED' }
  | { type: 'RESET_RUN' };
```

```ts
interface EffectDefinition {
  type: string;
  target: 'self' | 'target' | 'area';
  magnitude?: number;
  durationMs?: number;
  stacks?: number;
  statusId?: string;
  tags?: string[];
}
```

实际类型以实现为准，但必须保持：领域命令可测试、配置引用有 Schema 校验、运行时不绕过领域规则。

## 4. 配置设计

### 4.1 配置文件

- `game.config.ts/json`：角色基础属性、脱战时间、伤害取整、控制衰减、保存版本。
- `progression.config.ts/json`：角色经验曲线、技能升级费用和奖励。
- `origins.config.ts/json`：本源、分支、亚型、被动和解锁价格。
- `skills.config.ts/json`：168 个技能及可组合效果。
- `statuses.config.ts/json`：所有 Buff/Debuff/控制/标记。
- `attacks.config.ts/json`：左右键基础攻击。
- `enemies.config.ts/json`：敌人属性、AI 参数、奖励和体型。
- `world.config.ts/json`：地图、刷新与精英条件。

每个配置参数必须有中文注释或相邻说明文档，写清含义、单位、范围和默认值。配置校验测试检查数量、唯一 ID、引用完整性、数值范围和 Phase 覆盖率。

### 4.2 首版待量化值

Phase 1 先提供可玩的临时平衡值：玩家/敌人基础属性、基础攻击、经验曲线、技能升级费、三种敌人和 12 个垂直切片技能。后续技能中原稿的模糊量词统一进入配置审查表，不能硬编码在 effect handler。

## 5. 测试策略

详细用例见 `docs/TEST_CASES.md`。

- 规则单测：创建、经济、升级、伤害、护盾、CD、充能、状态、控制衰减、亚型切换、重置。
- 配置契约测试：Schema、ID 唯一、引用完整、数量、开放等级、技能效果可执行。
- 组件测试：创建、HUD、面板、拖拽、错误提示、死亡界面。
- 集成测试：Babylon/runtime 事件到领域命令、暂停、输入锁、存档恢复。
- E2E：三本源垂直路线、升级、装备、战斗、击败精英、刷新恢复、死亡 R 清档。
- 性能：固定敌人/状态压测场景记录 FPS、P95 帧时间和内存趋势。

每次 Phase 的完成门禁：`lint`、`typecheck`、`test`、`build`、对应 E2E 全部通过，且前序 Phase 回归无失败。

## 6. 分布式实现策略

- 5.6 Sol：总体规划、架构和跨模块决策，审查每个 Phase 的范围与验收结果。
- 5.6 Terra 子 Agent：按互不重叠的文件边界分布实现。
  - 领域与配置：规则、Schema、平衡数据和单测。
  - 3D Runtime：场景、输入、实体、AI、碰撞和表现。
  - UI 与 E2E：React HUD/面板、拖拽、存档交互和浏览器测试。
- 主 Agent：协调接口、集成变更、解决冲突、执行全量验收和 diff 审核。
- 子 Agent 不得 commit、push、tag，不得修改不属于分工的文件；共享接口变更先报告主 Agent。

## 7. Phase 0：规格与工程基线

### 交付

- PRD、实施计划、测试用例、CHANGELOG、TodoList。
- 初始化 Git（若用户没有另外要求），创建 `.gitignore` 和根目录 `tmp/`。
- Vite/React/TypeScript 工程、代码质量、Vitest、Playwright、基础配置 Schema。
- 最小加载页和配置校验入口。

### 验收

- 文档与 PRD 一致，P0 决策明确。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过。
- 非法配置 fixture 会产生可定位错误。

## 8. Phase 1：三本源垂直切片

### 实现顺序

1. 先写领域失败测试：创建、经济、升级、伤害、充能、状态、存档和重置。
2. 实现纯 TypeScript 领域核心和 12 技能/3 被动配置。
3. 实现 3D 世界、移动、镜头、基础敌人、精英和战斗适配。
4. 实现创建界面、HUD、七面板的垂直切片功能、出战拖拽和死亡界面。
5. 执行三条 E2E 流程、30 分钟冒烟和性能基线。

### 验收

- 厚甲生存、猛力搏杀、α-神经毒素均可完成创建→9级→击败精英。
- 技能开放、升级、CD/充能、状态、护盾、控制衰减、存档和 R 重置行为符合 PRD。
- 1280×720 无阻塞性裁切；键鼠完整可用。

## 9. Phase 2：体型与力量完整化

### 实现

- 补齐 10 分支、40 技能、10 被动配置与通用效果处理器。
- 增加隐身、环境加速、诱饵、反击、背刺、缠绕、挣脱、拖拽。
- 完成分支解锁和多被动永久叠加 UI。

### 验收

- 每个技能至少覆盖正常、边界、状态交互三类测试。
- 任一体型/力量分支开局可完成本轮目标。
- 配置清单和效果注册无缺失，Phase 1 全量回归通过。

## 10. Phase 3：毒素默认亚型

### 实现

- 8 个默认亚型、32 技能、8 被动。
- 通用状态叠层、阈值、引爆、扩散、残留、沉默、混乱、肾毒反噬框架。
- 亚型管理、脱战切换、旧 Debuff 保留和毒液点。

### 验收

- 8 个默认亚型均可独立完成本轮目标。
- 阈值只触发一次，大型控制衰减正确，切换不串技能/被动。
- Phase 1—2 全量回归通过。

## 11. Phase 4：毒素全亚型

### 实现

- 补齐其余 24 亚型、96 技能、24 被动。
- 完成专属机制和全部模糊数值的配置化量化。
- 配置驱动生成技能库、亚型面板和自动化清单测试。

### 验收

- 32 亚型均可解锁、切换、升级、装备、保存和恢复。
- 168 主动技能、42 被动数量和引用契约通过。
- 全亚型批量冒烟与前序回归通过。

## 12. Phase 5：内容与生产质量

- 完成地图生态、成就、新手引导、音效、视觉反馈和设置。
- 平衡三本源，执行 30 分钟稳定性与目标性能压测。
- Chrome/Edge、1280×720 和 1920×1080 验收。
- 更新全部文档、需求—测试追踪和发布清单。

## 13. Phase 6：交付与版本操作

- 执行最终 `lint`、`typecheck`、全量单测/集成/E2E、生产构建和手工冒烟。
- 汇总已知限制、测试证据和 diff 级审核结果。
- 向用户确认：提交文件范围、commit message、是否创建 tag。
- 只有获得明确授权后，才按相关文件逐个 `git add` 并执行 commit；push/tag 仍需包含在授权中。
