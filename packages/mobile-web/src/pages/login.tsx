import { createSignal, Show } from "solid-js"
import { useAuth } from "../context/auth"
import { useNavigate } from "@solidjs/router"

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()

  const [token, setToken] = createSignal("")
  const [serverUrl, setServerUrl] = createSignal(auth.serverUrl())
  const [error, setError] = createSignal("")
  const [isLoading, setIsLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError("")

    const tokenValue = token().trim()
    const urlValue = serverUrl().trim()

    if (!tokenValue) {
      setError("please enter your authentication token")
      return
    }

    if (!urlValue) {
      setError("please enter the server url")
      return
    }

    setIsLoading(true)

    try {
      // test the connection by trying to fetch session list
      const response = await fetch(`${urlValue}/session/global`, {
        headers: {
          Authorization: `Bearer ${tokenValue}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("invalid token or unauthorized")
        }
        throw new Error(`server error: ${response.statusText}`)
      }

      // we're in! save credentials and navigate
      auth.login(tokenValue, urlValue)
      navigate("/sessions", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to connect to server")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black p-4">
      <div class="w-full max-w-md">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">opencode mobile</h1>
            <p class="text-gray-600 dark:text-gray-400">sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} class="space-y-6">
            <div>
              <label for="serverUrl" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                server url
              </label>
              <input
                id="serverUrl"
                type="url"
                value={serverUrl()}
                onInput={(e) => setServerUrl(e.currentTarget.value)}
                placeholder="http://localhost:4096"
                class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={isLoading()}
              />
            </div>

            <div>
              <label for="token" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                authentication token
              </label>
              <input
                id="token"
                type="password"
                value={token()}
                onInput={(e) => setToken(e.currentTarget.value)}
                placeholder="oc_..."
                class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
                disabled={isLoading()}
              />
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                generate a token on your desktop:{" "}
                <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">opencode token generate --name "my phone"</code>
              </p>
            </div>

            <Show when={error()}>
              <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-sm text-red-800 dark:text-red-200">{error()}</p>
              </div>
            </Show>

            <button
              type="submit"
              disabled={isLoading()}
              class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {isLoading() ? "connecting..." : "sign in"}
            </button>
          </form>

          <div class="mt-6 text-center">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              don't have opencode installed?{" "}
              <a
                href="https://opencode.ai"
                target="_blank"
                class="text-primary-600 dark:text-primary-400 hover:underline"
              >
                get started
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
