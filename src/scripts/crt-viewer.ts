import {
	Color,
	LinearFilter,
	Mesh,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	Texture,
	Vector2,
	VideoTexture,
	WebGLRenderer,
} from 'three';

type VideoSource = {
	src: string;
	type?: string;
};

type MovieVideo = {
	id?: number;
	sources?: VideoSource[];
	zoom?: number;
};

type CrtViewerOptions = {
	canvas: HTMLCanvasElement;
	movies?: MovieVideo[];
	videoSrc?: string;
	videoSources?: VideoSource[];
	videoZoom?: number;
	onChange?: (index: number) => void;
};

type VideoSlot = {
	video: HTMLVideoElement;
	texture: VideoTexture | null;
	aspect: number;
	zoom: number;
	ready: Promise<VideoSlot>;
};

export type CrtViewerController = {
	preload: () => void;
	play: () => void;
	pause: () => void;
	switchBy: (direction: number) => boolean;
	switchTo: (index: number) => boolean;
	getIndex: () => number;
	destroy: () => void;
};

const vertexShader = `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D uTexture;
uniform sampler2D uNextTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform float uHasTexture;
uniform float uHasNextTexture;
uniform float uMediaAspect;
uniform float uNextMediaAspect;
uniform float uTextureZoom;
uniform float uNextTextureZoom;
uniform float uTransitionProgress;
uniform float uTransitionDirection;
uniform vec3 uFallbackColor;

varying vec2 vUv;

float random(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 coverUv(vec2 uv, float mediaAspect, float textureZoom) {
	float screenAspect = uResolution.x / max(uResolution.y, 1.0);
	vec2 fitted = uv;

	if (mediaAspect > screenAspect) {
		fitted.x = (uv.x - 0.5) * (screenAspect / mediaAspect) + 0.5;
	} else {
		fitted.y = (uv.y - 0.5) * (mediaAspect / screenAspect) + 0.5;
	}

	return (fitted - 0.5) / max(textureZoom, 0.01) + 0.5;
}

vec3 sampleCrt(sampler2D sourceTexture, vec2 uv, float mediaAspect, float textureZoom, float radius, float chromaBoost) {
	vec2 mediaUv = coverUv(uv, mediaAspect, textureZoom);
	float chroma = 0.0035 + radius * 0.002 + chromaBoost;
	float red = texture2D(sourceTexture, clamp(mediaUv + vec2(chroma, 0.0), 0.0, 1.0)).r;
	float green = texture2D(sourceTexture, clamp(mediaUv, 0.0, 1.0)).g;
	float blue = texture2D(sourceTexture, clamp(mediaUv - vec2(chroma, 0.0), 0.0, 1.0)).b;

	return vec3(red, green, blue);
}

void main() {
	vec2 uv = vUv;
	vec2 centered = uv * 2.0 - 1.0;
	float radius = dot(centered, centered);

	vec2 warped = centered * (1.0 + radius * 0.11);
	vec2 sampleUv = warped * 0.5 + 0.5;

	float progress = smoothstep(0.0, 1.0, uTransitionProgress);
	float lineNoise = random(vec2(floor(sampleUv.y * 42.0), floor(uTime * 14.0)));
	float wipe = uTransitionDirection > 0.0 ? 1.0 - sampleUv.y : sampleUv.y;
	float transitionLine = progress * 1.08 - 0.04 + (lineNoise - 0.5) * 0.035;
	float mixAmount = (1.0 - smoothstep(transitionLine - 0.035, transitionLine + 0.085, wipe)) * uHasNextTexture;
	float band = smoothstep(0.11, 0.0, abs(wipe - transitionLine)) * 0.45;
	float sweepY = 1.0 - fract(uTime * 0.48);
	float idleBand = smoothstep(0.07, 0.0, abs(sampleUv.y - sweepY)) * (1.0 - progress);
	float sweepBand = max(band, idleBand);
	float sweepShift = sin(sampleUv.y * 70.0 + uTime * 18.0) * 0.0015;
	sweepShift += (lineNoise - 0.5) * 0.0015;
	vec2 distortedUv = sampleUv + vec2(sweepShift * sweepBand, sin(sampleUv.x * 18.0 + uTime * 10.0) * sweepBand * 0.001);

	vec3 color = uFallbackColor;

	if (uHasTexture > 0.5) {
		color = sampleCrt(uTexture, distortedUv, uMediaAspect, uTextureZoom, radius, band * 0.008);
	}

	if (uHasNextTexture > 0.5) {
		vec2 nextUv = distortedUv;
		nextUv.y += (1.0 - progress) * 0.018 * uTransitionDirection;
		vec3 nextColor = sampleCrt(uNextTexture, nextUv, uNextMediaAspect, uNextTextureZoom, radius, band * 0.006);
		color = mix(color, nextColor, mixAmount);
	}

	float scanline = sin((sampleUv.y * uResolution.y * 1.35) + uTime * 18.0) * 0.04;
	float grille = sin(sampleUv.x * uResolution.x * 3.14159) * 0.025;
	float noise = random(sampleUv * uResolution.xy + uTime * 48.0) * 0.06;
	float sweepStatic = random(sampleUv * vec2(180.0, 42.0) + floor(uTime * 16.0));
	float sweepNoise = sweepBand * (sweepStatic - 0.5) * 0.05;
	float transitionDip = progress * (1.0 - progress) * 0.28;
	float glow = smoothstep(0.9, 0.0, radius) * 0.14;

	color *= vec3(1.08, 0.98, 0.74);
	color += glow;
	color += noise + sweepNoise;
	color -= transitionDip;
	color -= scanline + grille;

	gl_FragColor = vec4(color, 1.0);
}
`;

