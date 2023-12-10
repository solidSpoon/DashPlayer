import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

type UseLayoutState = {
    showSideBar: boolean;
};

type UseLayoutActions = {
    changeSideBar: (show: boolean) => void;
};

const useLayout = create(
    subscribeWithSelector<UseLayoutState & UseLayoutActions>((set) => ({
        showSideBar: false,
        changeSideBar: (show: boolean) => {
            set({ showSideBar: show });
        },
    }))
);

export default useLayout;
