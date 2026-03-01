# CentralHub — Architecture Reference

## What This App Is

CentralHub is the super-admin control panel for the Eduversal platform. Only `central_admin` users can access it. It manages schools, staff, announcements, documents, and the message board across the whole platform. It is a **vanilla HTML/CSS/JS application** (no React, no bundler framework). Pages are plain `.html` files with inline scripts that load Firebase via CDN.

**Deployment:** Vercel (build output in `dist/`).

---

## Monorepo Structure

```
Eduversal Web/                    ← monorepo root (not a deployed app)
├── Academic Hub/                 ← analytics dashboards (Vercel)
├── CentralHub/                   ← THIS app (Vercel)
├── Teachers Hub/                 ← teacher tools (Vercel)
├── firestore.rules               ← unified rules, deploy to centralhub-8727b
├── firebase.json                 ← root-level firebase config (rules only)
├── migrate-auth-and-firestore.js ← one-time migration script
└── keys/                         ← service account JSON keys (gitignored)
```

Each app has its **own GitHub repository** and its **own deployment target**, but all three share the single Firebase backend `centralhub-8727b`.

---

## Shared Firebase Backend

**Project ID:** `centralhub-8727b`

| Field                | Value                                      |
|----------------------|--------------------------------------------|
| authDomain           | centralhub-8727b.firebaseapp.com           |
| projectId            | centralhub-8727b                           |
| storageBucket        | centralhub-8727b.firebasestorage.app       |
| messagingSenderId    | 244951050014                               |
| apiKey / appId       | gitignored — see Firebase Console          |

**SDK:** Firebase modular v10 (`10.7.1`), loaded from the CDN:
```
https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js
https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js
https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js
```
Do NOT use the compat SDK (`firebase/app`, `firebase.firestore()` namespace style). Always use modular imports.

---

## Firebase Config Pattern

**`firebase-config.js`** (gitignored) sets `window.ENV` at page load:
```js
window.ENV = {
  FIREBASE_API_KEY: "...",
  FIREBASE_AUTH_DOMAIN: "centralhub-8727b.firebaseapp.com",
  // ...
};
```

All HTML pages load this with:
```html
<script src="firebase-config.js"></script>
```

**`build.js`** generates `dist/firebase-config.js` from Vercel environment variables and copies all HTML/JS/asset files into `dist/`. The `firebase-config.js` source file is NOT deployed — it is only used for local development.

**Template:** `firebase-config.example.js` — copy to `firebase-config.js` and fill in `apiKey` and `appId`.

---

## Auth Pattern

Every protected page (all pages except `login.html`) loads `auth-guard.js` as a module:
```html
<script type="module" src="auth-guard.js"></script>
```

`auth-guard.js` (modular SDK v10):
1. Hides `document.body` immediately (prevents flash of content).
2. Initialises Firebase (guards against double-init with `getApps()`).
3. Listens on `onAuthStateChanged`. If no user → redirects to `login` (clean URL).
4. Fetches `users/{uid}` from Firestore. If missing, creates a profile stub with no role.
5. Role-checks against `['central_admin']`. If not allowed → signs out and redirects to `login?error=access`.
6. Exposes globals and dispatches `authReady`.

**Globals exposed after `authReady`:**
| Global               | Value                                |
|----------------------|--------------------------------------|
| `window.firebaseApp` | FirebaseApp instance                 |
| `window.auth`        | Auth instance                        |
| `window.db`          | Firestore instance                   |
| `window.currentUser` | firebase.User object                 |
| `window.userProfile` | Firestore `users/{uid}` document     |

**Listening for auth in page scripts:**
```js
document.addEventListener('authReady', ({ detail: { user, profile } }) => {
  // safe to use window.db, window.currentUser, window.userProfile here
});
```

**`login.html`** does NOT use `auth-guard.js` — it handles auth inline using the modular SDK, reading config from `window.ENV`.

---

## Role System

Roles are stored in Firestore at `users/{uid}.role` (string field).

| Role                  | Description                          | CentralHub | Academic Hub | Teachers Hub |
|-----------------------|--------------------------------------|:----------:|:------------:|:------------:|
| `central_admin`       | Super-admin, created manually only   | ✓          | ✓            | ✓            |
| `academic_coordinator`| Academic management staff            | ✗          | ✓            | ✓            |
| `teacher`             | Classroom teacher                    | ✗          | ✗            | ✓            |

