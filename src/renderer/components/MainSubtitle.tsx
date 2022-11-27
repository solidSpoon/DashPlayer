import React, { Component, ReactElement } from 'react';
import style from './css/MainSubt.module.css';
import SentenceT from '../lib/param/SentenceT';
import TranslatableLine from './TranslatableLine';

interface MainSubtitleState {
  sentence: undefined | SentenceT;
}

export default class MainSubtitle extends Component<any, MainSubtitleState> {
  constructor(props: any) {
    super(props);
    this.state = {
      sentence: undefined,
    };
  }

  private ele(): ReactElement[] {
    const { sentence } = this.state;
    const elements: ReactElement[] = [];
    if (sentence === undefined) {
      return elements;
    }
    elements.push(
      <TranslatableLine key={1} text={sentence.text} className={style.source} />
    );
    if (sentence.msTranslate !== undefined) {
      elements.push(
        <div key={2} className={style.destM}>
          {sentence.msTranslate}
        </div>
      );
    }
    if (sentence.textZH !== undefined) {
      elements.push(
        <div key={3} className={style.destH}>
          {sentence.textZH}
        </div>
      );
    }
    return elements;
  }

  render() {
    return <div className={style.mainSubtitleContainer}>{this.ele()}</div>;
  }
}
