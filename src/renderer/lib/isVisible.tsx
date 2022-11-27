export const isVisible = (el: HTMLDivElement | null): boolean => {
    const rect = el.getBoundingClientRect();
    console.log(rect.bottom, rect.top)
    const vWidth = window.innerWidth || document.documentElement.clientWidth;
    const vHeight = (window.innerHeight || document.documentElement.clientHeight) - 100;
    return !(rect.right < 0 || rect.top < 100||
        rect.left > vWidth || rect.bottom > vHeight);
};
