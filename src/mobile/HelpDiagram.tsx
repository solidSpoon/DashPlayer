import React from 'react';

/**
 * 列表页帮助里的播放页骨架示意图。
 *
 * 画的是页面分区和长按位置，具体说明由帮助面板的文字负责；SVG 对读屏隐藏，
 * 避免同一段说明被重复播报。
 */
const HelpDiagram = () => {
    return (
        <div className="help-diagram" aria-hidden="true">
            <svg viewBox="0 0 240 380" xmlns="http://www.w3.org/2000/svg">
                <rect className="hd-frame" x="10" y="6" width="220" height="368" rx="18" />

                <rect className="hd-video" x="18" y="18" width="204" height="110" rx="7" />
                <text className="hd-label" x="26" y="32">视频</text>
                <path className="hd-muted" d="M112 58 L112 82 L132 70 Z" />
                <rect className="hd-bar" x="26" y="118" width="188" height="3" rx="1.5" />
                <rect className="hd-muted" x="26" y="118" width="94" height="3" rx="1.5" />

                <rect className="hd-main" x="18" y="140" width="204" height="64" rx="7" />
                <text className="hd-label" x="26" y="154">主字幕</text>
                <rect className="hd-bar-strong" x="42" y="162" width="92" height="6" rx="3" />
                <rect className="hd-bar" x="60" y="174" width="56" height="5" rx="2.5" />

                <circle className="hd-ring" cx="188" cy="164" r="13" strokeDasharray="3 3" />
                <circle className="hd-ring" cx="188" cy="164" r="8" strokeDasharray="8 4" />
                <circle className="hd-accent" cx="188" cy="164" r="4" />
                <rect className="hd-accent" x="166" y="182" width="44" height="15" rx="7.5" />
                <text className="hd-on-accent" x="188" y="192.5" textAnchor="middle">长按</text>

                <text className="hd-label" x="26" y="222">字幕列表</text>
                <rect className="hd-bar" x="60" y="236" width="120" height="5" rx="2.5" />
                <rect className="hd-bar" x="46" y="252" width="148" height="5" rx="2.5" />
                <rect className="hd-bar" x="68" y="268" width="104" height="5" rx="2.5" />
                <rect className="hd-accent" x="68" y="275" width="104" height="1.5" rx="0.75" />
                <rect className="hd-bar" x="52" y="284" width="136" height="5" rx="2.5" />
                <rect className="hd-bar" x="62" y="300" width="116" height="5" rx="2.5" />

                <rect className="hd-surface" x="18" y="316" width="48" height="40" rx="9" />
                <rect className="hd-surface" x="72" y="316" width="96" height="40" rx="9" />
                <rect className="hd-surface" x="174" y="316" width="48" height="40" rx="9" />
                <path className="hd-arrow" d="M38 328 L30 336 L38 344" />
                <path className="hd-arrow" d="M202 328 L210 336 L202 344" />
                <rect className="hd-bar-strong" x="88" y="330" width="64" height="4" rx="2" />
                <rect className="hd-bar" x="94" y="338" width="52" height="4" rx="2" />
                <rect className="hd-bar" x="108" y="364" width="24" height="2.5" rx="1.25" />
            </svg>
        </div>
    );
};

export default HelpDiagram;
