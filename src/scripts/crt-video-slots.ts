import { LinearFilter, VideoTexture } from 'three';
import type { MovieVideo, VideoSource } from '../types/video';

export type VideoSlot = {
	video: HTMLVideoElement;
	texture: VideoTexture | null;
	aspect: number;
	zoom: number;
	ready: Promise<VideoSlot>;
};

type VideoSlotManagerOptions = {
	movies: MovieVideo[];
	isDestroyed: () => boolean;
	onEnded: (index: number) => void;
};

function getPlayableSource(targetVideo: HTMLVideoElement, sources: VideoSource[]) {
	return sources.find((source) => !source.type || targetVideo.canPlayType(source.type)) ?? sources[0];
}

export class VideoSlotManager {
	private readonly slots = new Map<number, VideoSlot>();
	private readonly movies: MovieVideo[];
	private readonly isDestroyed: () => boolean;
	private readonly onEnded: (index: number) => void;

	constructor({ movies, isDestroyed, onEnded }: VideoSlotManagerOptions) {
		this.movies = movies;
		this.isDestroyed = isDestroyed;
		this.onEnded = onEnded;
	}

	get(index: number) {
		if (!this.movies.length) {
			return undefined;
		}

		return this.slots.get(this.normalizeIndex(index));
	}

	prepare(index: number) {
		const normalizedIndex = this.normalizeIndex(index);
		const existingSlot = this.slots.get(normalizedIndex);

		if (existingSlot) {
			return existingSlot;
		}

		const movie = this.movies[normalizedIndex];
		const sources = movie?.sources ?? [];
		const video = document.createElement('video');
		const slot: VideoSlot = {
			video,
			texture: null,
			aspect: 16 / 9,
			zoom: movie?.zoom ?? 1.02,
			ready: Promise.resolve(null as unknown as VideoSlot),
		};

		video.muted = true;
		video.loop = false;
		video.playsInline = true;
		video.preload = 'auto';
		video.crossOrigin = 'anonymous';
		video.addEventListener('ended', () => this.onEnded(normalizedIndex));

		slot.ready = new Promise<VideoSlot>((resolve, reject) => {
			const source = getPlayableSource(video, sources);

			if (!source?.src) {
				reject(new Error('No playable video source.'));
				return;
			}

			video.addEventListener('canplay', () => {
				if (this.isDestroyed()) {
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

		this.slots.set(normalizedIndex, slot);
		return slot;
	}

	reset(slot: VideoSlot) {
		if (Number.isFinite(slot.video.duration) && slot.video.currentTime > 0) {
			try {
				slot.video.currentTime = 0;
			} catch {
				// 読み込み直後にcurrentTimeを触れないブラウザでは、そのまま再生する
			}
		}
	}

	pauseInactive(currentIndex: number) {
		this.slots.forEach((slot, index) => {
			if (index !== currentIndex) {
				slot.video.pause();
			}
		});
	}

	pauseAll() {
		this.slots.forEach((slot) => slot.video.pause());
	}

	dispose() {
		this.slots.forEach((slot) => {
			slot.video.pause();
			slot.video.removeAttribute('src');
			slot.video.load();
			slot.texture?.dispose();
		});
		this.slots.clear();
	}

	private normalizeIndex(index: number) {
		const total = this.movies.length;

		return total ? ((index % total) + total) % total : 0;
	}
}
