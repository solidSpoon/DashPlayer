import SentenceT from './param/SentenceT';

export interface Action {
    action:
        | 'repeat'
        | 'next'
        | 'prev'
        | 'jump'
        | 'jump_time'
        | 'space'
        | 'none';
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

export function none(): Action {
    return {
        action: 'none',
        target: undefined,
        time: undefined,
    };
}
