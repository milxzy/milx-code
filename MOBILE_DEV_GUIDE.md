# Mobile Access - Developer Guide

This guide covers the mobile web access functionality I added to OpenCode. It explains how everything works, where to find components, and how to develop/debug the system.

## Architecture Overview

The mobile access system has three main parts:

1. **Server Extensions** - Enhanced OpenCode server with session registry and auth
2. **Mobile Web Client** - SolidJS PWA that connects to sessions
3. **CLI Commands** - Token management tools

```
Mobile PWA ──┐
             ├──> Enhanced OpenCode Server ──> Global Session Registry
Desktop TUI ─┘                               └─> Token Auth System
```

## Server Extensions

### Session Registry (`packages/opencode/src/server/session-registry.ts`)

**What it does:** Tracks all active OpenCode sessions across multiple server instances.

**Key features:**

- Global session tracking with 2-hour timeout
- Multi-client support (multiple devices per session)
- Automatic cleanup of expired sessions
- Event broadcasting to connected clients

**How to use it:**

```typescript
// sessions are automatically registered when created
// check what's running:
const sessions = SessionRegistry.getSessions()
console.log(`${sessions.length} active sessions`)

// manually register a session:
SessionRegistry.registerSession(sessionId, {
  /* session info */
})
```

**Configuration:**

- `OPENCODE_SESSION_TIMEOUT` - Session timeout in milliseconds (default: 2 hours)

### Authentication (`packages/opencode/src/server/auth.ts`)

**What it does:** Token-based auth system for mobile clients.

**Key features:**

- 30-day token expiry
- Named tokens for device identification
- Secure token validation
- Token cleanup and revocation

**Storage:** Tokens are stored in `~/.opencode/tokens.json`

**How tokens work:**

```typescript
// tokens are generated with CLI commands
// validation happens automatically on auth routes
// each token has: id, name, token, created, expires
```

### Auth Routes (`packages/opencode/src/server/routes/auth.ts`)

**What it does:** HTTP endpoints for mobile client authentication.

**Endpoints:**

- `POST /auth/login` - Validate token and get session list
- `GET /auth/sessions` - List available sessions (requires auth)

**How to test:**

```bash
# generate a token first
opencode token generate --name "Test Token"

# test auth endpoint
curl -X POST http://localhost:4096/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "your_token_here"}'
```

### Enhanced Session Routes (`packages/opencode/src/server/routes/session.ts`)

**What I added:** Four new endpoints for multi-client session support.

**New endpoints:**

- `GET /sessions` - List all global sessions
- `POST /sessions/:id/attach` - Attach client to session
- `POST /sessions/:id/detach` - Detach client from session
- `GET /sessions/:id/clients` - List connected clients

**Enhanced endpoint:**

- `GET /events/:sessionId` - Now supports client filtering with `?clientId=xxx`

### Server Integration (`packages/opencode/src/server/server.ts`)

**What I changed:** Added async initialization and auth route registration.

**Key changes:**

```typescript
// now async to support initialization
static async listen(port: number = 4096) {
  await SessionRegistry.init()
  await ServerAuth.init()
  // ... rest of server setup
}

// auth routes are registered at /auth
this.app.route("/auth", AuthRoutes)
```

## Mobile Web Client

Located in: `packages/mobile-web/`

### Tech Stack

- **SolidJS** - Reactive UI framework
- **Vite** - Build tool and dev server
- **PWA** - Progressive web app capabilities
- **TypeScript** - Type safety

### Project Structure

```
packages/mobile-web/
├── src/
│   ├── components/     # ui components
│   ├── contexts/       # global state (auth, theme)
│   ├── pages/         # login and session picker
│   ├── services/      # api calls and sse handling
│   └── types/         # typescript definitions
├── public/            # pwa manifest and icons
└── vite.config.ts     # build configuration
```

### Key Components

**Login Page (`src/pages/Login.tsx`)**

- Server URL and token input
- Validates connection and saves auth
- Redirects to session picker on success

**Session Picker (`src/pages/SessionPicker.tsx`)**

- Lists all available sessions
- Shows client count for each session
- Connect/disconnect functionality

**Auth Context (`src/contexts/AuthContext.tsx`)**

- Manages authentication state
- Stores server URL and token
- Provides login/logout functions

**Theme Context (`src/contexts/ThemeContext.tsx`)**

- Dark/light mode toggle
- Persists theme preference
- Applies theme classes

### Services

**API Service (`src/services/api.ts`)**

```typescript
// handles all http requests to server
export const api = {
  login: (serverUrl: string, token: string) => {
    /* ... */
  },
  getSessions: () => {
    /* ... */
  },
  attachToSession: (sessionId: string) => {
    /* ... */
  },
  // ...
}
```

**SSE Service (`src/services/sse.ts`)**

