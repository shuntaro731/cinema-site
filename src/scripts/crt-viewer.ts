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

type CrtViewerOptions = {
	canvas: HTMLCanvasElement;
	videoSrc?: string;
	videoSources?: VideoSource[];
	videoZoom?: number;
};

type VideoSource = {
	src: string;
	type?: string;
};

export type CrtViewerController = {
	preload: () => void;
	play: () => void;
	pause: () => void;
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
uniform vec2 uResolution;
uniform float uTime;
uniform float uHasTexture;
uniform float uMediaAspect;
uniform float uTextureZoom;
uniform vec3 uFallbackColor;

varying vec2 vUv;

float random(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 coverUv(vec2 uv) {
	float screenAspect = uResolution.x / max(uResolution.y, 1.0);
	vec2 fitted = uv;

	if (uMediaAspect > screenAspect) {
		fitted.x = (uv.x - 0.5) * (screenAspect / uMediaAspect) + 0.5;
	} else {
		fitted.y = (uv.y - 0.5) * (uMediaAspect / screenAspect) + 0.5;
	}

	return (fitted - 0.5) / max(uTextureZoom, 0.01) + 0.5;
}

void main() {
	vec2 uv = vUv;
	vec2 centered = uv * 2.0 - 1.0;
	float radius = dot(centered, centered);

	vec2 warped = centered * (1.0 + radius * 0.11);
	vec2 sampleUv = warped * 0.5 + 0.5;

	if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
		gl_FragColor = vec4(0.015, 0.012, 0.008, 1.0);
		return;
	}

	vec3 color = uFallbackColor;
	vec2 mediaUv = coverUv(sampleUv);

	if (uHasTexture > 0.5) {
		float chroma = 0.0035 + radius * 0.002;
		float red = texture2D(uTexture, clamp(mediaUv + vec2(chroma, 0.0), 0.0, 1.0)).r;
		float green = texture2D(uTexture, clamp(mediaUv, 0.0, 1.0)).g;
		float blue = texture2D(uTexture, clamp(mediaUv - vec2(chroma, 0.0), 0.0, 1.0)).b;
		color = vec3(red, green, blue);
	}

	float scanline = sin((sampleUv.y * uResolution.y * 1.35) + uTime * 18.0) * 0.04;
	float grille = sin(sampleUv.x * uResolution.x * 3.14159) * 0.025;
	float noise = random(sampleUv * uResolution.xy + uTime * 48.0) * 0.06;
	float sweepY = fract(uTime * 0.32);
	float sweepBand = smoothstep(0.07, 0.0, abs(sampleUv.y - sweepY));
	float sweepStatic = random(sampleUv * vec2(180.0, 42.0) + floor(uTime * 16.0));
	float sweepNoise = sweepBand * sweepStatic * 0.2;
	float vignette = smoothstep(1.25, 0.28, radius);
	float glow = smoothstep(0.9, 0.0, radius) * 0.14;

	color *= vec3(1.08, 0.98, 0.74);
	color += glow;
	color += noise + sweepNoise;
	color -= scanline + grille;
	color *= vignette;

	gl_FragColor = vec4(color, 1.0);
}
`;

export function initCrtViewer({ canvas, videoSrc, videoSources = [], videoZoom = 1 }: CrtViewerOptions): CrtViewerController {
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const fallbackImage = canvas.parentElement?.querySelector<HTMLImageElement>('[data-crt-fallback]');
	const sources = videoSources.length ? videoSources : videoSrc ? [{ src: videoSrc, type: 'video/mp4' }] : [];
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

	const geometry = new PlaneGeometry(4.55, 2.56, 88, 52);
	const positions = geometry.attributes.position;

	for (let index = 0; index < positions.count; index += 1) {
		const x = positions.getX(index);
		const y = positions.getY(index);
		const nx = x / 2.275;
		const ny = y / 1.28;
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
			uResolution: { value: new Vector2(1, 1) },
			uTime: { value: 0 },
			uHasTexture: { value: 0 },
			uMediaAspect: { value: 16 / 9 },
			uTextureZoom: { value: videoZoom },
			uFallbackColor: { value: new Color('#241b10') },
		},
	});

	const screen = new Mesh(geometry, material);
	scene.add(screen);

	let frameId = 0;
	let video: HTMLVideoElement | null = null;
	let activeTexture: Texture | null = null;
	let isPlaying = false;
	let isDestroyed = false;
	let isVideoReady = false;

	function setTexture(texture: Texture, mediaAspect = 16 / 9) {
		texture.minFilter = LinearFilter;
		texture.magFilter = LinearFilter;
		material.uniforms.uTexture.value = texture;
		material.uniforms.uHasTexture.value = 1;
		material.uniforms.uMediaAspect.value = mediaAspect;
		canvas.style.opacity = '1';
		if (fallbackImage) {
			fallbackImage.style.opacity = '0';
		}
		activeTexture = texture;
	}

	function showFallback(revealImage = true) {
		material.uniforms.uHasTexture.value = 0;
		canvas.style.opacity = '0';
		if (fallbackImage) {
			fallbackImage.style.opacity = revealImage ? '0.8' : '0';
		}
	}

	function getPlayableSource(targetVideo: HTMLVideoElement) {
		return sources.find((source) => !source.type || targetVideo.canPlayType(source.type)) ?? sources[0];
	}

	function createVideo() {
		if (video || !sources.length || prefersReducedMotion || isDestroyed) {
			return;
		}

		video = document.createElement('video');
		video.muted = true;
		video.loop = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.crossOrigin = 'anonymous';

		const source = getPlayableSource(video);
		if (!source?.src) {
			showFallback(true);
			return;
		}

		video.src = source.src;

		video.addEventListener('canplay', () => {
			if (!video || isDestroyed) {
				return;
			}

			isVideoReady = true;
			const mediaAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
			setTexture(new VideoTexture(video), mediaAspect);
			renderFrame(performance.now());
			if (isPlaying) {
				void video.play().catch(() => showFallback(true));
			}
		}, { once: true });

		video.addEventListener('error', () => {
			showFallback(true);
			stopRenderLoop();
		}, { once: true });
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
		frameId = isPlaying ? window.requestAnimationFrame(render) : 0;
	}

	resize();
	window.addEventListener('resize', resize);

	return {
		preload() {
			if (isDestroyed) {
				return;
			}

			if (!sources.length || prefersReducedMotion) {
				showFallback(true);
				return;
			}

			resize();
			canvas.style.opacity = '1';
			if (fallbackImage) {
				fallbackImage.style.opacity = '0';
			}
			renderFrame(performance.now());
			createVideo();
			if (video && !isVideoReady) {
				video.load();
			}
		},
		play() {
			if (isDestroyed) {
				return;
			}

			if (!sources.length || prefersReducedMotion) {
				showFallback(true);
				return;
			}

			isPlaying = true;
			resize();
			canvas.style.opacity = '1';
			if (fallbackImage) {
				fallbackImage.style.opacity = '0';
			}
			createVideo();
			startRenderLoop();

			if (video) {
				void video.play().catch(() => showFallback(true));
			}
		},
		pause() {
			if (isDestroyed) {
				return;
			}

			isPlaying = false;
			stopRenderLoop();
			video?.pause();
		},
		destroy() {
			if (isDestroyed) {
				return;
			}

			isDestroyed = true;
			isPlaying = false;
			stopRenderLoop();
			window.removeEventListener('resize', resize);
			showFallback(false);
			video?.pause();
			video?.removeAttribute('src');
			video?.load();
			activeTexture?.dispose();
			emptyTexture.dispose();
			geometry.dispose();
			material.dispose();
			renderer.dispose();
		},
	};
}
