import { createContext, useContext, createSignal, createEffect, ParentComponent } from "solid-js"
import { storage, STORAGE_KEYS } from "../utils/storage"

type Theme = "light" | "dark"

type ThemeContextType = {
  theme: () => Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>()

export const ThemeProvider: ParentComponent = (props) => {
  // figure out what theme to start with
  const getInitialTheme = (): Theme => {
    const stored = storage.get<Theme>(STORAGE_KEYS.THEME)
    if (stored) return stored

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  const [theme, setTheme] = createSignal<Theme>(getInitialTheme())

  // update the dom when theme changes
  createEffect(() => {
    const root = document.documentElement
    const currentTheme = theme()

    if (currentTheme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }

    storage.set(STORAGE_KEYS.THEME, currentTheme)
  })

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"))
  }

  const value = {
    theme,
    toggleTheme,
    setTheme,
  }

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
