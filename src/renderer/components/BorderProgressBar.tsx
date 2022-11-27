import ProgressBar from '@ramonak/react-progress-bar';
import { Component } from 'react';
import s from './css/BorderProgressBar.module.css';

interface BorderProgressBarParam {
  getCurrentTime: () => number;
  getTotalTime: () => number;
}

interface BorderProgressBarState {
  completed: number;
}

export default class BorderProgressBar extends Component<
  BorderProgressBarParam,
  BorderProgressBarState
> {
  private interval: NodeJS.Timer | undefined;

  constructor(
    props: BorderProgressBarParam | Readonly<BorderProgressBarParam>
  ) {
    super(props);
    this.state = {
      completed: 100,
    };
  }

  componentDidMount() {
    this.interval = setInterval(this.intervalTask, 100);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  private intervalTask = (): void => {
    const { getCurrentTime, getTotalTime } = this.props;
    const currentTime = getCurrentTime();
    const totalTime = getTotalTime();
    if (currentTime === undefined || totalTime === undefined) {
      return;
    }
    this.setState({
      completed: (currentTime / totalTime) * 100,
    });
  };

  render() {
    const { completed } = this.state;
    return (
      <div className={s.processBar}>
        <ProgressBar
          completed={completed}
          transitionDuration="0.2s"
          isLabelVisible={false}
          height="8px"
          width="100%"
        />
      </div>
    );
  }
}
/*

 */