```typescript
// manages server-sent event connections
export class SSEManager {
  connect(sessionId: string, clientId: string) {
    /* ... */
  }
  disconnect() {
    /* ... */
  }
  onMessage(callback: (data: any) => void) {
    /* ... */
  }
}
```

### Development

**Start dev server:**

```bash
cd packages/mobile-web
bun install
bun dev
```

**Build for production:**

```bash
bun run build
```

**PWA features:**

- Install prompt on mobile browsers
- Offline capability (basic)
- Home screen icon
- Fullscreen mode

## CLI Commands

Located in: `packages/opencode/src/cli/cmd/token.ts`

### Available Commands

**Generate new token:**

```bash
opencode token generate --name "My iPhone"
# outputs: Generated token: abc123...
```

**List all tokens:**

```bash
opencode token list
# shows: id, name, created, expires for each token
```

**Revoke specific token:**

```bash
opencode token revoke abc123
```

**Clean up expired tokens:**

```bash
opencode token cleanup
```

### Token Storage

Tokens are stored in: `~/.opencode/tokens.json`

Format:

```json
{
  "tokens": [
    {
      "id": "abc123",
      "name": "My iPhone",
      "token": "full_token_string",
      "created": 1234567890,
      "expires": 1234567890
    }
  ]
}
```

## Configuration

### Environment Variables

```bash
# enable auth system
OPENCODE_AUTH_ENABLED=true

# session timeout (milliseconds)
OPENCODE_SESSION_TIMEOUT=7200000  # 2 hours

# server port
OPENCODE_SERVER_PORT=4096
```

### Development Setup

1. **Start OpenCode server with auth:**

```bash
OPENCODE_AUTH_ENABLED=true opencode serve --port 4096
```

2. **Generate mobile token:**

```bash
opencode token generate --name "Dev Phone"
```

3. **Start mobile dev server:**

```bash
cd packages/mobile-web && bun dev
```

4. **Access mobile app:**

- Open `http://localhost:5173` on your phone
- Use server URL: `http://your-computer-ip:4096`
- Enter the generated token

## Debugging

### Server Debugging

**Check active sessions:**

```typescript
// in server code
console.log("Active sessions:", SessionRegistry.getSessions())
```

**Check token validation:**

```typescript
// in auth routes
console.log("Token valid:", await ServerAuth.validateToken(token))
```

### Mobile Client Debugging

**Check auth state:**

```typescript
// in any solid component
const { authState } = useAuth()
console.log("Auth state:", authState())
```

**Check SSE connection:**

```typescript
// in sse service
console.log("SSE state:", this.readyState)
console.log("Last message:", this.lastMessage)
```

### Network Debugging

**Test auth endpoint:**

```bash
curl -X POST http://localhost:4096/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "your_token"}'
```

**Test session list:**

```bash
curl -H "Authorization: Bearer your_token" \
  http://localhost:4096/auth/sessions
```

## Common Issues

### Authentication Problems

**"Invalid token" error:**

- Check token hasn't expired (30 days)
- Verify `OPENCODE_AUTH_ENABLED=true` is set
- Make sure token was generated correctly

**"Connection failed" error:**

- Check server is running on correct port
- Verify network connectivity (firewall, etc.)
- Try accessing server URL directly in browser

### Session Issues

**Sessions not showing:**

- Make sure a desktop session is actually running
- Check session hasn't timed out (2 hour default)
- Verify session registry is initialized

**Can't connect to session:**

- Session might have ended on desktop
- Check if maximum clients reached
- Verify session ID is correct

### Mobile PWA Issues

**App not installing:**

- PWA requires HTTPS (except localhost)
- Check manifest.json is loading correctly
- Verify service worker registration

**Theme not persisting:**

- Check localStorage is working
- Verify theme context is properly wrapped
- Look for console errors in theme toggle

## File Locations Quick Reference

**Server Components:**

- Session registry: `packages/opencode/src/server/session-registry.ts`
- Authentication: `packages/opencode/src/server/auth.ts`
- Auth routes: `packages/opencode/src/server/routes/auth.ts`
- Enhanced session routes: `packages/opencode/src/server/routes/session.ts`
- Server integration: `packages/opencode/src/server/server.ts`

**CLI Commands:**

- Token management: `packages/opencode/src/cli/cmd/token.ts`
- CLI integration: `packages/opencode/src/index.ts`

**Mobile Client:**

- Full app: `packages/mobile-web/src/`
- Main components: `packages/mobile-web/src/pages/`
- State management: `packages/mobile-web/src/contexts/`
- API layer: `packages/mobile-web/src/services/`

**Configuration:**

- Token storage: `~/.opencode/tokens.json`
- PWA manifest: `packages/mobile-web/public/manifest.json`
- Build config: `packages/mobile-web/vite.config.ts`

This system provides a solid foundation for mobile access while keeping the existing OpenCode experience intact. The architecture is designed to be extensible - you can easily add new mobile features or enhance the PWA capabilities.
