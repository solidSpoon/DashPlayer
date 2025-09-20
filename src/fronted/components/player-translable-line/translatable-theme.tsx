import React, { createContext, useContext, useMemo } from 'react';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface TransLineTheme {
  container: string;              // 外层容器（TranslatableLine）
  leftIcon: string;               // 左侧时间/调整区域
  rightIcon: string;              // 右侧收藏标记区域
  core: {
    root: string;                 // TranslatableLineCore 外层（英文可点/可查）
  };
  word: {
    hoverBgClass: string;         // 单词 hover 背景（非弹层）
    vocabHighlightClass: string;  // 词汇高亮样式
    popReferenceBgClass: string;  // 弹层 reference 的底色（非 hover）
  };
  pop: {
    container: string;            // 有道弹层容器
    openaiContainer: string;      // OpenAI 弹层容器
    refreshButton: string;        // 刷新按钮样式
  };
}

const defaultTheme: TransLineTheme = {
  container: [
    'flex justify-between items-start rounded-lg drop-shadow-md mx-10 mt-2.5 shadow-inner z-50',
    'bg-stone-200 dark:bg-neutral-700',
    'text-stone-700 dark:text-neutral-100',
    'shadow-stone-100 dark:shadow-neutral-600'
  ].join(' '),
  leftIcon: 'w-10 m-2.5 h-10 flex-shrink-0',
  rightIcon: 'w-10 h-full flex items-end justify-center pb-2 flex-shrink-0',
  core: {
    root: 'flex flex-wrap justify-center items-end px-10 pt-2.5 pb-2.5 gap-x-2 gap-y-1'
  },
  word: {
    hoverBgClass: 'hover:bg-stone-100 dark:hover:bg-neutral-600',
    vocabHighlightClass: '!text-blue-400 !underline !decoration-blue-400 !decoration-1 !bg-blue-500/10 px-0.5 rounded hover:!bg-blue-500/30',
    popReferenceBgClass: 'bg-stone-100 dark:bg-neutral-600'
  },
  pop: {
    container: 'select-text relative top-0 left-0 h-[500px] w-[500px] overflow-y-hidden flex flex-col items-start bg-gray-100 text-gray-900 shadow-inner shadow-gray-100 drop-shadow-2xl rounded-2xl px-4 scrollbar-none',
    openaiContainer: 'w-80 h-96 bg-gray-100 text-gray-900 shadow-inner shadow-gray-100 drop-shadow-2xl rounded-2xl overflow-hidden text-left relative',
    refreshButton: 'absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm transition-colors z-10'
  }
};

const ThemeCtx = createContext<TransLineTheme>(defaultTheme);

export function TransLineThemeProvider({
  value,
  children
}: {
  value?: DeepPartial<TransLineTheme>;
  children: React.ReactNode;
}) {
  const merged = useMemo(() => mergeTheme(defaultTheme, value ?? {}), [value]);
  return <ThemeCtx.Provider value={merged}>{children}</ThemeCtx.Provider>;
}

export function useTransLineTheme() {
  return useContext(ThemeCtx);
}

function mergeTheme(base: any, patch: any): any {
  if (!patch) return base;
  const output: any = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(patch)) {
    const v = (patch as any)[k];
    if (v === undefined) continue;
    if (isObject(base[k]) && isObject(v)) {
      output[k] = mergeTheme(base[k], v);
    } else {
      output[k] = v;
    }
  }
  return output;
}
function isObject(o: any) {
  return o && typeof o === 'object' && !Array.isArray(o);
}