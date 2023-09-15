import React, { Component, useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import isVisible from '../lib/isVisible';
import SentenceT from '../lib/param/SentenceT';
import SideSentenceNew from './SideSentenceNew';
import { Action, jump, jumpTime } from '../lib/CallAction';

interface SubtitleSubParam {
    subtitles: SentenceT[];
    currentSentence: SentenceT | undefined;
    onAction: (action: Action) => void;
}

export default class Subtitle extends Component<SubtitleSubParam> {
    private readonly SCROLL_BOUNDARY = 50;

    private currentRef: React.RefObject<HTMLDivElement> = React.createRef();

    private listRef: React.RefObject<VirtuosoHandle> = React.createRef();

    private visibleRange: [number, number] = [0, 0];

    componentDidUpdate = (
        _prevProps: Readonly<SubtitleSubParam>,
        _prevState: Readonly<never>,
        snapshot?: any
    ) => {
        console.log('snapshot', snapshot);
        // 似乎 render() 最外层元素渲染后就会触发 componentDidUpdate，此时还拿不到新的元素
        // 所以需要延迟一下
        requestAnimationFrame(() => {
            const { currentSentence } = this.props;
            const beforeVisible = snapshot as boolean;
            if (
                this.currentRef.current === null &&
                currentSentence === undefined
            ) {
                return;
            }
            const currentVisible = this.isIsVisible();
            console.log('currentVisible', beforeVisible, currentVisible);
            const index = currentSentence?.index;
            if (index && !currentVisible) {
                if (beforeVisible) {
                    this.listRef.current?.scrollToIndex({
                        index: index - 1 >= 0 ? index - 1 : 0,
                        align: 'start',
                        behavior: 'smooth',
                    });
                } else {
                    this.listRef.current?.scrollIntoView({
                        index,
                        align: 'start',
                        behavior: 'auto',
                    });
                    this.listRef.current?.scrollIntoView({
                        index: index - 1 >= 0 ? index - 1 : 0,
                        align: 'start',
                        behavior: 'auto',
                    });
                }
            }
        });
    };

    getSnapshotBeforeUpdate(): boolean {
        return this.isIsVisible();
    }

    private isIsVisible = (): boolean => {
        const { currentSentence } = this.props;
        const index = currentSentence?.index;
        if (index) {
            if (index < this.visibleRange[0] || index > this.visibleRange[1]) {
                return false;
            }
        }
        const currentDiv = this.currentRef.current;
        if (currentDiv === null) {
            return false;
        }
        return isVisible(currentDiv, this.SCROLL_BOUNDARY);
    };

    render() {
        const { subtitles } = this.props;
        const { currentSentence, onAction } = this.props;
        return (
            <Virtuoso
                ref={this.listRef}
                className="h-full w-full"
                data={subtitles}
                rangeChanged={({ startIndex, endIndex }) => {
                    this.visibleRange = [startIndex, endIndex];
                }}
                itemContent={(index, item) => {
                    const isCurrent = item.equals(currentSentence);
                    let result = (
                        <div
                            className={`${index === 0 ? 'pt-3' : ''}
                            ${index === subtitles.length - 1 ? 'pb-52' : ''}`}
                        >
                            <SideSentenceNew
                                sentence={item}
                                onClick={(sentence) => onAction(jump(sentence))}
                                isCurrent={isCurrent}
                            />
                        </div>
                    );
                    if (isCurrent) {
                        result = (
                            <div
                                key={`${item.getKey()}div`}
                                ref={this.currentRef}
                            >
                                {result}
                            </div>
                        );
                    }
                    return result;
                }}
            />
        );
    }
}
