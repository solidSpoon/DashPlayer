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
    'text-stone-700 dark:text-neutral-200',
    'shadow-stone-100 dark:shadow-neutral-600'
  ].join(' '),
  leftIcon: 'w-10 m-2.5 h-10 flex-shrink-0',
  rightIcon: 'w-10 h-full flex items-end justify-center pb-2 flex-shrink-0',
  core: {
    root: 'px-10 pt-2.5 pb-2.5 text-center leading-relaxed box-border'
  },
  word: {
    hoverBgClass: 'transition-colors duration-150 hover:bg-white/95 hover:shadow-xs hover:text-stone-950 dark:hover:bg-neutral-600/80 dark:hover:text-white rounded px-1',
    vocabHighlightClass: 'text-emerald-700 dark:text-emerald-400 font-medium underline decoration-emerald-500/50 dark:decoration-emerald-400/40 decoration-[1.5px] underline-offset-[0.22em] rounded px-0.5 transition-colors duration-150 hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 hover:decoration-emerald-600 dark:hover:decoration-emerald-300',
    popReferenceBgClass: 'bg-white/95 shadow-xs text-stone-950 dark:bg-neutral-600/80 dark:text-white'
  },
  pop: {
    container: 'select-text relative top-0 left-0 h-[500px] w-[500px] overflow-y-hidden flex flex-col items-start bg-popover text-popover-foreground shadow-lg border border-border rounded-xl px-4 scrollbar-none',
    openaiContainer: 'w-[360px] h-[400px] bg-popover text-popover-foreground shadow-lg border border-border/80 rounded-xl overflow-hidden text-left relative flex flex-col',
    refreshButton: 'p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
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

function mergeTheme<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base;
  const output: T = Array.isArray(base) ? [...(base as unknown[])] as T : { ...base };
  for (const k of Object.keys(patch)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v === undefined) continue;
    if (isObject((base as Record<string, unknown>)[k]) && isObject(v)) {
      (output as Record<string, unknown>)[k] = mergeTheme(
        (base as Record<string, unknown>)[k],
        v as DeepPartial<unknown>
      );
    } else {
      (output as Record<string, unknown>)[k] = v;
    }
  }
  return output;
}
function isObject(o: unknown) {
  return o && typeof o === 'object' && !Array.isArray(o);
}
