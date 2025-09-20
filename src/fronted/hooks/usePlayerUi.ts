import { create } from 'zustand';

type PlayerUiState = {
  showEn: boolean;
  showCn: boolean;
  syncSide: boolean;
  showWordLevel: boolean;
};

type PlayerUiActions = {
  changeShowEn: () => void;
  changeShowCn: () => void;
  changeShowEnCn: () => void;
  changeSyncSide: () => void;
  changeShowWordLevel: () => void;
};

export const usePlayerUi = create<PlayerUiState & PlayerUiActions>((set, get) => ({
  showEn: true,
  showCn: true,
  syncSide: false,
  showWordLevel: false,

  changeShowEn: () => set((s) => ({ showEn: !s.showEn })),
  changeShowCn: () => set((s) => ({ showCn: !s.showCn })),
  changeShowEnCn: () => set((s) => ({ showEn: !s.showEn, showCn: !s.showEn })),
  changeSyncSide: () => set((s) => ({ syncSide: !s.syncSide })),
  changeShowWordLevel: () => set((s) => ({ showWordLevel: !s.showWordLevel })),
}));

export default usePlayerUi;

