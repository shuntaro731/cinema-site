import type { ShaderMaterial } from 'three';
import { animateWithRaf, type RafAnimation } from './crt-animation';

type FlattenControllerOptions = {
	material: ShaderMaterial;
	isDestroyed: () => boolean;
	startRenderLoop: () => void;
	renderFrame: (time: number) => void;
};

export class FlattenController {
	private animation: RafAnimation | null = null;
	private active = false;
	private readonly material: ShaderMaterial;
	private readonly isDestroyed: () => boolean;
	private readonly startRenderLoop: () => void;
	private readonly renderFrame: (time: number) => void;

	constructor({ material, isDestroyed, startRenderLoop, renderFrame }: FlattenControllerOptions) {
		this.material = material;
		this.isDestroyed = isDestroyed;
		this.startRenderLoop = startRenderLoop;
		this.renderFrame = renderFrame;
	}

	flatten(duration = 400) {
		return this.animate(1, duration);
	}

	unflatten(duration = 400) {
		return this.animate(0, duration);
	}

	isActive() {
		return this.active;
	}

	cancel(resolve = true) {
		this.animation?.cancel(resolve);
		this.animation = null;
		this.active = false;
	}

	private animate(targetProgress: number, duration = 400) {
		if (this.isDestroyed()) {
			return Promise.resolve();
		}

		this.cancel();

		const currentProgress = Math.min(Math.max(this.material.uniforms.uFlattenProgress.value as number, 0), 1);
		const nextProgress = Math.min(Math.max(targetProgress, 0), 1);

		if (Math.abs(currentProgress - nextProgress) < 0.001 || duration <= 0) {
			this.material.uniforms.uFlattenProgress.value = nextProgress;
			this.renderFrame(performance.now());
			return Promise.resolve();
		}

		this.active = true;
		this.startRenderLoop();

		this.animation = animateWithRaf(duration, (progress) => {
			if (this.isDestroyed()) {
				this.cancel();
				return false;
			}

			this.material.uniforms.uFlattenProgress.value = currentProgress + (nextProgress - currentProgress) * progress;

			if (progress >= 1) {
				this.animation = null;
				this.active = false;
				this.material.uniforms.uFlattenProgress.value = nextProgress;
				this.renderFrame(performance.now());
			}
		});

		return this.animation.promise;
	}
}
