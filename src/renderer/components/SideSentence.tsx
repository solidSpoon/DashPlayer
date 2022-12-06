import React, { Component } from 'react';
// eslint-disable-next-line import/no-cycle
import SentenceT from '../lib/param/SentenceT';

interface SideSentenceParam {
    sentence: SentenceT;
    onClick: (sentence: SentenceT) => void;
    itemKey: string;
}
interface SideSentenceState {
    isCurrent: boolean;
}
export default class SideSentence extends Component<
    SideSentenceParam,
    SideSentenceState
> {
    private readonly iconRef: React.RefObject<HTMLDivElement>;

    constructor(props: SideSentenceParam | Readonly<SideSentenceParam>) {
        super(props);
        this.iconRef = React.createRef<HTMLDivElement>();
        this.state = {
            isCurrent: false,
        };
    }

    public show(): void {
        this.setState({ isCurrent: true });
    }

    public hide(): void {
        this.setState({ isCurrent: false });
    }

    render() {
        const { itemKey, sentence, onClick } = this.props;
        const { isCurrent } = this.state;
        return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
            <div
                key={itemKey}
                className={`
                m-1.5
                py-2
                border-0
                flex
                content-start
                rounded-lg
                bg-neutral-700
                hover:drop-shadow-xl
                hover:shadow-inner
                hover:shadow-neutral-500
                hover:bg-neutral-600
                hover:drop-shadow-lg
                text-lg
                drop-shadow
                overflow-hidden
                ${isCurrent ? 'shadow-inner shadow-neutral-500' : ''}
                `}
                onClick={() => {
                    onClick(sentence);
                }}
            >
                <div
                    className={`w-1 bg-red-700 ${
                        isCurrent ? 'visible' : 'invisible'
                    }`}
                />
                <div className="w-full text-center">{sentence.text}</div>
                <div
                    className={`w-1 bg-red-600 ${
                        isCurrent ? 'visible' : 'invisible'
                    }`}
                />
            </div>
        );
    }
}
