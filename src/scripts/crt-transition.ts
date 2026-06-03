import { SELECTORS } from './crt-selectors';

type ScreenStyleSnapshot = {
	zIndex: string;
	borderRadius: string;
	boxShadow: string;
	transitionDuration: string;
	transformOrigin: string;
	transform: string;
};

type OverlayStyleSnapshot = {
	opacity: string;
	transitionDuration: string;
};

function captureScreenStyle(screen: HTMLElement): ScreenStyleSnapshot {
	return {
		zIndex: screen.style.zIndex,
		borderRadius: screen.style.borderRadius,
		boxShadow: screen.style.boxShadow,
		transitionDuration: screen.style.transitionDuration,
		transformOrigin: screen.style.transformOrigin,
		transform: screen.style.transform,
	};
}

function captureOverlayStyles(overlays: HTMLElement[]) {
	return overlays.map((overlay) => ({
		opacity: overlay.style.opacity,
		transitionDuration: overlay.style.transitionDuration,
	}));
}

export function initCrtTransitionController(screen: HTMLElement | null) {
	const overlays = Array.from(screen?.querySelectorAll<HTMLElement>(SELECTORS.crtOverlay) ?? []);
	let savedScreenStyle: ScreenStyleSnapshot | null = null;
	let savedOverlayStyles: OverlayStyleSnapshot[] = [];
	let styleRestoreTimer = 0;

	function saveCurrentStyles() {
		if (screen && !savedScreenStyle) {
			savedScreenStyle = captureScreenStyle(screen);
		}

		if (!savedOverlayStyles.length) {
			savedOverlayStyles = captureOverlayStyles(overlays);
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
		screen.style.zIndex = savedScreenStyle.zIndex;
		screen.style.borderRadius = savedScreenStyle.borderRadius;
		screen.style.boxShadow = savedScreenStyle.boxShadow;
		screen.style.transformOrigin = savedScreenStyle.transformOrigin;
		screen.style.transform = savedScreenStyle.transform;
		styleRestoreTimer = window.setTimeout(() => {
			if (screen && savedScreenStyle) {
				screen.style.transitionDuration = savedScreenStyle.transitionDuration;
			}
		}, duration);
	}

	function fadeOverlays(duration: number) {
		overlays.forEach((overlay) => {
			overlay.style.transitionDuration = `${Math.min(300, duration)}ms`;
			overlay.style.opacity = '0';
		});
	}

	function restoreOverlays() {
		overlays.forEach((overlay, index) => {
			const snapshot = savedOverlayStyles[index];
			if (!snapshot) {
				return;
			}

			overlay.style.opacity = snapshot.opacity;
			overlay.style.transitionDuration = snapshot.transitionDuration;
		});
	}

	return {
		saveCurrentStyles,
		expandScreen,
		restoreScreenStyle,
		fadeOverlays,
		restoreOverlays,
		dispose() {
			window.clearTimeout(styleRestoreTimer);
		},
	};
}
