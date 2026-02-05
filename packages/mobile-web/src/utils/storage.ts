// simple wrapper around localStorage with error handling
export const storage = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch {
      return null
    }
  },

  set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.error("failed to save to localStorage:", e)
    }
  },

  remove(key: string): void {
    localStorage.removeItem(key)
  },

  clear(): void {
    localStorage.clear()
  },
}

// all the keys we use for storage
export const STORAGE_KEYS = {
  AUTH_TOKEN: "opencode_auth_token",
  SERVER_URL: "opencode_server_url",
  CLIENT_ID: "opencode_client_id",
  THEME: "opencode_theme",
  LAST_SESSION_ID: "opencode_last_session",
}
