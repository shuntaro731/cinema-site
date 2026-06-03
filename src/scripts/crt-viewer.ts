// three.jsは理解していないので、ブラックボックス...
import {
	Color,
	LinearFilter,
	Mesh,
	PerspectiveCamera,
	Scene,
	ShaderMaterial,
	Texture,
	Vector2,
	VideoTexture,
	WebGLRenderer,
} from 'three';
import { createCrtScreenGeometry } from './crt-geometry';
import { fragmentShader, vertexShader } from './crt-shaders';

type VideoSource = {
	src: string;
	type?: string;
};

export type MovieVideo = {
	id: number;
	movieImage?: string;
	sources?: VideoSource[];
	zoom?: number;
};

export type CrtViewerOptions = {
	canvas: HTMLCanvasElement;
	movies?: MovieVideo[];
	onChange?: (index: number) => void;
	onProgress?: (index: number, progress: number) => void;
};

type VideoSlot = {
	video: HTMLVideoElement;
	texture: VideoTexture | null;
	aspect: number;
	zoom: number;
	ready: Promise<VideoSlot>;
};

type SwitchOptions = {
	direction?: number;
};

export type CrtViewerController = {
	preload: () => void;
	play: () => void;
	pause: () => void;
	setAutoAdvance: (autoAdvance: boolean) => void;
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
	const fallbackImage = canvas.parentElement?.querySelector<HTMLElement>('[data-crt-fallback]');
	const movieQueue = movies;
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
	let transitionFrameId = 0;
	let flattenFrameId = 0;
	let flattenResolve: (() => void) | null = null;
	let currentIndex = 0;
	let isPlaying = false;
	let isDestroyed = false;
	let isTransitioning = false;
	let isFlattening = false;
	let isSwitchPending = false;
	let shouldAutoAdvance = true;
	let hasQueuedNearEndPreload = false;
	const slots = new Map<number, VideoSlot>();

	function normalizeIndex(index: number) {
		const total = movieQueue.length;

		return ((index % total) + total) % total;
	}

	function getPlayableSource(targetVideo: HTMLVideoElement, sources: VideoSource[]) {
		return sources.find((source) => !source.type || targetVideo.canPlayType(source.type)) ?? sources[0];
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

		const movieImage = movieQueue[normalizeIndex(index)]?.movieImage;
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

	function resetVideo(slot: VideoSlot) {
		if (Number.isFinite(slot.video.duration) && slot.video.currentTime > 0) {
			try {
				slot.video.currentTime = 0;
			} catch {
				// 読み込み直後にcurrentTimeを触れないブラウザでは、そのまま再生する
			}
		}
	}

	function handleVideoEnded(index: number) {
		if (isDestroyed || !isPlaying || isTransitioning || index !== currentIndex) {
			return;
		}

		onProgress?.(currentIndex, 1);
		if (!shouldAutoAdvance) {
			const slot = slots.get(currentIndex);
			if (slot) {
				resetVideo(slot);
				void playSlot(slot).then(() => {
					onProgress?.(currentIndex, 0);
				}).catch(() => undefined);
			}
			return;
		}

		void prepareSlot(currentIndex + 1).ready.catch(() => undefined);
		switchToIndex(currentIndex + 1, { direction: 1 });
	}

	function prepareSlot(index: number) {
		const normalizedIndex = normalizeIndex(index);
		const existingSlot = slots.get(normalizedIndex);

		if (existingSlot) {
			return existingSlot;
		}

		const movie = movieQueue[normalizedIndex];
		const sources = movie?.sources ?? [];
		const video = document.createElement('video');
		const slot: VideoSlot = {
			video,
			texture: null,
			aspect: 16 / 9,
			zoom: movie?.zoom ?? 1,
			ready: Promise.resolve(null as unknown as VideoSlot),
		};

		video.muted = true;
		video.loop = false;
		video.playsInline = true;
		video.preload = 'auto';
		video.crossOrigin = 'anonymous';
		video.addEventListener('ended', () => handleVideoEnded(normalizedIndex));

		slot.ready = new Promise<VideoSlot>((resolve, reject) => {
			const source = getPlayableSource(video, sources);

			if (!source?.src) {
				reject(new Error('No playable video source.'));
				return;
			}

			video.addEventListener('canplay', () => {
				if (isDestroyed) {
					reject(new Error('CRT viewer destroyed.'));
					return;
				}

				slot.aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
				slot.texture = new VideoTexture(video);
				slot.texture.minFilter = LinearFilter;
				slot.texture.magFilter = LinearFilter;
				resolve(slot);
			}, { once: true });

			video.addEventListener('error', () => reject(new Error('Video failed to load.')), { once: true });
			video.src = source.src;
			video.load();
		});

		slots.set(normalizedIndex, slot);
		return slot;
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
		if (hasQueuedNearEndPreload || movieQueue.length < 2 || !Number.isFinite(video.duration)) {
			return;
		}

		const remainingTime = video.duration - video.currentTime;
		if (remainingTime <= 2) {
			hasQueuedNearEndPreload = true;
			void prepareSlot(currentIndex + 1).ready.catch(() => undefined);
		}
	}

	function notifyProgress() {
		const currentSlot = slots.get(currentIndex);
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
		frameId = isPlaying || isTransitioning || isFlattening ? window.requestAnimationFrame(render) : 0;
	}

	function resolveFlatten() {
		if (!flattenResolve) {
			return;
		}

		flattenResolve();
		flattenResolve = null;
	}

	function cancelFlatten(resolve = true) {
		if (flattenFrameId) {
			window.cancelAnimationFrame(flattenFrameId);
			flattenFrameId = 0;
		}
		isFlattening = false;
		if (resolve) {
			resolveFlatten();
		}
	}

	function animateFlatten(targetProgress: number, duration = 400) {
		if (isDestroyed) {
			return Promise.resolve();
		}

		cancelFlatten();

		const currentProgress = Math.min(Math.max(material.uniforms.uFlattenProgress.value as number, 0), 1);
		const nextProgress = Math.min(Math.max(targetProgress, 0), 1);
		const animationDuration = duration;

		if (Math.abs(currentProgress - nextProgress) < 0.001 || animationDuration <= 0) {
			material.uniforms.uFlattenProgress.value = nextProgress;
			renderFrame(performance.now());
			return Promise.resolve();
		}

		isFlattening = true;
		startRenderLoop();

		return new Promise<void>((resolve) => {
			const startTime = performance.now();

			flattenResolve = resolve;

			function step(time: number) {
				if (isDestroyed) {
					cancelFlatten();
					return;
				}

				const progress = Math.min((time - startTime) / animationDuration, 1);
				material.uniforms.uFlattenProgress.value = currentProgress + (nextProgress - currentProgress) * progress;

				if (progress < 1) {
					flattenFrameId = window.requestAnimationFrame(step);
					return;
				}

				flattenFrameId = 0;
				isFlattening = false;
				material.uniforms.uFlattenProgress.value = nextProgress;
				renderFrame(performance.now());
				resolveFlatten();
			}

			flattenFrameId = window.requestAnimationFrame(step);
		});
	}

	function flatten(duration = 400) {
		return animateFlatten(1, duration);
	}

	function unflatten(duration = 400) {
		return animateFlatten(0, duration);
	}

	function isBusy() {
		return isTransitioning || isSwitchPending || isFlattening;
	}

	function preloadAdjacent() {
		if (movieQueue.length < 2 || prefersReducedMotion) {
			return;
		}

		void prepareSlot(currentIndex + 1).ready.catch(() => undefined);
		void prepareSlot(currentIndex - 1).ready.catch(() => undefined);
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

	function waitForSeek(video: HTMLVideoElement) {
		return new Promise<void>((resolve) => {
			let isResolved = false;
			const fallbackTimer = window.setTimeout(resolveOnce, 220);

			function resolveOnce() {
				if (isResolved) {
					return;
				}

				isResolved = true;
				window.clearTimeout(fallbackTimer);
				video.removeEventListener('seeked', resolveOnce);
				resolve();
			}

			video.addEventListener('seeked', resolveOnce, { once: true });
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
			await waitForSeek(video);
		} catch {
			// seekできないタイミングでは、現在のフレームをそのまま使う
		}
	}

	function pauseInactiveSlots() {
		slots.forEach((slot, index) => {
			if (index !== currentIndex) {
				slot.video.pause();
			}
		});
	}

	async function loadInitialVideo() {
		if (!movieQueue.length || isDestroyed) {
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
			const slot = await prepareSlot(currentIndex).ready;
			if (slot.video.ended) {
				resetVideo(slot);
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
		let startTime = 0;

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
		startTime = performance.now();
		startRenderLoop();

		function step(time: number) {
			if (isDestroyed) {
				return;
			}

			const progress = Math.min((time - startTime) / duration, 1);
			material.uniforms.uTransitionProgress.value = progress;

			if (progress < 1) {
				transitionFrameId = window.requestAnimationFrame(step);
				return;
			}

			currentIndex = targetIndex;
			setCurrentTexture(targetSlot);
			updateFallbackMovieImage(currentIndex);
			onChange?.(currentIndex);
			onProgress?.(currentIndex, 0);
			isTransitioning = false;
			transitionFrameId = 0;
			pauseInactiveSlots();
			preloadAdjacent();
		}

		transitionFrameId = window.requestAnimationFrame(step);
	}

	function switchToIndex(index: number, options: SwitchOptions = {}) {
		if (isDestroyed || isTransitioning || isSwitchPending || movieQueue.length < 2 || prefersReducedMotion) {
			return false;
		}

		const targetIndex = normalizeIndex(index);

		if (targetIndex === currentIndex) {
			return false;
		}

		const direction = options.direction ?? (targetIndex > currentIndex ? 1 : -1);
		const targetSlot = prepareSlot(targetIndex);

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
		preload() {
			if (isDestroyed) {
				return;
			}

			void loadInitialVideo();
		},
		play() {
			if (isDestroyed) {
				return;
			}

			isPlaying = true;
			void loadInitialVideo();

			const slot = slots.get(currentIndex);
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
			slots.forEach((slot) => slot.video.pause());
		},
		setAutoAdvance(autoAdvance: boolean) {
			shouldAutoAdvance = autoAdvance;
		},
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
			cancelFlatten();
			stopRenderLoop();
			window.cancelAnimationFrame(transitionFrameId);
			window.removeEventListener('resize', resize);
			showFallback(false);
			slots.forEach((slot) => {
				slot.video.pause();
				slot.video.removeAttribute('src');
				slot.video.load();
				slot.texture?.dispose();
			});
			emptyTexture.dispose();
			geometry.dispose();
			material.dispose();
			renderer.dispose();
		},
	};
}
