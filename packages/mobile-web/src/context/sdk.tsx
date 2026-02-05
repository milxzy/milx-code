import { createContext, useContext, createMemo, ParentComponent } from "solid-js"
import { useAuth } from "./auth"

type SDKContextType = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  apiUrl: () => string
}

const SDKContext = createContext<SDKContextType>()

export const SDKProvider: ParentComponent = (props) => {
  const auth = useAuth()

  // wrap fetch to add our auth token
  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = auth.token()
    const headers = new Headers(init?.headers)

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    return window.fetch(input, {
      ...init,
      headers,
    })
  }

  const apiUrl = createMemo(() => auth.serverUrl())

  const value = {
    fetch,
    apiUrl,
  }

  return <SDKContext.Provider value={value}>{props.children}</SDKContext.Provider>
}

export function useSDK() {
  const context = useContext(SDKContext)
  if (!context) throw new Error("useSDK must be used within SDKProvider")
  return context
}
