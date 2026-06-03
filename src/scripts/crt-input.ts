type CrtInputOptions = {
	root: HTMLElement;
	navDots: HTMLButtonElement[];
	getIndex: () => number;
	switchBy: (direction: number) => boolean;
	switchTo: (index: number) => boolean;
};

export function initCrtInput({ root, navDots, getIndex, switchBy, switchTo }: CrtInputOptions) {
	const wheelThreshold = 36;
	const inputLockMs = 460;
	const wheelQuietMs = 320;

	let wheelDelta = 0;
	let isInputLocked = false;
	let isWheelGestureLocked = false;
	let isDisabled = false;
	let touchStartY = 0;
	let wheelResetTimer = 0;
	let inputUnlockTimer = 0;
	let wheelGestureUnlockTimer = 0;

	function scheduleWheelGestureUnlock() {
		window.clearTimeout(wheelGestureUnlockTimer);
		wheelGestureUnlockTimer = window.setTimeout(() => {
			isWheelGestureLocked = false;
			wheelDelta = 0;
		}, wheelQuietMs);
	}

	function lockWheelGestureUntilQuiet() {
		isWheelGestureLocked = true;
		scheduleWheelGestureUnlock();
	}

	function unlockInput() {
		window.clearTimeout(inputUnlockTimer);
		inputUnlockTimer = window.setTimeout(() => {
			isInputLocked = false;
			wheelDelta = 0;
		}, inputLockMs);
	}

	function requestMovieMove(direction: number, lockWheelGesture = false) {
		if (isDisabled || isInputLocked) {
			return;
		}

		isInputLocked = true;
		wheelDelta = 0;
		if (switchBy(direction)) {
			if (lockWheelGesture) {
				lockWheelGestureUntilQuiet();
			}
			unlockInput();
			return;
		}

		isInputLocked = false;
	}

	function onWheel(event: WheelEvent) {
		if (isDisabled) {
			wheelDelta = 0;
			return;
		}

		event.preventDefault();

		if (isInputLocked || isWheelGestureLocked) {
			wheelDelta = 0;
			lockWheelGestureUntilQuiet();
			return;
		}

		wheelDelta += event.deltaY;

		if (Math.abs(wheelDelta) < wheelThreshold) {
			window.clearTimeout(wheelResetTimer);
			wheelResetTimer = window.setTimeout(() => {
				wheelDelta = 0;
			}, 140);
			return;
		}

		requestMovieMove(wheelDelta > 0 ? 1 : -1, true);
	}

	function onTouchStart(event: TouchEvent) {
		if (isDisabled) {
			touchStartY = 0;
			return;
		}

		touchStartY = event.touches[0]?.clientY ?? 0;
	}

	function onTouchMove(event: TouchEvent) {
		if (isDisabled) {
			return;
		}

		if (touchStartY) {
			event.preventDefault();
		}
	}

	function onTouchEnd(event: TouchEvent) {
		if (isDisabled) {
			touchStartY = 0;
			return;
		}

		const touchEndY = event.changedTouches[0]?.clientY ?? touchStartY;
		const distance = touchStartY - touchEndY;

		touchStartY = 0;

		if (Math.abs(distance) < 44) {
			return;
		}

		requestMovieMove(distance > 0 ? 1 : -1);
	}

	function onKeyDown(event: KeyboardEvent) {
		const nextKeys = ['ArrowDown', 'PageDown', ' '];
		const previousKeys = ['ArrowUp', 'PageUp'];

		if (isDisabled) {
			return;
		}

		if (nextKeys.includes(event.key)) {
			event.preventDefault();
			requestMovieMove(1);
		}

		if (previousKeys.includes(event.key)) {
			event.preventDefault();
			requestMovieMove(-1);
		}
	}

	function onNavClick(event: MouseEvent) {
		const button = event.currentTarget as HTMLButtonElement;
		const targetIndex = Number(button.dataset.index);

		if (isDisabled) {
			return;
		}

		if (!Number.isFinite(targetIndex)) {
			return;
		}

		if (targetIndex === getIndex() || isInputLocked) {
			return;
		}

		isInputLocked = true;
		wheelDelta = 0;
		if (switchTo(targetIndex)) {
			lockWheelGestureUntilQuiet();
			unlockInput();
			return;
		}

		isInputLocked = false;
	}

	navDots.forEach((dot) => dot.addEventListener('click', onNavClick));
	root.addEventListener('wheel', onWheel, { passive: false });
	root.addEventListener('touchstart', onTouchStart, { passive: true });
	root.addEventListener('touchmove', onTouchMove, { passive: false });
	root.addEventListener('touchend', onTouchEnd, { passive: true });
	window.addEventListener('keydown', onKeyDown);

	return {
		setDisabled(disabled: boolean) {
			isDisabled = disabled;
			if (disabled) {
				wheelDelta = 0;
				touchStartY = 0;
				isInputLocked = false;
				isWheelGestureLocked = false;
				window.clearTimeout(wheelResetTimer);
				window.clearTimeout(inputUnlockTimer);
				window.clearTimeout(wheelGestureUnlockTimer);
			}
		},
		dispose() {
			window.clearTimeout(wheelResetTimer);
			window.clearTimeout(inputUnlockTimer);
			window.clearTimeout(wheelGestureUnlockTimer);
			navDots.forEach((dot) => dot.removeEventListener('click', onNavClick));
			root.removeEventListener('wheel', onWheel);
			root.removeEventListener('touchstart', onTouchStart);
			root.removeEventListener('touchmove', onTouchMove);
			root.removeEventListener('touchend', onTouchEnd);
			window.removeEventListener('keydown', onKeyDown);
		},
	};
}
