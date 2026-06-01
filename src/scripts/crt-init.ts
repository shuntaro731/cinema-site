import { initCrtInput } from './crt-input';
import { initCrtViewer, type MovieVideo } from './crt-viewer';

export function initCrtViewerPage() {
	const root = document.querySelector<HTMLElement>('[data-crt-root]');
	const canvas = root?.querySelector<HTMLCanvasElement>('[data-crt-canvas]');
	const navDots = Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-crt-nav-dot]') ?? []);
	const navProgressBars = navDots.map((dot) => dot.querySelector<HTMLElement>('[data-crt-nav-progress]'));

	if (!root || !canvas || root.dataset.crtReady === 'true') {
		return;
	}

	root.dataset.crtReady = 'true';
	const movies = JSON.parse(canvas.dataset.movies || '[]') as MovieVideo[];
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

	viewer.play();

	document.addEventListener('astro:before-swap', () => {
		input.dispose();
		viewer.destroy();
	}, { once: true });
}
