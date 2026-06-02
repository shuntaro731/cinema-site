import { initCrtInput } from './crt-input';
import { initCrtViewer, type MovieVideo } from './crt-viewer';

type DetailState = {
	fromCrt?: boolean;
	fromCrtHome?: boolean;
	movieId?: number;
};

const screenStyleKeys = [
	'zIndex',
	'borderRadius',
	'boxShadow',
	'transitionDuration',
	'transformOrigin',
	'transform',
] as const;

type ScreenStyleKey = typeof screenStyleKeys[number];
type ScreenStyleSnapshot = Record<ScreenStyleKey, string>;

type OverlayStyleSnapshot = {
	opacity: string;
	transitionDuration: string;
};

function setElementInert(element: HTMLElement, isInert: boolean) {
	if ('inert' in element) {
		element.inert = isInert;
		return;
	}

	if (isInert) {
		element.setAttribute('inert', '');
		return;
	}

	element.removeAttribute('inert');
}

export function initCrtViewerPage() {
	const root = document.querySelector<HTMLElement>('[data-crt-root]');
	const canvas = root?.querySelector<HTMLCanvasElement>('[data-crt-canvas]');
	const screen = root?.querySelector<HTMLElement>('[data-crt-screen]');
	const detailRoot = root?.querySelector<HTMLElement>('[data-crt-detail]');
	const detailBack = detailRoot?.querySelector<HTMLButtonElement>('[data-crt-detail-back]');
	const detailPanels = Array.from(detailRoot?.querySelectorAll<HTMLElement>('[data-crt-detail-panel]') ?? []);
	const navDots = Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-crt-nav-dot]') ?? []);
	const navProgressBars = navDots.map((dot) => dot.querySelector<HTMLElement>('[data-crt-nav-progress]'));
	const screenOverlays = Array.from(screen?.querySelectorAll<HTMLElement>('[data-crt-overlay]') ?? []);

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
	let isDetailOpen = false;
	let isDetailTransitioning = false;
	let activeDetailMovieId: number | null = null;
	let pendingDetailMovieId: number | null = null;
	let savedScreenStyle: ScreenStyleSnapshot | null = null;
	let savedOverlayStyles: OverlayStyleSnapshot[] = [];
	let detailFrameId = 0;
	let styleRestoreTimer = 0;

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

	function getMovieTitle(movieId: number) {
		const panel = getDetailPanel(movieId);
		const title = panel?.querySelector('h1')?.textContent?.trim();

		return title || originalTitle;
	}

	function getDetailPanel(movieId: number) {
		return detailPanels.find((panel) => Number(panel.dataset.movieId) === movieId);
	}

	function captureScreenStyle() {
		if (!screen) {
			return null;
		}

		return screenStyleKeys.reduce((snapshot, key) => {
			snapshot[key] = screen.style[key];
			return snapshot;
		}, {} as ScreenStyleSnapshot);
	}

	function captureOverlayStyles() {
		return screenOverlays.map((overlay) => ({
			opacity: overlay.style.opacity,
			transitionDuration: overlay.style.transitionDuration,
		}));
	}

	function saveCurrentStyles() {
		if (!savedScreenStyle) {
			savedScreenStyle = captureScreenStyle();
		}

		if (!savedOverlayStyles.length) {
			savedOverlayStyles = captureOverlayStyles();
		}
	}

	function expandScreen(duration: number) {
		if (!screen) {
			return;
		}

		const rect = screen.getBoundingClientRect();
		const width = Math.max(rect.width, 1);
		const height = Math.max(rect.height, 1);
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const scale = Math.max(viewportWidth / width, viewportHeight / height);
		const translateX = viewportWidth / 2 - (rect.left + width / 2);
		const translateY = viewportHeight / 2 - (rect.top + height / 2);

		screen.style.zIndex = '50';
		screen.style.borderRadius = '0';
		screen.style.boxShadow = 'none';
		screen.style.transitionDuration = `${duration}ms`;
		screen.style.transformOrigin = 'center center';
		screen.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
	}

	function restoreScreenStyle(duration: number) {
		if (!screen || !savedScreenStyle) {
			return;
		}

		window.clearTimeout(styleRestoreTimer);
		screen.style.transitionDuration = `${duration}ms`;
		screenStyleKeys.forEach((key) => {
			if (key !== 'transitionDuration') {
				screen.style[key] = savedScreenStyle?.[key] ?? '';
			}
		});
		styleRestoreTimer = window.setTimeout(() => {
			if (screen && savedScreenStyle) {
				screen.style.transitionDuration = savedScreenStyle.transitionDuration;
			}
		}, duration);
	}

	function fadeOverlays(duration: number) {
		screenOverlays.forEach((overlay) => {
			overlay.style.transitionDuration = `${Math.min(300, duration)}ms`;
			overlay.style.opacity = '0';
		});
	}

	function restoreOverlays() {
		screenOverlays.forEach((overlay, index) => {
			const snapshot = savedOverlayStyles[index];
			if (!snapshot) {
				return;
			}

			overlay.style.opacity = snapshot.opacity;
			overlay.style.transitionDuration = snapshot.transitionDuration;
		});
	}

	function showDetailPanel(movieId: number) {
		const activePanel = getDetailPanel(movieId);
		if (!detailRoot || !activePanel) {
			return false;
		}

		detailRoot.classList.remove('hidden');
		detailRoot.setAttribute('aria-hidden', 'false');
		setElementInert(detailRoot, false);
		detailPanels.forEach((panel) => {
			const isActive = panel === activePanel;
			panel.classList.toggle('hidden', !isActive);
			panel.classList.toggle('flex', isActive);
			panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
			setElementInert(panel, !isActive);
		});
		document.title = `${getMovieTitle(movieId)} | TOHO CINEMA`;
		activeDetailMovieId = movieId;
		isDetailOpen = true;
		detailBack?.focus();

		return true;
	}

	function hideDetailPanels() {
		if (!detailRoot) {
			return;
		}

		detailRoot.classList.add('hidden');
		detailRoot.setAttribute('aria-hidden', 'true');
		setElementInert(detailRoot, true);
		detailPanels.forEach((panel) => {
			panel.classList.add('hidden');
			panel.classList.remove('flex');
			panel.setAttribute('aria-hidden', 'true');
			setElementInert(panel, true);
		});
		document.title = originalTitle;
		activeDetailMovieId = null;
		isDetailOpen = false;
	}

	async function enterDetail(movieId: number, { pushState }: { pushState: boolean }) {
		if (isDetailTransitioning || viewer.isBusy()) {
			return;
		}

		const movieIndex = getMovieIndexById(movieId);
		if (movieIndex < 0 || !detailRoot || !screen) {
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
		input.setDisabled(true);
		saveCurrentStyles();
		fadeOverlays(transitionDuration);
		expandScreen(transitionDuration);

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
			showDetailPanel(movieId);
			isDetailTransitioning = false;
		});
	}

	async function exitDetail() {
		if (isDetailTransitioning || (!isDetailOpen && !activeDetailMovieId)) {
			return;
		}

		isDetailTransitioning = true;
		input.setDisabled(true);
		hideDetailPanels();
		restoreOverlays();
		restoreScreenStyle(transitionDuration);
		await viewer.unflatten(transitionDuration);

		detailFrameId = window.requestAnimationFrame(() => {
			isDetailTransitioning = false;
			input.setDisabled(false);
			screen?.focus();
		});
	}

	function handleScreenClick() {
		if (isDetailOpen || isDetailTransitioning || viewer.isBusy()) {
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
	detailBack?.addEventListener('click', handleDetailBackClick);
	window.addEventListener('popstate', handlePopState);

	viewer.play();

	document.addEventListener('astro:before-swap', () => {
		isDetailTransitioning = false;
		pendingDetailMovieId = null;
		window.cancelAnimationFrame(detailFrameId);
		window.clearTimeout(styleRestoreTimer);
		screen?.removeEventListener('click', handleScreenClick);
		detailBack?.removeEventListener('click', handleDetailBackClick);
		window.removeEventListener('popstate', handlePopState);
		input.dispose();
		viewer.destroy();
	}, { once: true });
}
