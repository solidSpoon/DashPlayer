import { StateCreator } from 'zustand/esm/index';
import { ControllerSlice, InternalSlice, PlayerSlice, SentenceSlice, SubtitleSlice } from './SliceTypes';
import SentenceT from '../../lib/param/SentenceT';
import usePlayerController from '../usePlayerController';
//export const next = () => {
//     const { currentSentence } = usePlayerController.getState();
//     if (currentSentence) {
//         const target = getElementAt(
//             currentSentence.index + 1,
//             usePlayerController.getState().subtitle
//         );
//         usePlayerController.getState().setCurrentSentence(target);
//         usePlayerController.getState().seekTo({
//             time: target.currentBegin ?? 0,
//         });
//     }
// };

// export const prev = () => {
//   const { currentSentence } = usePlayerController.getState();
//   if (currentSentence) {
//     const target = getElementAt(
//       currentSentence.index - 1,
//       usePlayerController.getState().subtitle
//     );
//     usePlayerController.getState().setCurrentSentence(target);
//     usePlayerController.getState().seekTo({
//       time: target.currentBegin ?? 0,
//     });
//   }
// };
// export const jump = (target: SentenceT) => {
//   usePlayerController.getState().setCurrentSentence(target);
//   usePlayerController.getState().seekTo({
//     time: target.currentBegin ?? 0,
//   });
// };


function getElementAt(index: number, subtitles: SentenceT[]): SentenceT {
  let targetIndex = index;
  if (targetIndex < 0) {
    targetIndex = 0;
  }
  if (targetIndex >= subtitles.length) {
    targetIndex = subtitles.length - 1;
  }
  return subtitles[targetIndex];
}
const createInternalSlice: StateCreator<
  ControllerSlice & SentenceSlice & SubtitleSlice & PlayerSlice,
  [],
  [],
  ControllerSlice
> = (setState, getState, store) => ({
  next: () => {
    const { currentSentence } = getState();
    if (currentSentence) {
      const target = getElementAt(
        currentSentence.index + 1,
        getState().subtitle
      );
      setState({ currentSentence: target });
      setState({ seekTime: { time: target.currentBegin ?? 0 } });
    }
  },
  prev: () => {
    const { currentSentence } = getState();
    if (currentSentence) {
      const target = getElementAt(
        currentSentence.index - 1,
        getState().subtitle
      );
      setState({ currentSentence: target });
      getState().seekTo({
        time: target.currentBegin ?? 0,
      });
    }
  },
  jump: (target: SentenceT) => {
    setState({ currentSentence: target });
    getState().seekTo({
      time: target.currentBegin ?? 0,
    });
  },
  repeat: () => {

  }
});
