import { Router, Route, Navigate } from "@solidjs/router"
import { Show } from "solid-js"
import { AuthProvider, useAuth } from "./context/auth"
import { ThemeProvider } from "./context/theme"
import { SDKProvider } from "./context/sdk"
import { LoginPage } from "./pages/login"
import { SessionPickerPage } from "./pages/session-picker"

// protect routes that need auth
function ProtectedRoute(props: { component: () => any }) {
  const auth = useAuth()

  return (
    <Show when={auth.isAuthenticated()} fallback={<Navigate href="/login" />}>
      {props.component()}
    </Show>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SDKProvider>
          <Router>
            <Route path="/login" component={LoginPage} />
            <Route path="/sessions" component={() => <ProtectedRoute component={SessionPickerPage} />} />
            <Route path="/" component={() => <Navigate href="/sessions" />} />
          </Router>
        </SDKProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
