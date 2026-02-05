import { createSignal, createResource, For, Show } from "solid-js"
import { A, useNavigate } from "@solidjs/router"
import { useSDK } from "../context/sdk"
import { useAuth } from "../context/auth"
import { useTheme } from "../context/theme"

type SessionEntry = {
  sessionID: string
  projectID: string
  directory: string
  createdAt: number
  lastActivity: number
  clients: string[]
}

export function SessionPickerPage() {
  const sdk = useSDK()
  const auth = useAuth()
  const theme = useTheme()
  const navigate = useNavigate()

  // fetch all active sessions from the server
  const [sessions] = createResource<SessionEntry[]>(async () => {
    const response = await sdk.fetch(`${sdk.apiUrl()}/session/global`)
    if (!response.ok) throw new Error("failed to fetch sessions")
    return response.json()
  })

  // make timestamps human-readable
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const handleSessionClick = (sessionID: string) => {
    navigate(`/session/${sessionID}`)
  }

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* header */}
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div class="px-4 py-4 flex items-center justify-between">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">sessions</h1>
          <div class="flex items-center gap-2">
            <button
              onClick={() => theme.toggleTheme()}
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="toggle theme"
            >
              {theme.theme() === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={() => auth.logout()}
              class="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              logout
            </button>
          </div>
        </div>
      </header>

      {/* content */}
      <main class="p-4">
        <Show when={sessions.loading}>
          <div class="flex justify-center py-12">
            <div class="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
        </Show>

        <Show when={sessions.error}>
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p class="text-sm text-red-800 dark:text-red-200">failed to load sessions: {sessions.error?.message}</p>
          </div>
        </Show>

        <Show when={sessions()}>
          <div class="space-y-3">
            <For
              each={sessions()}
              fallback={
                <div class="text-center py-12">
                  <p class="text-gray-500 dark:text-gray-400">no active sessions found</p>
                  <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    create a session on your desktop to get started
                  </p>
                </div>
              }
            >
              {(session) => (
                <button
                  onClick={() => handleSessionClick(session.sessionID)}
                  class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left"
                >
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-mono text-gray-600 dark:text-gray-400 truncate">{session.sessionID}</p>
                    </div>
                    <Show when={session.clients.length > 0}>
                      <span class="ml-2 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                        {session.clients.length} {session.clients.length === 1 ? "client" : "clients"}
                      </span>
                    </Show>
                  </div>

                  <p class="text-sm text-gray-700 dark:text-gray-300 mb-1 font-medium truncate">{session.directory}</p>

                  <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>last active: {formatDate(session.lastActivity)}</span>
                    <span class="text-gray-400">→</span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>connected to: {sdk.apiUrl()}</p>
          <p class="mt-1">client id: {auth.clientID()}</p>
        </div>
      </main>
    </div>
  )
}
