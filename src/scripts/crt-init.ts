import { initCrtInput } from './crt-input';
import { initCrtViewer, type MovieVideo } from './crt-viewer';

export function initCrtViewerPage() {
	const root = document.querySelector<HTMLElement>('[data-crt-root]');
	const canvas = root?.querySelector<HTMLCanvasElement>('[data-crt-canvas]');
	const screen = root?.querySelector<HTMLElement>('[data-crt-screen]');
	const navDots = Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-crt-nav-dot]') ?? []);
	const navProgressBars = navDots.map((dot) => dot.querySelector<HTMLElement>('[data-crt-nav-progress]'));
	const screenOverlays = Array.from(screen?.querySelectorAll<HTMLElement>('[data-crt-overlay]') ?? []);

	if (!root || !canvas || root.dataset.crtReady === 'true') {
		return;
	}

	root.dataset.crtReady = 'true';
	let movies: MovieVideo[] = [];
	try {
		movies = JSON.parse(canvas.dataset.movies || '[]') as MovieVideo[];
	} catch {
		movies = [];
	}
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
		onMovieMove: resetNavProgress,
	});
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let isNavigating = false;
	let expandTimer = 0;
	let navigateTimer = 0;

	function updateNav(activeIndex: number) {
		navDots.forEach((dot, index) => {
			const isActive = index === activeIndex;
			const progressBar = navProgressBars[index];

			dot.dataset.active = isActive ? 'true' : 'false';
			dot.setAttribute('aria-current', isActive ? 'true' : 'false');
			if (progressBar) {
				progressBar.dataset.active = isActive ? 'true' : 'false';
				progressBar.style.width = '0%';
			}
		});
	}

	function updateNavProgress(activeIndex: number, progress: number) {
		const progressBar = navProgressBars[activeIndex];
		const percentage = Math.min(Math.max(progress, 0), 1) * 100;

		if (progressBar) {
			progressBar.style.width = `${percentage}%`;
		}
	}

	function resetNavProgress() {
		navProgressBars.forEach((progressBar) => {
			if (progressBar) {
				progressBar.style.width = '0%';
			}
		});
	}

	function expandScreen() {
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
		screen.style.transformOrigin = 'center center';
		screen.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
	}

	function handleScreenClick() {
		if (isNavigating) {
			return;
		}

		const movie = movies[viewer.getIndex()];
		if (!movie?.id) {
			return;
		}

		isNavigating = true;
		screenOverlays.forEach((overlay) => {
			overlay.style.opacity = '0';
		});

		const flattenDuration = prefersReducedMotion ? 80 : 400;
		const expandDelay = prefersReducedMotion ? 40 : 300;
		const navigateDelay = prefersReducedMotion ? 120 : 600;

		void viewer.flatten(flattenDuration);
		expandTimer = window.setTimeout(expandScreen, expandDelay);
		navigateTimer = window.setTimeout(() => {
			window.location.href = `/movies/${movie.id}`;
		}, navigateDelay);
	}

	screen?.addEventListener('click', handleScreenClick);

	viewer.play();

	document.addEventListener('astro:before-swap', () => {
		window.clearTimeout(expandTimer);
		window.clearTimeout(navigateTimer);
		screen?.removeEventListener('click', handleScreenClick);
		input.dispose();
		viewer.destroy();
	}, { once: true });
}
