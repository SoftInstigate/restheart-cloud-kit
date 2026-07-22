---
type: Architecture
title: Token Delivery
description: Explains the two authentication modes (bearer and cookie) in RESTHeart Cloud Kit, including how tokens are delivered, stored, and refreshed.
tags: [architecture, authentication, tokens, bearer, cookie, ssr]
---

# Token Delivery

This document explains the two authentication modes in RESTHeart Cloud Kit: bearer token and cookie mode. It covers how tokens are delivered, stored, and refreshed, and provides guidance on choosing the right mode for your application.

## Overview

RESTHeart Cloud Kit supports two authentication modes:

| Mode | Token Storage | Delivery | Use Case |
|------|---------------|----------|----------|
| **Bearer** (default) | localStorage | `Authorization: Bearer <token>` header | Cross-origin SPAs |
| **Cookie** | HttpOnly cookie | Automatic cookie | Same-origin only |

**Recommendation**: Use bearer mode unless you have a same-origin setup where the app and API share the same domain.

## Bearer Token Mode

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser                                   │
├─────────────────────────────────────────────────────────────┤
│  localStorage                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  rh_access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6I..." │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Memory fallback (when localStorage unavailable)            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  _memoryToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6I..."    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │
         │ Authorization: Bearer <token>
         ▼
┌─────────────────────────────────────────────────────────────┐
│              RESTHeart Cloud API                             │
└─────────────────────────────────────────────────────────────┘
```

### Token Flow

1. **Login**: `POST /token` returns JWT in response body
2. **Storage**: Token stored in `localStorage` (with in-memory fallback)
3. **Requests**: `apiFetch()` attaches `Authorization: Bearer <token>` header
4. **Refresh**: Proactive refresh at 80% of TTL (~12 minutes)
5. **Logout**: Token removed from storage

### Token Delivery Parameter

When using bearer mode, the `delivery=body` query parameter tells the backend to return the token in the response body:

```typescript
// Login
POST /token?delivery=body

// Activate account
PATCH /auth/activate?delivery=body

// Reset password
PATCH /auth/reset-password?delivery=body

// Switch team
POST /auth/switch-team?delivery=body
```

### Response Format

**Bearer mode response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

Or token in `Auth-Token` header:
```
Auth-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Cookie Mode

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser                                   │
├─────────────────────────────────────────────────────────────┤
│  HttpOnly Cookie (managed by backend)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Name: (RESTHeart default)                            │  │
│  │  Value: JWT                                           │  │
│  │  HttpOnly: true                                       │  │
│  │  Secure: true (production)                            │  │
│  │  SameSite: Strict                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Cookie sent automatically with requests                    │
└─────────────────────────────────────────────────────────────┘
         │
         │ Cookie: <name>=<jwt>
         ▼
┌─────────────────────────────────────────────────────────────┐
│              RESTHeart Cloud API                             │
└─────────────────────────────────────────────────────────────┘
```

### Token Flow

1. **Login**: `POST /token/cookie` sets HttpOnly cookie
2. **Storage**: Cookie managed by browser (not accessible to JavaScript)
3. **Requests**: Cookie sent automatically
4. **Refresh**: Backend manages refresh (cookie updated)
5. **Logout**: Backend clears cookie

### Token Delivery Parameter

When using cookie mode, the `delivery=cookie` query parameter tells the backend to set a cookie:

```typescript
// Login
POST /token/cookie?delivery=cookie

// Activate account
PATCH /auth/activate?delivery=cookie

// Reset password
PATCH /auth/reset-password?delivery=cookie

