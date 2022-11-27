import { Component, ReactNode } from 'react';
import Keyevent from 'react-keyevent';

export enum JumpPosition {
  BEFORE = 0,
  AFTER = 1,
  CURRENT = 2,
}

export interface ReactParam {
  children?: ReactNode;
}

interface GlobalShortCutParam extends ReactParam {
  onJumpTo: (position: JumpPosition) => void;
  onSpace: () => void;
}

export default class GlobalShortCut extends Component<
  GlobalShortCutParam,
  any
> {
  public onA = () => {
    const { onJumpTo } = this.props;
    onJumpTo(JumpPosition.BEFORE);
  };

  public onD = () => {
    const { onJumpTo } = this.props;
    onJumpTo(JumpPosition.AFTER);
  };

  public onS = () => {
    const { onJumpTo } = this.props;
    onJumpTo(JumpPosition.CURRENT);
  };

  public onLeft = () => {
    const { onJumpTo } = this.props;
    onJumpTo(JumpPosition.BEFORE);
  };

  public onRight = () => {
    const { onJumpTo } = this.props;
    onJumpTo(JumpPosition.AFTER);
  };

  public onDown = () => {
    const { onJumpTo } = this.props;
    onJumpTo(JumpPosition.CURRENT);
  };

  public onSpace = () => {
    const { onSpace } = this.props;
    onSpace();
  };

  public onUp = () => {
    const { onSpace } = this.props;
    onSpace();
  };

  public onW = () => {
    const { onSpace } = this.props;
    onSpace();
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
