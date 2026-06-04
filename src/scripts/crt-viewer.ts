// three.jsは理解していないので、ブラックボックス...
import {
	Color,
	Mesh,
	PerspectiveCamera,
	Scene,
	ShaderMaterial,
	Texture,
	Vector2,
	WebGLRenderer,
} from 'three';
import type { MovieVideo } from '../types/video';
import { animateWithRaf, type RafAnimation } from './crt-animation';
import { FlattenController } from './crt-flatten-controller';
import { createCrtScreenGeometry } from './crt-geometry';
import { SELECTORS } from './crt-selectors';
import { fragmentShader, vertexShader } from './crt-shaders';
import { VideoSlotManager, type VideoSlot } from './crt-video-slots';

export type CrtViewerOptions = {
	canvas: HTMLCanvasElement;
	movies?: MovieVideo[];
	onChange?: (index: number) => void;
	onProgress?: (index: number, progress: number) => void;
};

type SwitchOptions = {
	direction?: number;
};

export type CrtViewerController = {
	play: () => void;
	pause: () => void;
	setAutoAdvance: (autoAdvance: boolean) => void;
	setTextureZoom: (zoom: number, duration?: number) => Promise<void>;
	restoreTextureZoom: (duration?: number) => Promise<void>;
	switchBy: (direction: number, options?: SwitchOptions) => boolean;
	switchTo: (index: number, options?: SwitchOptions) => boolean;
	getIndex: () => number;
	flatten: (duration?: number) => Promise<void>;
	unflatten: (duration?: number) => Promise<void>;
	isBusy: () => boolean;
	destroy: () => void;
};

