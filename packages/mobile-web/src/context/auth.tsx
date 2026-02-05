import { createContext, useContext, createSignal, createEffect, ParentComponent } from "solid-js"
import { storage, STORAGE_KEYS } from "../utils/storage"
import { ulid } from "ulid"

type AuthContextType = {
  token: () => string | null
  serverUrl: () => string
  clientID: () => string
  isAuthenticated: () => boolean
  login: (token: string, serverUrl: string) => void
  logout: () => void
  setServerUrl: (url: string) => void
}

const AuthContext = createContext<AuthContextType>()

export const AuthProvider: ParentComponent = (props) => {
  const [token, setToken] = createSignal<string | null>(storage.get(STORAGE_KEYS.AUTH_TOKEN))
  const [serverUrl, setServerUrlSignal] = createSignal<string>(
    storage.get(STORAGE_KEYS.SERVER_URL) || "http://localhost:4096",
  )
  const [clientID] = createSignal<string>(storage.get(STORAGE_KEYS.CLIENT_ID) || `client_${ulid()}`)

  // save client id so we keep it across sessions
  createEffect(() => {
    storage.set(STORAGE_KEYS.CLIENT_ID, clientID())
  })

  const login = (authToken: string, url: string) => {
    setToken(authToken)
    setServerUrlSignal(url)
    storage.set(STORAGE_KEYS.AUTH_TOKEN, authToken)
    storage.set(STORAGE_KEYS.SERVER_URL, url)
  }

  const logout = () => {
    setToken(null)
    storage.remove(STORAGE_KEYS.AUTH_TOKEN)
  }

  const setServerUrl = (url: string) => {
    setServerUrlSignal(url)
    storage.set(STORAGE_KEYS.SERVER_URL, url)
  }

  const isAuthenticated = () => !!token()

  const value = {
    token,
    serverUrl,
    clientID,
    isAuthenticated,
    login,
    logout,
    setServerUrl,
  }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
