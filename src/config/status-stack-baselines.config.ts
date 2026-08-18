/**
 * 原稿未指定层数上限、但明确存在多层/叠层机制的状态首版上限。
 * 单位：层。明确阈值状态仍在内容目录中逐项配置，不能由此覆盖。
 */
export const statusStackBaselines: Record<string, number> = {
  /** 肌肉毒素的“高层/叠层/引爆”需要保留多次施加。 */
  'muscle-stiffness': 6,
  /** 衰弱可多层累积并转化为肌肉僵直。 */
  weakness: 6,
  /** 肾毒反噬会随敌方多次施法积蓄。 */
  'kidney-reprisal': 6,
};