// Switch team
POST /auth/switch-team?delivery=cookie
```

### Response Format

**Cookie mode response**:
```json
{
  "message": "Login successful"
}
```

No token in response body — it's in the HttpOnly cookie.

## Why Cookie Mode is Not Available for Normal Deployments

### The Third-Party Cookie Problem

RESTHeart Cloud services live on `*.restheart.com`, while your app lives on your own domain:

```
myservice.restheart.com ──Set-Cookie──▶ browser     cookie domain: .restheart.com
app.yourdomain.com      ── the page that must authenticate
```

**Different registrable domains** = third-party cookie

**Browser behavior**:
- **Safari**: Blocks third-party cookies by default
- **Firefox**: Blocks third-party cookies by default
- **Chrome**: Left to user (will phase out)

**Result**: Cookie is blocked regardless of CORS configuration.

### When Cookie Mode Works

Cookie mode only works when app and API share the same origin:

```
myservice.restheart.com (API)  ──Set-Cookie──▶ browser
myservice.restheart.com (App)  ── served from same origin
```

**Same origin** = first-party cookie = always allowed

## SSR Frameworks: A Different Cookie

### The Misconception

Developers often think SSR frameworks (Next.js, Nuxt) need RESTHeart cookie mode. **They don't.**

### What Actually Happens

```
┌─────────────────────────────────────────────────────────────┐
│                    SSR Framework                             │
├─────────────────────────────────────────────────────────────┤
│  Your server (Next.js, Nuxt)                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  First-party cookie (on your domain)                  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  rh_session: "eyJhbGciOiJIUzI1NiIsInR5cCI6I..."│  │  │
│  │  │  HttpOnly: true                                 │  │  │
│  │  │  Domain: app.yourdomain.com                     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Server reads cookie, sends Bearer token to API             │
└─────────────────────────────────────────────────────────────┘
         │
         │ Bearer: <token>
         ▼
┌─────────────────────────────────────────────────────────────┐
│              RESTHeart Cloud API                             │
└─────────────────────────────────────────────────────────────┘
```

### The Key Insight

- **Your server's cookie**: First-party, same domain, always works
- **RESTHeart's cookie**: Third-party, different domain, usually blocked
- **Solution**: Your server manages its own cookie, sends Bearer token to API

### Token Lifecycle in SSR

1. **Browser → Server**: First-party cookie (your domain)
2. **Server → API**: Bearer token (server-to-server, no CORS, no browser)
3. **API → Server**: Token in response body
4. **Server → Browser**: Updated first-party cookie

**RESTHeart is not aware the cookie exists** — it only sees Bearer tokens.

## Choosing the Right Mode

### Decision Matrix

| Scenario | Mode | Reason |
|----------|------|--------|
| Angular/React/Vue SPA | Bearer | Cross-origin (default) |
| Next.js/Nuxt SSR | Bearer | Server manages its own cookie |
| Same-origin deployment | Cookie | First-party cookie works |
| Mobile app | Bearer | No cookie support |
| Embedded widget | Bearer | Cross-origin |

### When to Use Cookie Mode

**Only when**:
- App and API share the same origin (same domain)
- You want HttpOnly cookie security
- You don't need to read the token in JavaScript

**Example**: Self-hosted RESTHeart where app and API are on the same server.

### When to Use Bearer Mode

**Always when**:
- App and API are on different domains (most cases)
- Using RESTHeart Cloud (*.restheart.com)
- Building SPAs (Angular, React, Vue)
- Building SSR apps (Next.js, Nuxt)
- Need to read token in JavaScript
- Building mobile apps

## Implementation Details

### Bearer Mode in Code

```typescript
// Login
const user = await login(config, email, password, 'bearer');

// Token stored in localStorage
const token = getToken(); // Returns JWT

// Token attached to requests automatically
await apiFetch(config, '/some-endpoint');
// Sends: Authorization: Bearer <token>
```

### Cookie Mode in Code

```typescript
// Login
const user = await login(config, email, password, 'cookie');

// Token NOT in localStorage
const token = getToken(); // Returns null

// Cookie sent automatically
await apiFetch(config, '/some-endpoint');
// Sends: Cookie: <name>=<jwt>
```

### Mixed Mode (Not Supported)

**Don't mix modes in the same session**:

```typescript
// BAD: Mixing modes
await login(config, email, password, 'bearer');
await switchTeam(config, teamId, 'cookie'); // Don't do this

