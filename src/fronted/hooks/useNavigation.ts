import { create } from 'zustand';
import { NAV_ITEMS, NavItem } from '../config/navigation';
import useSetting from './useSetting';

interface NavigationState {
    orderedItems: NavItem[];
    setOrderedItems: (items: NavItem[]) => void;
    syncFromSettings: (orderStr: string) => void;
}

const parseOrder = (orderStr: string): NavItem[] => {
    if (!orderStr) return NAV_ITEMS;
    try {
        const order = JSON.parse(orderStr) as string[];
        const mapped = order
            .map(id => NAV_ITEMS.find(item => item.id === id))
            .filter((item): item is NavItem => !!item);
        
        const missing = NAV_ITEMS.filter(item => !order.includes(item.id));
        return [...mapped, ...missing];
    } catch (e) {
        return NAV_ITEMS;
    }
};

export const useNavigationStore = create<NavigationState>((set, get) => ({
    orderedItems: parseOrder(useSetting.getState().values.get('appearance.sidebarOrder') || ''),
    setOrderedItems: (items) => {
        const orderStr = JSON.stringify(items.map(i => i.id));
        set({ orderedItems: items });
        // Update global settings
        const currentSetting = useSetting.getState().setting('appearance.sidebarOrder');
        if (currentSetting !== orderStr) {
            void useSetting.getState().setSetting('appearance.sidebarOrder', orderStr);
        }
    },
    syncFromSettings: (orderStr) => {
        const newItems = parseOrder(orderStr);
        // Compare to avoid unnecessary re-renders
        const currentIds = get().orderedItems.map(i => i.id).join(',');
        const newIds = newItems.map(i => i.id).join(',');
        if (currentIds !== newIds) {
            set({ orderedItems: newItems });
        }
    }
}));

// Subscribe to settings changes
useSetting.subscribe(
    (state) => state.values.get('appearance.sidebarOrder'),
    (orderStr) => {
        if (orderStr !== undefined) {
            useNavigationStore.getState().syncFromSettings(orderStr);
        }
    }
);
