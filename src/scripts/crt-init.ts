import { initCrtDetailController } from './crt-detail';
import { initCrtInput } from './crt-input';
import { initCrtTransitionController } from './crt-transition';
import { initCrtViewer, type MovieVideo } from './crt-viewer';

type DetailState = {
	fromCrt?: boolean;
	fromCrtHome?: boolean;
	movieId?: number;
};

export function initCrtViewerPage() {
	const root = document.querySelector<HTMLElement>('[data-crt-root]');
	const canvas = root?.querySelector<HTMLCanvasElement>('[data-crt-canvas]');
	const screen = root?.querySelector<HTMLElement>('[data-crt-screen]');
	const navDots = Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-crt-nav-dot]') ?? []);
	const navProgressBars = navDots.map((dot) => dot.querySelector<HTMLElement>('[data-crt-nav-progress]'));

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
	let isDetailTransitioning = false;
	let pendingDetailMovieId: number | null = null;
	let detailFrameId = 0;

	if (window.location.pathname === '/') {
		window.history.replaceState({ fromCrtHome: true } satisfies DetailState, '', window.location.href);
	}

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
				void enterDetail(movieId, { pushState: false });
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

	async function enterDetail(movieId: number, { pushState }: { pushState: boolean }) {
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
		transition.saveCurrentStyles();
		transition.fadeOverlays(transitionDuration);
		transition.expandScreen(transitionDuration);

		await viewer.flatten(transitionDuration);
		if (!isDetailTransitioning) {
			return;
		}

		detailFrameId = window.requestAnimationFrame(() => {
			if (!isDetailTransitioning) {
				return;
			}

			if (pushState) {
				window.history.pushState({ fromCrt: true, movieId } satisfies DetailState, '', `/movies/${movieId}`);
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

		void enterDetail(movie.id, { pushState: true });
	}

	function handleDetailBackClick() {
		const state = window.history.state as DetailState | null;
		if (state?.fromCrt) {
			window.history.back();
			return;
		}

		void exitDetail();
	}

	function handlePopState(event: PopStateEvent) {
		const state = event.state as DetailState | null;
		if (state?.fromCrt && Number.isFinite(state.movieId)) {
			void enterDetail(Number(state.movieId), { pushState: false });
			return;
		}

		void exitDetail();
	}

	screen?.addEventListener('click', handleScreenClick);
	detail.backButton?.addEventListener('click', handleDetailBackClick);
	window.addEventListener('popstate', handlePopState);

	viewer.play();

	document.addEventListener('astro:before-swap', () => {
		isDetailTransitioning = false;
		pendingDetailMovieId = null;
		window.cancelAnimationFrame(detailFrameId);
		screen?.removeEventListener('click', handleScreenClick);
		detail.backButton?.removeEventListener('click', handleDetailBackClick);
		window.removeEventListener('popstate', handlePopState);
		transition.dispose();
		input.dispose();
		viewer.destroy();
	}, { once: true });
}
