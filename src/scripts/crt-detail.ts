type CrtDetailControllerOptions = {
	root: HTMLElement;
	originalTitle: string;
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

export function initCrtDetailController({ root, originalTitle }: CrtDetailControllerOptions) {
	const header = root.querySelector<HTMLElement>('[data-crt-header]');
	const detailRoot = root.querySelector<HTMLElement>('[data-crt-detail]');
	const backButton = detailRoot?.querySelector<HTMLButtonElement>('[data-crt-detail-back]') ?? null;
	const panels = Array.from(detailRoot?.querySelectorAll<HTMLElement>('[data-crt-detail-panel]') ?? []);
	let isOpen = false;
	let activeMovieId: number | null = null;

	function setHeaderHidden(isHidden: boolean) {
		if (!header) {
			return;
		}

		header.classList.remove('crt-header-blur-fade-in', 'crt-header-blur-fade-out');
		header.classList.toggle('hidden', isHidden);
		setElementInert(header, isHidden);
	}

	function fadeOutHeader() {
		if (!header) {
			return;
		}

		header.classList.remove('hidden');
		header.classList.remove('crt-header-blur-fade-in');
		header.classList.add('crt-header-blur-fade-out');
		setElementInert(header, true);
	}

	function fadeInHeader() {
		if (!header) {
			return;
		}

		header.classList.remove('hidden');
		header.classList.remove('crt-header-blur-fade-out');
		header.classList.add('crt-header-blur-fade-in');
		setElementInert(header, false);
	}

	function getPanel(movieId: number) {
		return panels.find((panel) => Number(panel.dataset.movieId) === movieId);
	}

	function getTitle(movieId: number) {
		const panel = getPanel(movieId);
		const title = panel?.querySelector('h1')?.textContent?.trim();

		return title || originalTitle;
	}

	function show(movieId: number) {
		const activePanel = getPanel(movieId);
		if (!detailRoot || !activePanel) {
			return false;
		}

		detailRoot.classList.remove('hidden');
		detailRoot.setAttribute('aria-hidden', 'false');
		setElementInert(detailRoot, false);
		setHeaderHidden(true);
		panels.forEach((panel) => {
			const isActive = panel === activePanel;
			panel.classList.toggle('hidden', !isActive);
			panel.classList.toggle('flex', isActive);
			panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
			setElementInert(panel, !isActive);
		});
		document.title = `${getTitle(movieId)} | TOHO CINEMA`;
		activeMovieId = movieId;
		isOpen = true;
		backButton?.focus();

		return true;
	}

	function hide() {
		if (!detailRoot) {
			return;
		}

		detailRoot.classList.add('hidden');
		detailRoot.setAttribute('aria-hidden', 'true');
		setElementInert(detailRoot, true);
		fadeInHeader();
		panels.forEach((panel) => {
			panel.classList.add('hidden');
			panel.classList.remove('flex');
			panel.setAttribute('aria-hidden', 'true');
			setElementInert(panel, true);
		});
		document.title = originalTitle;
		activeMovieId = null;
		isOpen = false;
	}

	return {
		root: detailRoot,
		backButton,
		hasPanel(movieId: number) {
			return Boolean(getPanel(movieId));
		},
		getActiveMovieId() {
			return activeMovieId;
		},
		isOpen() {
			return isOpen;
		},
		fadeOutHeader,
		show,
		hide,
	};
}
