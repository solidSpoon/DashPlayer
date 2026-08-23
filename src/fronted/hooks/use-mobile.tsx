/**
 * 判断当前窗口是否处于移动端断点，用于响应式侧栏等场景。
 */
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    const initialTimer = window.setTimeout(() => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT), 0)
    return () => {
      window.clearTimeout(initialTimer)
      mql.removeEventListener("change", onChange)
    }
  }, [])

  return !!isMobile
}
