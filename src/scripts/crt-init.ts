import { initCrtDetailController } from './crt-detail';
import { initCrtInput } from './crt-input';
import { SELECTORS } from './crt-selectors';
import { initCrtTransitionController } from './crt-transition';
import { initCrtViewer } from './crt-viewer';
import type { MovieVideo } from '../types/video';

export function initCrtViewerPage() {
	const root = document.querySelector<HTMLElement>(SELECTORS.crtRoot);
	const canvas = root?.querySelector<HTMLCanvasElement>(SELECTORS.crtCanvas);
	const screen = root?.querySelector<HTMLElement>(SELECTORS.crtScreen);
	const navDots = Array.from(root?.querySelectorAll<HTMLButtonElement>(SELECTORS.crtNavDot) ?? []);
	const navProgressBars = navDots.map((dot) => dot.querySelector<HTMLElement>(SELECTORS.crtNavProgress));

	if (!root || !canvas || root.dataset.crtReady === 'true') {
		return;
	}

	root.dataset.crtReady = 'true';
	screen?.setAttribute('tabindex', screen.getAttribute('tabindex') ?? '0');

	let movies: MovieVideo[] = [];
	try {
		movies = JSON.parse(canvas.dataset.movies || '[]') as MovieVideo[];
	} catch {
		movies = [];
	}

	const originalTitle = document.title;
	const detail = initCrtDetailController({ root, originalTitle });
	const transition = initCrtTransitionController(screen);
	const viewer = initCrtViewer({
		canvas,
		movies,
		onChange: updateNav,
		onProgress: updateNavProgress,
	});
	const input = initCrtInput({
		root,
		navDots,
		getIndex: viewer.getIndex,
		switchBy: viewer.switchBy,
		switchTo: viewer.switchTo,
	});
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const transitionDuration = prefersReducedMotion ? 120 : 600;
	const detailTextureZoom = 1.18;
	let isDetailTransitioning = false;
	let pendingDetailMovieId: number | null = null;
	let detailFrameId = 0;

	function updateNav(activeIndex: number) {
		navDots.forEach((dot, index) => {
			const isActive = index === activeIndex;
			const progressBar = navProgressBars[index];

			dot.dataset.active = isActive ? 'true' : 'false';
			dot.setAttribute('aria-current', isActive ? 'true' : 'false');
			if (progressBar) {
				progressBar.dataset.active = isActive ? 'true' : 'false';
				progressBar.style.width = isActive ? progressBar.style.width : '0%';
			}
		});

		const activeMovieId = movies[activeIndex]?.id;
		if (pendingDetailMovieId && activeMovieId === pendingDetailMovieId) {
			const movieId = pendingDetailMovieId;
			pendingDetailMovieId = null;
			window.setTimeout(() => {
				void enterDetail(movieId);
			}, 0);
		}
	}

	function updateNavProgress(activeIndex: number, progress: number) {
		const progressBar = navProgressBars[activeIndex];
		const percentage = Math.min(Math.max(progress, 0), 1) * 100;

		if (progressBar) {
			progressBar.style.width = `${percentage}%`;
		}
	}

	function getMovieIndexById(movieId: number) {
		return movies.findIndex((movie) => movie.id === movieId);
	}

	async function enterDetail(movieId: number) {
		if (isDetailTransitioning || viewer.isBusy()) {
			return;
		}

		const movieIndex = getMovieIndexById(movieId);
		if (movieIndex < 0 || !detail.root || !screen || !detail.hasPanel(movieId)) {
			return;
		}

		const currentMovieId = movies[viewer.getIndex()]?.id;
		if (currentMovieId !== movieId) {
			if (viewer.switchTo(movieIndex)) {
				pendingDetailMovieId = movieId;
			}
			return;
		}

		isDetailTransitioning = true;
		viewer.setAutoAdvance(false);
		input.setDisabled(true);
		detail.fadeOutHeader();
		transition.saveCurrentStyles();
		transition.fadeOverlays(transitionDuration);
		transition.expandScreen(transitionDuration);
		void viewer.setTextureZoom(detailTextureZoom, transitionDuration);

		await viewer.flatten(transitionDuration);
		if (!isDetailTransitioning) {
			return;
		}

		detailFrameId = window.requestAnimationFrame(() => {
			if (!isDetailTransitioning) {
				return;
			}

			detail.show(movieId);
			isDetailTransitioning = false;
		});
	}

	async function exitDetail() {
		if (isDetailTransitioning || (!detail.isOpen() && !detail.getActiveMovieId())) {
			return;
		}

		isDetailTransitioning = true;
		input.setDisabled(true);
		detail.hide();
		transition.restoreOverlays();
		transition.restoreScreenStyle(transitionDuration);
		void viewer.restoreTextureZoom(transitionDuration);
		await viewer.unflatten(transitionDuration);
		viewer.setAutoAdvance(true);

		detailFrameId = window.requestAnimationFrame(() => {
			isDetailTransitioning = false;
			input.setDisabled(false);
			screen?.focus();
		});
	}

	function handleScreenClick() {
		if (detail.isOpen() || isDetailTransitioning || viewer.isBusy()) {
			return;
		}

		const movie = movies[viewer.getIndex()];
		if (!movie?.id) {
			return;
		}

		void enterDetail(movie.id);
	}

	function handleDetailBackClick() {
		void exitDetail();
	}

	screen?.addEventListener('click', handleScreenClick);
	detail.backButton?.addEventListener('click', handleDetailBackClick);

	viewer.play();

	document.addEventListener('astro:before-swap', () => {
		isDetailTransitioning = false;
		pendingDetailMovieId = null;
		window.cancelAnimationFrame(detailFrameId);
		screen?.removeEventListener('click', handleScreenClick);
		detail.backButton?.removeEventListener('click', handleDetailBackClick);
		transition.dispose();
		input.dispose();
		viewer.destroy();
	}, { once: true });
}
