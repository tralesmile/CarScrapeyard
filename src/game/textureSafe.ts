import Phaser from 'phaser';

/**
 * Remove textures safely: any image or sprite in the scene (also inside containers) that still shows one of the keys
 * is pointed at the stock '__WHITE' texture first, because Phaser's WebGL renderer throws "reading 'glTexture'" when it
 * draws a game object whose texture was removed (e2e flake P1.3t, runs 38 and 46).
 */
export function removeTexturesSafely(scene: Phaser.Scene, keys: readonly string[]): void {
  const doomed = new Set(keys.filter((k) => scene.textures.exists(k)));
  if (doomed.size === 0) return;
  const visit = (objs: readonly Phaser.GameObjects.GameObject[]) => {
    for (const o of objs) {
      if (o instanceof Phaser.GameObjects.Container) visit(o.list);
      else if (o instanceof Phaser.GameObjects.Image && o.texture && doomed.has(o.texture.key)) o.setTexture('__WHITE').setVisible(false);
    }
  };
  visit(scene.children.list);
  for (const k of doomed) scene.textures.remove(k);
}
