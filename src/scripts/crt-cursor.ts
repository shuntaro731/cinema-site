type CrtCursorOptions = {
	root: HTMLElement;
	hoverTarget: HTMLElement | null;
	canActivate: () => boolean;
	canShow: () => boolean;
};

const ringEase = 0.22;
const scaleEase = 0.2;
const positionRestThreshold = 0.1;
const scaleRestThreshold = 0.01;

function lerp(current: number, target: number, amount: number) {
	return current + (target - current) * amount;
}

export function initCrtCursor({ root, hoverTarget, canActivate, canShow }: CrtCursorOptions) {
	const cursor = root.querySelector<HTMLElement>('[data-crt-cursor]');
	const ring = cursor?.querySelector<HTMLElement>('.crt-cursor-ring');
	const label = cursor?.querySelector<HTMLElement>('[data-crt-cursor-label]');

	if (!cursor || !ring) {
		return {
			hide() {},
			setActive(_isActive: boolean) {},
			dispose() {},
		};
	}

	let targetX = -100;
	let targetY = -100;
	let ringX = targetX;
	let ringY = targetY;
	let targetScale = 1;
	let scale = targetScale;
	let hasPointer = false;
	let isActive = false;
	let frameId = 0;

	function isSettled() {
		return (
			Math.abs(ringX - targetX) < positionRestThreshold &&
			Math.abs(ringY - targetY) < positionRestThreshold &&
			Math.abs(scale - targetScale) < scaleRestThreshold
		);
	}

	function setRingTransform() {
		ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${scale})`;
		if (label) {
			label.style.transform = `scale(${1 / Math.max(scale, 1)})`;
		}
	}

	function render() {
		ringX = lerp(ringX, targetX, ringEase);
		ringY = lerp(ringY, targetY, ringEase);
		scale = lerp(scale, targetScale, scaleEase);
		setRingTransform();
		if (isSettled()) {
			ringX = targetX;
			ringY = targetY;
			scale = targetScale;
			setRingTransform();
			frameId = 0;
			return;
		}

		frameId = window.requestAnimationFrame(render);
	}

	function start() {
		if (!frameId) {
			frameId = window.requestAnimationFrame(render);
		}
	}

	function hide() {
		setActive(false);
		cursor.dataset.visible = 'false';
	}

	function setActive(active: boolean) {
		const shouldActivate = active && canActivate() && canShow();
		isActive = shouldActivate;
		targetScale = shouldActivate ? 4 : 1;
		cursor.dataset.active = shouldActivate ? 'true' : 'false';
		cursor.dataset.visible = shouldActivate ? 'true' : 'false';
		start();
	}

	function moveTo(event: MouseEvent) {
		targetX = event.clientX;
		targetY = event.clientY;
		if (hasPointer) {
			return;
		}

		ringX = targetX;
		ringY = targetY;
		hasPointer = true;
		setRingTransform();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!canShow()) {
			hide();
			return;
		}

		moveTo(event);
		if (isActive) {
			start();
		}
	}

	function handleMouseEnterTarget(event: MouseEvent) {
		moveTo(event);
		setActive(true);
	}

	function handleMouseLeaveTarget() {
		setActive(false);
	}

	document.addEventListener('mousemove', handleMouseMove);
	document.addEventListener('mouseleave', hide);
	window.addEventListener('blur', hide);
	hoverTarget?.addEventListener('mouseenter', handleMouseEnterTarget);
	hoverTarget?.addEventListener('mouseleave', handleMouseLeaveTarget);

	return {
		hide,
		setActive,
		dispose() {
			window.cancelAnimationFrame(frameId);
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseleave', hide);
			window.removeEventListener('blur', hide);
			hoverTarget?.removeEventListener('mouseenter', handleMouseEnterTarget);
			hoverTarget?.removeEventListener('mouseleave', handleMouseLeaveTarget);
		},
	};
}
