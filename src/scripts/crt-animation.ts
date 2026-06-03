export type RafAnimation = {
	promise: Promise<void>;
	cancel: (resolveAnimation?: boolean) => void;
};

export function animateWithRaf(duration: number, onStep: (progress: number) => boolean | void): RafAnimation {
	let frameId = 0;
	let resolveCurrent: (() => void) | null = null;
	const promise = new Promise<void>((resolve) => {
		const startTime = performance.now();

		function step(time: number) {
			const progress = duration <= 0 ? 1 : Math.min((time - startTime) / duration, 1);
			const shouldContinue = onStep(progress);

			if (shouldContinue === false) {
				frameId = 0;
				resolveCurrent = null;
				resolve();
				return;
			}

			if (progress < 1) {
				frameId = window.requestAnimationFrame(step);
				return;
			}

			frameId = 0;
			resolveCurrent = null;
			resolve();
		}

		resolveCurrent = resolve;
		frameId = window.requestAnimationFrame(step);
	});

	return {
		promise,
		cancel(resolveAnimation = true) {
			if (frameId) {
				window.cancelAnimationFrame(frameId);
				frameId = 0;
			}
			if (resolveAnimation && resolveCurrent) {
				resolveCurrent();
			}
			resolveCurrent = null;
		},
	};
}
