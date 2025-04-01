import * as THREE from 'three'

/**
 * 动画初始化器
 */
export class AnimationInitiator {
  private enable: boolean = false
  private effectClock: THREE.Clock | null = null
  constructor(enable?: boolean, startAction?: () => void) {
    if (enable) {
      this.startAnimationInitiator(startAction)
    }
  }
  public startAnimationInitiator(startAction?: () => void) {
    this.enable = true
    this.effectClock = new THREE.Clock()
    if (startAction) startAction()
  }
  public stopAnimationInitiator(stopAction?: () => void) {
    this.enable = false
    this.effectClock = null
    if (stopAction) stopAction()
  }
  public animationInitiatorTick(handler: (delta: number) => void) {
    if (this.enable && this.effectClock) {
      const delta = this.effectClock.getDelta()
      handler(delta)
    }
  }
}
