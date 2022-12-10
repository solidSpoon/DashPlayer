const isVisible2 = (el: HTMLDivElement): boolean => {
    const rect = el.getBoundingClientRect();
    const vWidth = window.innerWidth || document.documentElement.clientWidth;
    const vHeight =
        (window.innerHeight || document.documentElement.clientHeight) - 100;
    return !(
        rect.right < 0 ||
        rect.top < 100 ||
        rect.left > vWidth ||
        rect.bottom > vHeight
    );
};

export const isTopInVisible = (
    el: HTMLDivElement,
    boundary: number
): boolean => {
    const rect = el.getBoundingClientRect();
    return rect.top < boundary;
};
export const isBottomInVisible = (
    el: HTMLDivElement,
    boundary: number
): boolean => {
    const rect = el.getBoundingClientRect();
    const vHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom > vHeight - boundary;
};
const isVisible = (el: HTMLDivElement, boundary: number): boolean => {
    const topInVisible = isTopInVisible(el, boundary);
    const bottomInVisible = isBottomInVisible(el, boundary);
    return !(topInVisible || bottomInVisible);
};
export const getTargetBottomPosition = (
    el: HTMLDivElement,
    boundary: number
): number => {
    const rect = el.getBoundingClientRect();
    const vHeight = window.innerHeight || document.documentElement.clientHeight;
    return vHeight - boundary - rect.height;
};
export default isVisible;