export function initCrtViewer({ canvas, movies = [], videoSrc, videoSources = [], videoZoom = 1, onChange }: CrtViewerOptions): CrtViewerController {
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const fallbackImage = canvas.parentElement?.querySelector<HTMLElement>('[data-crt-fallback]');
	const movieQueue = movies.length
		? movies
		: [{ sources: videoSources.length ? videoSources : videoSrc ? [{ src: videoSrc, type: 'video/mp4' }] : [], zoom: videoZoom }];
	const scene = new Scene();
	const camera = new PerspectiveCamera(35, 16 / 9, 0.1, 100);
	const emptyTexture = new Texture();
	const renderer = new WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
		powerPreference: 'high-performance',
	});

	camera.position.z = 4.2;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

	const planeWidth = 4.75;
	const planeHeight = 3.04;
	const geometry = new PlaneGeometry(planeWidth, planeHeight, 88, 52);
	const positions = geometry.attributes.position;

	for (let index = 0; index < positions.count; index += 1) {
		const x = positions.getX(index);
		const y = positions.getY(index);
		const nx = x / (planeWidth / 2);
		const ny = y / (planeHeight / 2);
		const edge = nx * nx + ny * ny;
		positions.setZ(index, -edge * 0.16);
	}

	positions.needsUpdate = true;
	geometry.computeVertexNormals();

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
			uTextureZoom: { value: videoZoom },
			uNextTextureZoom: { value: videoZoom },
			uTransitionProgress: { value: 0 },
			uTransitionDirection: { value: 1 },
			uFallbackColor: { value: new Color('#241b10') },
		},
	});

	const screen = new Mesh(geometry, material);
	scene.add(screen);

	let frameId = 0;
	let transitionFrameId = 0;
	let currentIndex = 0;
	let isPlaying = false;
	let isDestroyed = false;
	let isTransitioning = false;
	let isSwitchPending = false;
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

	function setCurrentTexture(slot: VideoSlot) {
		if (!slot.texture) {
			return;
		}

		slot.texture.minFilter = LinearFilter;
		slot.texture.magFilter = LinearFilter;
		material.uniforms.uTexture.value = slot.texture;
		material.uniforms.uHasTexture.value = 1;
		material.uniforms.uMediaAspect.value = slot.aspect;
		material.uniforms.uTextureZoom.value = slot.zoom;
		material.uniforms.uHasNextTexture.value = 0;
		material.uniforms.uTransitionProgress.value = 0;
		hideFallback();
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
		video.loop = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.crossOrigin = 'anonymous';

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

	function renderFrame(time: number) {
		material.uniforms.uTime.value = time * 0.001;
		screen.rotation.x = Math.sin(time * 0.00035) * 0.012;
		screen.rotation.y = Math.cos(time * 0.00028) * 0.018;
		renderer.render(scene, camera);
	}

	function render(time: number) {
		renderFrame(time);
		frameId = isPlaying || isTransitioning ? window.requestAnimationFrame(render) : 0;
	}

	function preloadAdjacent() {
		if (movieQueue.length < 2 || prefersReducedMotion) {
			return;
		}

		void prepareSlot(currentIndex + 1).ready.catch(() => undefined);
		void prepareSlot(currentIndex - 1).ready.catch(() => undefined);
	}

	function playSlot(slot: VideoSlot) {
		void slot.video.play().catch(() => showFallback(true));
	}

	function pauseInactiveSlots() {
		slots.forEach((slot, index) => {
			if (index !== currentIndex) {
				slot.video.pause();
			}
		});
	}

	async function loadInitialVideo() {
		if (!movieQueue.length || prefersReducedMotion || isDestroyed) {
			showFallback(true);
			return;
		}

		try {
			resize();
			hideFallback();
			renderFrame(performance.now());
			const slot = await prepareSlot(currentIndex).ready;
			setCurrentTexture(slot);
			onChange?.(currentIndex);
			if (isPlaying) {
				playSlot(slot);
				startRenderLoop();
			}
			preloadAdjacent();
		} catch {
			showFallback(true);
			stopRenderLoop();
		}
	}

	function animateTransition(targetIndex: number, targetSlot: VideoSlot, direction: number) {
		const duration = 380;
		const startTime = performance.now();

		isTransitioning = true;
		material.uniforms.uNextTexture.value = targetSlot.texture ?? emptyTexture;
		material.uniforms.uHasNextTexture.value = targetSlot.texture ? 1 : 0;
		material.uniforms.uNextMediaAspect.value = targetSlot.aspect;
		material.uniforms.uNextTextureZoom.value = targetSlot.zoom;
		material.uniforms.uTransitionDirection.value = direction > 0 ? 1 : -1;
		playSlot(targetSlot);
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
			onChange?.(currentIndex);
			isTransitioning = false;
			transitionFrameId = 0;
			pauseInactiveSlots();
			preloadAdjacent();
		}

		transitionFrameId = window.requestAnimationFrame(step);
	}

	function switchToIndex(index: number, directionOverride?: number) {
		if (isDestroyed || isTransitioning || isSwitchPending || movieQueue.length < 2 || prefersReducedMotion) {
			return false;
		}

		const targetIndex = normalizeIndex(index);

		if (targetIndex === currentIndex) {
			return false;
		}

		const direction = directionOverride ?? (targetIndex > currentIndex ? 1 : -1);
		const targetSlot = prepareSlot(targetIndex);

		isSwitchPending = true;
		void targetSlot.ready
			.then((readySlot) => {
				if (isDestroyed || isTransitioning) {
					isSwitchPending = false;
					return;
				}

				hideFallback();
				isSwitchPending = false;
				animateTransition(targetIndex, readySlot, direction);
			})
			.catch(() => {
				isSwitchPending = false;
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
				playSlot(slot);
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
		switchBy(direction: number) {
			const normalizedDirection = direction > 0 ? 1 : -1;

			return switchToIndex(currentIndex + normalizedDirection, normalizedDirection);
		},
		switchTo(index: number) {
			return switchToIndex(index);
		},
		getIndex() {
			return currentIndex;
		},
		destroy() {
			if (isDestroyed) {
				return;
			}

			isDestroyed = true;
			isPlaying = false;
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