// GOOD: Consistent mode
await login(config, email, password, 'bearer');
await switchTeam(config, teamId, 'bearer');
```

## Token Refresh

### Bearer Mode Refresh

**Strategy**: Proactive refresh at 80% of TTL

```
Token created (TTL = 15 min)
         │
         ▼
Schedule refresh at 12 min (80% of 15 min)
         │
         ▼
After 12 min:
  GET /token?renew
         │
         ▼
New token returned (TTL = 15 min)
         │
         ▼
Reschedule refresh at 12 min
         │
         ▼
... (cycle continues)
```

**Code**:
```typescript
// Called automatically by login()
scheduleRefresh(config);

// Manual cancellation
cancelRefresh();
```

### Cookie Mode Refresh

**Strategy**: Backend manages refresh

- Cookie updated by backend on each request
- No client-side refresh logic
- Token lifetime managed server-side

## Security Considerations

### Bearer Mode Security

**Risks**:
- Token accessible to JavaScript (XSS vulnerability)
- Token in localStorage (persistent)
- Token sent in header (visible in DevTools)

**Mitigations**:
- Use HTTPS
- Implement CSP headers
- Sanitize user input
- Short token TTL (15 minutes)
- Proactive refresh

### Cookie Mode Security

**Benefits**:
- HttpOnly: Not accessible to JavaScript
- Secure: Only sent over HTTPS
- SameSite: CSRF protection

**Risks**:
- Third-party cookie blocking
- CSRF attacks (mitigated by SameSite)

### Best Practices

1. **Always use HTTPS** in production
2. **Use short token TTLs** (15 minutes is good)
3. **Implement proactive refresh** (prevents token expiry)
4. **Clear tokens on logout** (don't leave stale tokens)
5. **Handle 401 errors gracefully** (clear session, redirect to login)

## Troubleshooting

### Issue: Token not stored after login

**Bearer mode**:
- Check localStorage in DevTools
- Look for `rh_access_token` key
- Verify no errors in console

**Cookie mode**:
- Check Application → Cookies in DevTools
- Look for RESTHeart cookie
- Verify SameSite and Secure flags

### Issue: Requests not authenticated

**Bearer mode**:
- Check Authorization header in Network tab
- Verify token is not expired
- Check CORS configuration

**Cookie mode**:
- Check if cookie is sent (Network tab)
- Verify cookie is not blocked (third-party)
- Check SameSite attribute

### Issue: Token refresh fails

**Bearer mode**:
- Check network connectivity
- Verify RESTHeart Cloud is accessible
- Look for errors in console

**Cookie mode**:
- Backend manages refresh
- Check server logs

### Issue: CORS errors

**Bearer mode**:
- Verify `apiBaseUrl` is correct
- Check RESTHeart Cloud CORS configuration
- Ensure Authorization header is allowed

**Cookie mode**:
- CORS doesn't apply (same-origin)
- Check if cookie is blocked (third-party)

## Migration Guide

### From Cookie to Bearer

1. Update all `login()` calls to use `'bearer'` mode
2. Update all `activate()`, `resetPassword()`, `switchTeam()` calls
3. Clear old cookies (if any)
4. Test token storage and refresh

### From Bearer to Cookie

1. Ensure same-origin deployment
2. Update all calls to use `'cookie'` mode
3. Clear localStorage tokens
4. Verify cookie is set and sent

## Future Considerations

### HTTP-Only Cookie with CSRF Protection

- Same-origin cookie with CSRF token
- Double-submit cookie pattern
- Synchronizer token pattern

### Refresh Token Rotation

- Separate refresh token
- One-time use refresh tokens
- Automatic rotation on use

### Device-Specific Tokens

- Different tokens per device
- Device fingerprinting
- Revocation per device

### OAuth2/OIDC Integration

- Standard OAuth2 flows
- OpenID Connect support
- Social login integration
