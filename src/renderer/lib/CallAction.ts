import SentenceT from './param/SentenceT';

export interface Action {
    action:
        | 'repeat'
        | 'next'
        | 'prev'
        | 'jump'
        | 'jump_time'
        | 'space'
        | 'none'
        | 'play'
        | 'pause'
        | 'single_repeat'
        | 'show_cn'
        | 'show_en'
        | 'show_en_cn';
    target: SentenceT | undefined;
    time: number | undefined;
}
export function prev(): Action {
    return {
        action: 'prev',
        target: undefined,
        time: undefined,
    };
}
export function next(): Action {
    return {
        action: 'next',
        target: undefined,
        time: undefined,
    };
}
export function repeat(): Action {
    return {
        action: 'repeat',
        target: undefined,
        time: undefined,
    };
}

export function singleRepeat(): Action {
    return {
        action: 'single_repeat',
        target: undefined,
        time: undefined,
    };
}

export function showCn(): Action {
    return {
        action: 'show_cn',
        target: undefined,
        time: undefined,
    };
}

export function showEn(): Action {
    return {
        action: 'show_en',
        target: undefined,
        time: undefined,
    };
}

export function showEnCn(): Action {
    return {
        action: 'show_en_cn',
        target: undefined,
        time: undefined,
    };
}

export function jump(target: SentenceT): Action {
    return {
        action: 'jump',
        target,
        time: undefined,
    };
}

export function jumpTime(time: number): Action {
    return {
        action: 'jump_time',
        target: undefined,
        time,
    };
}

export function space(): Action {
    return {
        action: 'space',
        target: undefined,
        time: undefined,
    };
}

export function play(): Action {
    return {
        action: 'play',
        target: undefined,
        time: undefined,
    };
}

export function pause(): Action {
    return {
        action: 'pause',
        target: undefined,
        time: undefined,
    };
}

export function none(): Action {
    return {
        action: 'none',
        target: undefined,
        time: undefined,
    };
}
