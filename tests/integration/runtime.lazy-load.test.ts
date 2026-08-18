import { describe, expect, it } from 'vitest';

describe('runtime lazy-load boundary', () => {
  it('TC-RUNTIME-008 exposes the Babylon runtime through an async module boundary without creating a scene', async () => {
    const runtimeModule = await import('../../src/game');

    expect(runtimeModule.BabylonGameRuntime).toBeTypeOf('function');
  });
});
