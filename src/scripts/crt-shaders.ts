export const vertexShader = `
attribute vec3 flatPosition;
uniform float uFlattenProgress;
varying vec2 vUv;

void main() {
	vUv = uv;
	float flattenProgress = smoothstep(0.0, 1.0, uFlattenProgress);
	vec3 screenPosition = mix(position, flatPosition, flattenProgress);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(screenPosition, 1.0);
}
`;

export const fragmentShader = `
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
uniform float uFlattenProgress;
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

vec3 sampleCrt(sampler2D sourceTexture, vec2 uv, float mediaAspect, float textureZoom, float radius, float chromaBoost, float crtAmount) {
	vec2 mediaUv = coverUv(uv, mediaAspect, textureZoom);
	float chroma = (0.0035 + radius * 0.002 + chromaBoost) * crtAmount;
	float red = texture2D(sourceTexture, clamp(mediaUv + vec2(chroma, 0.0), 0.0, 1.0)).r;
	float green = texture2D(sourceTexture, clamp(mediaUv, 0.0, 1.0)).g;
	float blue = texture2D(sourceTexture, clamp(mediaUv - vec2(chroma, 0.0), 0.0, 1.0)).b;

	return vec3(red, green, blue);
}

void main() {
	vec2 uv = vUv;
	vec2 centered = uv * 2.0 - 1.0;
	float radius = dot(centered, centered);
	float flattenProgress = smoothstep(0.0, 1.0, uFlattenProgress);
	float crtAmount = 1.0 - flattenProgress;

	vec2 warped = centered * (1.0 + radius * 0.02 * crtAmount);
	vec2 sampleUv = warped * 0.5 + 0.5;

	float progress = smoothstep(0.0, 1.0, uTransitionProgress);
	float lineNoise = random(vec2(floor(sampleUv.x * 42.0), floor(uTime * 14.0)));
	float wipe = uTransitionDirection > 0.0 ? 1.0 - sampleUv.x : sampleUv.x;
	float transitionLine = progress * 1.08 - 0.04 + (lineNoise - 0.5) * 0.035;
	float mixAmount = (1.0 - smoothstep(transitionLine - 0.035, transitionLine + 0.085, wipe)) * uHasNextTexture;
	float band = smoothstep(0.11, 0.0, abs(wipe - transitionLine)) * 0.45 * crtAmount;
	float sweepBand = band;
	float sweepShift = sin(sampleUv.x * 70.0 + uTime * 18.0) * 0.0015;
	sweepShift += (lineNoise - 0.5) * 0.0015;
	float noiseCycle = floor(uTime * 0.75);
	float noiseProgress = fract(uTime * 0.75);
	float noiseCenter = 1.08 - noiseProgress * 1.16;
	float noiseBand = smoothstep(0.04, 0.0, abs(sampleUv.y - noiseCenter)) * step(0.38, random(vec2(noiseCycle, 12.0))) * crtAmount;
	vec2 distortedUv = sampleUv + vec2(sin(sampleUv.y * 18.0 + uTime * 10.0) * sweepBand * 0.001, sweepShift * sweepBand);

	vec3 color = uFallbackColor;

	if (uHasTexture > 0.5) {
		color = sampleCrt(uTexture, distortedUv, uMediaAspect, uTextureZoom, radius, band * 0.008, crtAmount);
	}

	if (uHasNextTexture > 0.5) {
		vec2 nextUv = distortedUv;
		nextUv.x += (1.0 - progress) * 0.018 * uTransitionDirection;
		vec3 nextColor = sampleCrt(uNextTexture, nextUv, uNextMediaAspect, uNextTextureZoom, radius, band * 0.006, crtAmount);
		color = mix(color, nextColor, mixAmount);
	}

	vec2 dotUv = sampleUv * uResolution.xy / 1.35;
	vec2 dotCell = floor(dotUv + vec2(uTime * 26.0, -uTime * 14.0));
	float dotShape = 1.0 - smoothstep(0.16, 0.38, length(fract(dotUv) - 0.5));
	float dotSpark = (random(dotCell + floor(uTime * 28.0)) - 0.35) * dotShape * 0.04;
	float dotRun = step(0.9, random(dotCell + vec2(19.0, 43.0))) * dotShape * 0.025;
	float noise = (dotSpark + dotRun) * crtAmount;
	float sweepStatic = random(sampleUv * vec2(42.0, 180.0) + floor(uTime * 16.0));
	float sweepNoise = sweepBand * (sweepStatic - 0.35) * 0.025;
	float bandGrain = (random(sampleUv * uResolution.xy + floor(uTime * 48.0)) - 0.35) * noiseBand * 0.06;
	float transitionDip = progress * (1.0 - progress) * 0.16;
	float glow = smoothstep(0.9, 0.0, radius) * 0.14 * crtAmount;

	color *= mix(vec3(1.0), vec3(1.08, 0.98, 0.74), crtAmount);
	color += glow;
	color += noise + sweepNoise + bandGrain;
	color -= transitionDip;

	gl_FragColor = vec4(color, 1.0);
}
`;
