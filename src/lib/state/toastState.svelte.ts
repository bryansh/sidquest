export interface Toast {
	id: string;
	message: string;
	type: 'info' | 'success' | 'error';
}

export const toastState = $state<{ toasts: Toast[] }>({ toasts: [] });

let counter = 0;

export function showToast(message: string, type: Toast['type'] = 'info', durationMs = 3000) {
	const id = `toast-${++counter}`;
	toastState.toasts = [...toastState.toasts, { id, message, type }];
	setTimeout(() => {
		toastState.toasts = toastState.toasts.filter(t => t.id !== id);
	}, durationMs);
}

export function dismissToast(id: string) {
	toastState.toasts = toastState.toasts.filter(t => t.id !== id);
}
