import { create } from 'zustand';

type UseNotificationState = {
    type: 'info' | 'error' | 'none';
    text: string;
};
type UseNotificationAction = {
    setNotification: (notification: UseNotificationState) => void;
};

const useNotification = create<UseNotificationState & UseNotificationAction>(
    (set) => ({
        type: 'none',
        text: '',
        setNotification: (notification) => {
            set(notification);
        },
    })
);

export default useNotification;

let timer: NodeJS.Timeout | null = null;
useNotification.subscribe((notification) => {
    if (notification.type === 'none') {
        return;
    }
    if (timer) {
        clearTimeout(timer);
    }
    // 1000ms 后清空通知
    timer = setTimeout(() => {
        useNotification.setState({ type: 'none', text: '' });
    }, 2000);
});