export function initCrtViewer({ canvas, movies = [], onChange, onProgress }: CrtViewerOptions): CrtViewerController {
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const fallbackImage = canvas.parentElement?.querySelector<HTMLElement>(SELECTORS.crtFallback);
	const scene = new Scene();
	const camera = new PerspectiveCamera(35, 16 / 11, 0.1, 100);
	const emptyTexture = new Texture();
	const renderer = new WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
		powerPreference: 'high-performance',
	});

	camera.position.z = 4.98;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

	const geometry = createCrtScreenGeometry(4.55, 3.13, 96, 70);

	const material = new ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			uTexture: { value: emptyTexture },
			uNextTexture: { value: emptyTexture },
			uResolution: { value: new Vector2(1, 1) },
			uTime: { value: 0 },
			uHasTexture: { value: 0 },
			uHasNextTexture: { value: 0 },
			uMediaAspect: { value: 16 / 9 },
			uNextMediaAspect: { value: 16 / 9 },
			uTextureZoom: { value: 1 },
			uNextTextureZoom: { value: 1 },
			uTransitionProgress: { value: 0 },
			uTransitionDirection: { value: 1 },
			uFlattenProgress: { value: 0 },
			uFallbackColor: { value: new Color('#241b10') },
		},
	});

	const screen = new Mesh(geometry, material);
	scene.add(screen);

	let frameId = 0;
	let transitionAnimation: RafAnimation | null = null;
	let zoomAnimation: RafAnimation | null = null;
	let currentIndex = 0;
	let isPlaying = false;
	let isDestroyed = false;
	let isTransitioning = false;
	let isSwitchPending = false;
	let shouldAutoAdvance = true;
	let hasQueuedNearEndPreload = false;
	const slotManager = new VideoSlotManager({
		movies,
		isDestroyed: () => isDestroyed,
		onEnded: handleVideoEnded,
	});

	function normalizeIndex(index: number) {
		const total = movies.length;

		return ((index % total) + total) % total;
	}

	function hideFallback() {
		canvas.style.opacity = '1';
		if (fallbackImage) {
			fallbackImage.style.opacity = '0';
		}
	}

	function showFallback(revealImage = true) {
		material.uniforms.uHasTexture.value = 0;
		material.uniforms.uHasNextTexture.value = 0;
		canvas.style.opacity = '0';
		if (fallbackImage) {
			fallbackImage.style.opacity = revealImage ? '0.6' : '0';
		}
	}

	function updateFallbackMovieImage(index: number) {
		if (!fallbackImage) {
			return;
		}

		const movieImage = movies[normalizeIndex(index)]?.fallbackImage;
		if (movieImage) {
			fallbackImage.style.backgroundImage = `url("${encodeURI(movieImage)}")`;
		}
	}

	function setCurrentTexture(slot: VideoSlot) {
		if (!slot.texture) {
			return;
		}

		hasQueuedNearEndPreload = false;
		material.uniforms.uTexture.value = slot.texture;
		material.uniforms.uHasTexture.value = 1;
		material.uniforms.uMediaAspect.value = slot.aspect;
		material.uniforms.uTextureZoom.value = slot.zoom;
		material.uniforms.uHasNextTexture.value = 0;
		material.uniforms.uTransitionProgress.value = 0;
		hideFallback();
	}

	function getCurrentTextureZoom() {
		const slot = slotManager.get(currentIndex);

		return slot?.zoom ?? movies[currentIndex]?.zoom ?? 1.02;
	}

	function setTextureZoom(zoom: number, duration = 0) {
		zoomAnimation?.cancel(false);
		zoomAnimation = null;

		const currentZoom = Number(material.uniforms.uTextureZoom.value) || getCurrentTextureZoom();
		const nextZoom = Math.max(zoom, 0.01);

		if (duration <= 0) {
			material.uniforms.uTextureZoom.value = nextZoom;
			startRenderLoop();
			return Promise.resolve();
		}

		startRenderLoop();
		zoomAnimation = animateWithRaf(duration, (progress) => {
			if (isDestroyed) {
				zoomAnimation = null;
				return false;
			}

			material.uniforms.uTextureZoom.value = currentZoom + (nextZoom - currentZoom) * progress;
			if (progress >= 1) {
				zoomAnimation = null;
			}
		});

		return zoomAnimation.promise;
	}

	function restoreTextureZoom(duration = 0) {
		return setTextureZoom(getCurrentTextureZoom(), duration);
	}

	function handleVideoEnded(index: number) {
		if (isDestroyed || !isPlaying || isTransitioning || index !== currentIndex) {
			return;
		}

		onProgress?.(currentIndex, 1);
		if (!shouldAutoAdvance) {
			const slot = slotManager.get(currentIndex);
			if (slot) {
				slotManager.reset(slot);
				void playSlot(slot).then(() => {
					onProgress?.(currentIndex, 0);
				}).catch(() => undefined);
			}
			return;
		}

		void slotManager.prepare(currentIndex + 1).ready.catch(() => undefined);
		switchToIndex(currentIndex + 1, { direction: 1 });
	}

	function resize() {
		const { clientWidth, clientHeight } = canvas;
		const width = Math.max(clientWidth, 1);
		const height = Math.max(clientHeight, 1);

		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		material.uniforms.uResolution.value.set(width, height);
	}

	function startRenderLoop() {
		if (frameId || isDestroyed) {
			return;
		}

		frameId = window.requestAnimationFrame(render);
	}

	function stopRenderLoop() {
		if (!frameId) {
			return;
		}

		window.cancelAnimationFrame(frameId);
		frameId = 0;
	}

	function queueNearEndPreload(video: HTMLVideoElement) {
		if (hasQueuedNearEndPreload || movies.length < 2 || !Number.isFinite(video.duration)) {
			return;
		}

		const remainingTime = video.duration - video.currentTime;
		if (remainingTime <= 2) {
			hasQueuedNearEndPreload = true;
			void slotManager.prepare(currentIndex + 1).ready.catch(() => undefined);
		}
	}

	function notifyProgress() {
		const currentSlot = slotManager.get(currentIndex);
		const video = currentSlot?.video;

		if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
			onProgress?.(currentIndex, 0);
			return;
		}

		queueNearEndPreload(video);
		onProgress?.(currentIndex, video.currentTime / video.duration);
	}

	function renderFrame(time: number) {
		const flattenProgress = Math.min(Math.max(material.uniforms.uFlattenProgress.value as number, 0), 1);
		const rotationAmount = 1 - flattenProgress;

		material.uniforms.uTime.value = time * 0.001;
		screen.rotation.x = Math.sin(time * 0.00035) * 0.012 * rotationAmount;
		screen.rotation.y = Math.cos(time * 0.00028) * 0.018 * rotationAmount;
		renderer.render(scene, camera);
		notifyProgress();
	}

	function render(time: number) {
		renderFrame(time);
		frameId = isPlaying || isTransitioning || flattenController.isActive() ? window.requestAnimationFrame(render) : 0;
	}

	const flattenController = new FlattenController({
		material,
		isDestroyed: () => isDestroyed,
		startRenderLoop,
		renderFrame,
	});

	function flatten(duration = 400) {
		return flattenController.flatten(duration);
	}

	function unflatten(duration = 400) {
		return flattenController.unflatten(duration);
	}

	function isBusy() {
		return isTransitioning || isSwitchPending || flattenController.isActive();
	}

	function preloadAdjacent() {
		if (movies.length < 2 || prefersReducedMotion) {
			return;
		}

		void slotManager.prepare(currentIndex + 1).ready.catch(() => undefined);
		void slotManager.prepare(currentIndex - 1).ready.catch(() => undefined);
	}

	async function playSlot(slot: VideoSlot) {
		try {
			await slot.video.play();
		} catch (error) {
			showFallback(true);
			throw error;
		}
	}

	function waitForVideoFrame(video: HTMLVideoElement) {
		return new Promise<void>((resolve) => {
			let isResolved = false;
			const fallbackTimer = window.setTimeout(resolveOnce, 300);

			function resolveOnce() {
				if (isResolved) {
					return;
				}

				isResolved = true;
				window.clearTimeout(fallbackTimer);
				resolve();
			}

			if ('requestVideoFrameCallback' in video) {
				video.requestVideoFrameCallback(resolveOnce);
				return;
			}

			window.setTimeout(resolveOnce, 80);
		});
	}

	function waitForEventWithTimeout(target: EventTarget, eventName: string, timeout: number) {
		return new Promise<void>((resolve) => {
			let isResolved = false;
			const fallbackTimer = window.setTimeout(resolveOnce, timeout);

			function resolveOnce() {
				if (isResolved) {
					return;
				}

				isResolved = true;
				window.clearTimeout(fallbackTimer);
				target.removeEventListener(eventName, resolveOnce);
				resolve();
			}

			target.addEventListener(eventName, resolveOnce, { once: true });
		});
	}

	async function seekVideoToStart(video: HTMLVideoElement) {
		if (!Number.isFinite(video.duration) || video.duration <= 0) {
			return;
		}

		if (video.currentTime < 0.02) {
			return;
		}

		try {
			video.currentTime = 0;
			await waitForEventWithTimeout(video, 'seeked', 220);
		} catch {
			// seekできないタイミングでは、現在のフレームをそのまま使う
		}
	}

	async function loadInitialVideo() {
		if (!movies.length || isDestroyed) {
			showFallback(true);
			return;
		}

		updateFallbackMovieImage(currentIndex);

		if (prefersReducedMotion) {
			showFallback(true);
			return;
		}

		try {
			resize();
			renderFrame(performance.now());
			const slot = await slotManager.prepare(currentIndex).ready;
			if (slot.video.ended) {
				slotManager.reset(slot);
			}
			if (isPlaying) {
				await playSlot(slot);
				await waitForVideoFrame(slot.video);
			}
			setCurrentTexture(slot);
			onChange?.(currentIndex);
			onProgress?.(currentIndex, 0);
			if (isPlaying) {
				startRenderLoop();
			}
			preloadAdjacent();
		} catch {
			showFallback(true);
			stopRenderLoop();
		}
	}

	async function animateTransition(targetIndex: number, targetSlot: VideoSlot, direction: number) {
		const duration = 380;

		isTransitioning = true;

		try {
			await seekVideoToStart(targetSlot.video);
			await playSlot(targetSlot);
			await waitForVideoFrame(targetSlot.video);
		} catch {
			isTransitioning = false;
			return;
		}

		material.uniforms.uNextTexture.value = targetSlot.texture ?? emptyTexture;
		material.uniforms.uHasNextTexture.value = targetSlot.texture ? 1 : 0;
		material.uniforms.uNextMediaAspect.value = targetSlot.aspect;
		material.uniforms.uNextTextureZoom.value = targetSlot.zoom;
		material.uniforms.uTransitionDirection.value = direction > 0 ? 1 : -1;
		startRenderLoop();

		transitionAnimation = animateWithRaf(duration, (progress) => {
			if (isDestroyed) {
				isTransitioning = false;
				transitionAnimation = null;
				return false;
			}

			material.uniforms.uTransitionProgress.value = progress;

			if (progress >= 1) {
				currentIndex = targetIndex;
				setCurrentTexture(targetSlot);
				updateFallbackMovieImage(currentIndex);
				onChange?.(currentIndex);
				onProgress?.(currentIndex, 0);
				isTransitioning = false;
				transitionAnimation = null;
				slotManager.pauseInactive(currentIndex);
				preloadAdjacent();
			}
		});
	}

	function switchToIndex(index: number, options: SwitchOptions = {}) {
		if (isDestroyed || isTransitioning || isSwitchPending || movies.length < 2 || prefersReducedMotion) {
			return false;
		}

		const targetIndex = normalizeIndex(index);

		if (targetIndex === currentIndex) {
			return false;
		}

		const direction = options.direction ?? (targetIndex > currentIndex ? 1 : -1);
		const targetSlot = slotManager.prepare(targetIndex);

		isSwitchPending = true;
		void targetSlot.ready
			.then((readySlot) => {
				if (isDestroyed || isTransitioning) {
					isSwitchPending = false;
					return;
				}

				isSwitchPending = false;
				void animateTransition(targetIndex, readySlot, direction);
			})
			.catch(() => {
				isSwitchPending = false;
				updateFallbackMovieImage(currentIndex);
				onChange?.(currentIndex);
			});

		return true;
	}

	resize();
	window.addEventListener('resize', resize);

	return {
		play() {
			if (isDestroyed) {
				return;
			}

			isPlaying = true;
			void loadInitialVideo();

			const slot = slotManager.get(currentIndex);
			if (slot?.texture) {
				void playSlot(slot);
				startRenderLoop();
			}
		},
		pause() {
			if (isDestroyed) {
				return;
			}

			isPlaying = false;
			stopRenderLoop();
			slotManager.pauseAll();
		},
		setAutoAdvance(autoAdvance: boolean) {
			shouldAutoAdvance = autoAdvance;
		},
		setTextureZoom,
		restoreTextureZoom,
		switchBy(direction: number, options: SwitchOptions = {}) {
			const normalizedDirection = direction > 0 ? 1 : -1;

			return switchToIndex(currentIndex + normalizedDirection, { ...options, direction: normalizedDirection });
		},
		switchTo(index: number, options: SwitchOptions = {}) {
			return switchToIndex(index, options);
		},
		getIndex() {
			return currentIndex;
		},
		flatten,
		unflatten,
		isBusy,
		destroy() {
			if (isDestroyed) {
				return;
			}

			isDestroyed = true;
			isPlaying = false;
			flattenController.cancel();
			stopRenderLoop();
			transitionAnimation?.cancel(false);
			transitionAnimation = null;
			zoomAnimation?.cancel(false);
			zoomAnimation = null;
			window.removeEventListener('resize', resize);
			showFallback(false);
			slotManager.dispose();
			emptyTexture.dispose();
			geometry.dispose();
			material.dispose();
			renderer.dispose();
		},
	};
}
