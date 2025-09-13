import React, { useEffect, useRef } from 'react';
import { ClipSrtLine } from '@/common/types/clipMeta';

type Props = {
  lines: ClipSrtLine[];
  activeIndex: number;
  onPickLine?: (idx: number) => void;
};

export default function SubtitleList({ lines, activeIndex, onPickLine }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="overflow-auto max-h-64">
      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div
            key={idx}
            ref={(r) => (itemRefs.current[idx] = r)}
            onClick={() => onPickLine?.(idx)}
            className={`p-2 rounded text-sm cursor-pointer ${
              idx === activeIndex
                ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500'
                : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <div className="text-xs text-gray-500 mb-1">
              {formatTime(line.start)} - {formatTime(line.end)}
            </div>
            <div className="text-gray-900 dark:text-gray-100">{line.contentEn}</div>
            <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">{line.contentZh}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}