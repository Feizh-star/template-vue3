import * as THREE from 'three'
/**
 * 简单模型动画管理器
 */
export class AnimationMixerUpdater {
  private mixer: THREE.AnimationMixer
  private animateClip: { clip: THREE.AnimationClip; action: THREE.AnimationAction }[] = []
  constructor(gltfModel: IGltfLoaderResult) {
    this.mixer = new THREE.AnimationMixer(gltfModel.scene)
    gltfModel.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip)
      action.play()
      this.animateClip.push({ clip, action })
    })
  }
  public update(dt: number) {
    if (!this.mixer) return this
    this.mixer.update(dt)
    return this
  }
  public distory() {
    if (!this.mixer) return
    const root = this.mixer.getRoot()
    this.mixer.stopAllAction()
    this.animateClip.forEach((item) => {
      this.mixer.uncacheClip(item.clip)
      this.mixer.uncacheAction(item.clip, root)
    })
    this.mixer.uncacheRoot(root)
  }
}
