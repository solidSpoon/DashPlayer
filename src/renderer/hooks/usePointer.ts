// import { create } from 'zustand';
// import { subscribeWithSelector } from 'zustand/middleware';
//
// export interface Point {
//     key?: string;
//     x: number;
//     y: number;
// }
//
// type UsePointerState = {
//     showPointer: boolean;
//     points: Point[];
//     pointer?: Point;
// };
//
// type UsePointerAction = {
//     addPoint: (key: string, p: Point) => void;
//     removePoint: (key: string) => void;
//     setShowPointer: (show: boolean) => void;
// };
//
// const usePointer = create(
//     subscribeWithSelector<UsePointerState & UsePointerAction>((set) => ({
//         showPointer: true,
//         points: [],
//         addPoint: (key: string, p: Point) => {
//             set((state) => ({
//                 points: state.points.concat({ key, ...p }),
//             }));
//         },
//         removePoint: (key: string) => {
//             set((state) => ({
//                 points: state.points.filter((p) => p.key !== key),
//             }));
//         },
//         setShowPointer: (show: boolean) => {
//             set({ showPointer: show });
//         },
//     }))
// );
//
// let interval: NodeJS.Timeout | undefined;
// let index = 0;
// interval = setInterval(() => {
//     if (index >= usePointer.getState().points.length) {
//         index = 0;
//     }
//     console.log('index', index, usePointer.getState().points[index]);
//     usePointer.setState((state) => {
//         return {
//             pointer: state.points[index],
//         };
//     });
//     index++;
// }, 500);
//
// export default usePointer;
