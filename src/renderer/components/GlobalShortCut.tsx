import { Component, ReactNode } from 'react';
import Keyevent from 'react-keyevent';
import { Action, next, prev, repeat, space } from '../lib/CallAction';

export enum JumpPosition {
    BEFORE = 0,
    AFTER = 1,
    CURRENT = 2,
}

interface ReactParam {
    // eslint-disable-next-line react/require-default-props
    children?: ReactNode;
}

interface GlobalShortCutParam extends ReactParam {
    onAction: (action: Action) => void;
}

export default class GlobalShortCut extends Component<
    GlobalShortCutParam,
    never
> {
    public onA = () => {
        const { onAction } = this.props;
        // onJumpTo(JumpPosition.BEFORE);
        onAction(prev());
    };

    public onD = () => {
        const { onAction } = this.props;
        // onJumpTo(JumpPosition.AFTER);
        onAction(next());
    };

    public onS = () => {
        const { onAction } = this.props;
        // onJumpTo(JumpPosition.CURRENT);
        onAction(repeat());
    };

    public onLeft = () => {
        const { onAction } = this.props;
        // onJumpTo(JumpPosition.BEFORE);
        onAction(prev());
    };

    public onRight = () => {
        const { onAction } = this.props;
        onAction(next());
    };

    public onDown = () => {
        const { onAction } = this.props;
        onAction(repeat());
    };

    public onSpace = () => {
        const { onAction } = this.props;
        onAction(space());
    };

    public onUp = () => {
        const { onAction } = this.props;
        onAction(space());
    };

    public onW = () => {
        const { onAction } = this.props;
        onAction(space());
    };

    render() {
        const { children } = this.props;
        return (
            <Keyevent
                className="TopSide"
                events={{
                    onA: this.onA,
                    onD: this.onD,
                    onS: this.onS,
                    onLeft: this.onLeft,
                    onRight: this.onRight,
                    onDown: this.onDown,
                    onSpace: this.onSpace,
                    onUp: this.onUp,
                    onW: this.onW,
                }}
                needFocusing={false}
            >
                {children}
            </Keyevent>
        );
    }
}
