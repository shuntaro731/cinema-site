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
	videoZoom?: number;
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

	vec2 warped = centered * (1.0 + radius * 0.16);
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
	float vignette = smoothstep(1.25, 0.28, radius);
	float glow = smoothstep(0.9, 0.0, radius) * 0.14;

	color *= vec3(1.08, 0.98, 0.74);
	color += glow;
	color += noise;
	color -= scanline + grille;
	color *= vignette;

	gl_FragColor = vec4(color, 1.0);
}
`;

export function initCrtViewer({ canvas, videoSrc, videoZoom = 1 }: CrtViewerOptions) {
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const fallbackImage = canvas.parentElement?.querySelector<HTMLImageElement>('[data-crt-fallback]');
	const scene = new Scene();
	const camera = new PerspectiveCamera(35, 16 / 9, 0.1, 100);
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
		positions.setZ(index, -edge * 0.24);
	}

	positions.needsUpdate = true;
	geometry.computeVertexNormals();

	const material = new ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			uTexture: { value: new Texture() },
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

	function showFallback() {
		canvas.style.opacity = '0';
		if (fallbackImage) {
			fallbackImage.style.opacity = '';
		}
	}

	if (videoSrc && !prefersReducedMotion) {
		video = document.createElement('video');
		video.src = videoSrc;
		video.muted = true;
		video.loop = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.crossOrigin = 'anonymous';

		video.addEventListener('canplay', () => {
			if (!video) {
				return;
			}

			const mediaAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
			setTexture(new VideoTexture(video), mediaAspect);
			void video.play().catch(showFallback);
		}, { once: true });

		video.addEventListener('error', showFallback, { once: true });
		void video.play().catch(showFallback);
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

	function render(time: number) {
		material.uniforms.uTime.value = time * 0.001;
		screen.rotation.x = Math.sin(time * 0.00035) * 0.012;
		screen.rotation.y = Math.cos(time * 0.00028) * 0.018;
		renderer.render(scene, camera);
		frameId = window.requestAnimationFrame(render);
	}

	resize();
	window.addEventListener('resize', resize);
	frameId = window.requestAnimationFrame(render);

	return () => {
		window.cancelAnimationFrame(frameId);
		window.removeEventListener('resize', resize);
		video?.pause();
		activeTexture?.dispose();
		geometry.dispose();
		material.dispose();
		renderer.dispose();
	};
}