**CentralHub allowed roles:** `['central_admin']` — the most restrictive app.

`central_admin` accounts are created **manually** in the Firebase Console (email/password), never via self-registration. New users who sign in for the first time get a Firestore profile with **no role**; a `central_admin` must assign a role before they can access any protected page.

---

## Firestore Collections

| Collection              | Purpose                                      | Write access         |
|-------------------------|----------------------------------------------|----------------------|
| `users/{uid}`           | User profiles (uid, email, displayName, photoURL, role, createdAt) | owner or central_admin |
| `schools/{schoolId}`    | Partner school records                       | central_admin        |
| `staff/{staffId}`       | Staff records                                | central_admin        |
| `announcements/{annId}` | Platform-wide announcements                  | central_admin        |
| `central_documents/{docId}` | CentralHub-managed documents (was `documents` before migration) | central_admin |
| `topics/{topicId}`      | Message board topics                         | any authorised user  |
| `topics/{topicId}/replies/{replyId}` | Message board replies           | any authorised user  |

**Timestamp field:** always `createdAt` (serverTimestamp). Do not use `timestamp` — that was the legacy name.

**IMPORTANT — collection rename:** CentralHub's documents collection is `central_documents`, NOT `documents`. The rename happened during the multi-project consolidation to avoid Firestore rule conflicts with the legacy `documents` collection.

**Firestore rules** live at both the monorepo root (`../firestore.rules`) and here in `CentralHub/firestore.rules`. The authoritative copy is the monorepo root. Deploy with:
```
firebase deploy --only firestore:rules --project centralhub-8727b
```

---

## Build & Deployment

**Platform:** Vercel
**Build command:** `node build.js`
**Output directory:** `dist/`

### What `build.js` does:
1. Generates `dist/firebase-config.js` from Vercel environment variables.
2. Copies all HTML files into `dist/`.
3. Copies `auth-guard.js` and `resources/` into `dist/`.

### Vercel environment variables required:
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```

### Firestore rules (separate from hosting):
Rules are deployed independently via the Firebase CLI:
```
firebase deploy --only firestore:rules --project centralhub-8727b
```

---

## Pages

| File                | Clean URL        | Purpose                        |
|---------------------|------------------|--------------------------------|
| `index.html`        | `/`              | Dashboard / home               |
| `login.html`        | `/login`         | Login page (no auth guard)     |
| `announcements.html`| `/announcements` | Create/manage announcements    |
| `messageboard.html` | `/messageboard`  | Platform message board         |
| `schools.html`      | `/schools`       | School management              |
| `staff.html`        | `/staff`         | Staff management               |
| `documents.html`    | `/documents`     | Document management (uses `central_documents` collection) |

---

## Key Files

| File                         | Purpose                                                       |
|------------------------------|---------------------------------------------------------------|
| `auth-guard.js`              | Auth + role gate for all protected pages (modular SDK v10)    |
| `build.js`                   | Vercel build script — generates dist/firebase-config.js, copies assets |
| `firebase.json`              | Firestore rules config (no hosting section used)              |
| `firebase-config.js`         | Local dev config (gitignored)                                 |
| `firebase-config.example.js` | Template for firebase-config.js                               |
| `firestore.rules`            | Firestore security rules (local copy; root is authoritative)  |
| `vercel.json`                | Vercel deployment config (build cmd, output dir)              |
| `resources/`                 | Static assets                                                 |

---

## Important Conventions

- **No React, no npm bundler.** All JS runs directly in the browser via CDN ESM imports.
- **Always use modular SDK v10.** Never use the compat namespace.
- **`createdAt` not `timestamp`** for all Firestore timestamp fields.
- **Never commit `firebase-config.js`.** It is in `.gitignore`.
- **`central_documents` not `documents`** — the collection was renamed during consolidation.
- **Auth guard goes first.** `auth-guard.js` must be the first `<script type="module">` on protected pages.
- **Use `authReady` event** to gate all Firestore reads — never call `window.db` before the event fires.
- **Login redirects use clean URLs:** `login`, not `login.html`. Auth guard redirects to `'login'` and `'login?error=access'`.
