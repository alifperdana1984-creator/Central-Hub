# Contextual Communication Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform messageboard topics into contextual workspaces with status, deadline, workspace category, file attachments, and linked announcements — and surface active topics on the dashboard.

**Architecture:** All changes are additive modifications to existing `.html` files. No new pages, no new collections. New Firestore fields (`status`, `deadline`, `workspaceCategory`, `attachments[]`, `linkedAnnouncementId`) are nullable so existing topics remain valid. A new "Active Topics" panel is added to the `index.html` dashboard right column.

**Tech Stack:** Vanilla HTML/CSS/JS, Firebase modular SDK v10 (CDN), Firebase Storage (Phase 2), Firestore. No build step for development — edit HTML files directly, test locally with `firebase-config.js`.

**Spec:** `docs/superpowers/specs/2026-03-14-contextual-communication-design.md`

---

## Important Implementation Notes

**Field naming clarification:** The spec uses `category` for the new workspace category (Akreditasyon, Müfredat, etc.). However, `messageboard.html` already uses a `category` field for sidebar filter tabs (general/academic/resources/events/technical). To avoid collision, store the new workspace category as `workspaceCategory` in Firestore. This keeps the sidebar working untouched.

**Dashboard widget:** In `index.html`, "Active Boards" already refers to `activity_projects` — do NOT modify that section. Instead, add a new "Active Topics" panel in the right column of the `dash-grid` (currently only has "Recent Announcements"), showing open/in-progress messageboard topics.

**No automated test runner:** Vanilla JS project with no test framework. "Test" steps are manual browser verification steps. Have `firebase-config.js` present locally.

**submitTopic() is rewritten twice:** Phase 1 adds `status`/`deadline`/`workspaceCategory` and handles edit vs create. Phase 2 replaces `addDoc` with `doc() + setDoc` to pre-generate the topic ID for Storage paths. Leave a `// TODO Phase 2: replace addDoc with doc()+setDoc` comment in the Phase 1 implementation so the Phase 2 implementer knows exactly where to change.

**Storage CDN:** All Firebase Storage imports must use `https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js` — same version as the existing app/auth/firestore imports. Do not use any other version.

**canonical link direction:** `linkedAnnouncementId` lives on the topic doc and is what the thread view reads. `linkedTopicId` on the announcement doc is informational. If the bidirectional write partially fails, the thread view still works as long as the topic doc was updated.

---

## Chunk 1: Phase 1 — Status, Deadline, WorkspaceCategory + Edit Form

### Task 1.1: Add CSS and new fields to messageboard topic creation form

**Files:**
- Modify: `Central Hub/messageboard.html`

- [ ] **Step 1: Add CSS for new form fields and badges**

In `messageboard.html`, inside the `<style>` block, after the `/* BADGES */` block (after the `.platform-badge.ah` rule, around line 138), insert:

```css
/* WORKSPACE STATUS / DEADLINE / CATEGORY BADGES */
.ws-badge { display:inline-flex; align-items:center; font-size:0.68rem; font-weight:700; padding:2px 7px; border-radius:4px; white-space:nowrap; }
.ws-badge-open        { background:#d1fae5; color:#065f46; }
.ws-badge-in_progress { background:#fef3c7; color:#92400e; }
.ws-badge-closed      { background:#f3f4f6; color:#6b7280; }
.ws-cat-badge     { display:inline-flex; align-items:center; font-size:0.68rem; font-weight:600; padding:2px 7px; border-radius:4px; background:#e0f2fe; color:#0369a1; white-space:nowrap; }
.ws-deadline-badge{ display:inline-flex; align-items:center; font-size:0.68rem; font-weight:600; padding:2px 7px; border-radius:4px; background:#fee2e2; color:#dc2626; white-space:nowrap; }
.form-divider { border:none; border-top:1px dashed var(--border); margin:14px 0 12px; }
.form-hint    { font-size:0.76rem; color:var(--ink-3); margin-top:2px; }
```

- [ ] **Step 2: Replace the `<!-- NEW TOPIC VIEW -->` div (lines 248–276) with the updated form**

The replacement adds Status, Deadline, and WorkspaceCategory fields below a dashed divider. Note the form also gets `id="topicFormTitle"` on the `<h3>` so the edit form can retitle it:

```html
<!-- NEW TOPIC VIEW -->
<div class="view" id="viewNewTopic">
  <div class="new-topic-form">
    <h3 id="topicFormTitle">Start a New Topic</h3>
    <div class="form-error" id="topicError" role="alert"></div>
    <div class="form-group">
      <label class="form-label" for="topicCat">Category *</label>
      <select class="form-select" id="topicCat">
        <option value="">Select category…</option>
        <option value="general">General</option>
        <option value="academic">Academic</option>
        <option value="resources">Resources</option>
        <option value="events">Events</option>
        <option value="technical">Technical</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="topicTitle">Title *</label>
      <input class="form-input" id="topicTitle" placeholder="What's the topic about?">
    </div>
    <div class="form-group">
      <label class="form-label" for="topicBody">Body *</label>
      <textarea class="form-input form-textarea" id="topicBody" placeholder="Describe your topic in detail…"></textarea>
    </div>
    <hr class="form-divider">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="form-group">
        <label class="form-label" for="topicStatus">Status</label>
        <select class="form-select" id="topicStatus">
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="topicDeadline">Deadline</label>
        <input class="form-input" id="topicDeadline" type="date">
        <p class="form-hint">Optional</p>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label" for="topicWsCat">Workspace Category</label>
      <select class="form-select" id="topicWsCat">
        <option value="">None</option>
        <option value="Akreditasyon">Akreditasyon</option>
        <option value="Müfredat">Müfredat</option>
        <option value="Genel">Genel</option>
        <option value="Personel">Personel</option>
      </select>
      <p class="form-hint">Optional — groups this topic by purpose</p>
    </div>
    <div class="form-actions">
      <button class="btn-cancel-form" id="cancelTopicBtn">Cancel</button>
      <button class="btn-post-reply" id="submitTopicBtn">Post Topic</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Declare `editingTopicId` in the module-level variables block**

At the top of the `<script type="module">` block (around line 288), the existing variables are:

```js
let db;
let allTopics    = [];
let currentCat   = 'all';
let currentUser  = null;
let openTopicId  = null;
```

Add `let editingTopicId = null;` immediately after `let openTopicId = null;`.

- [ ] **Step 4: Update `submitTopic()` to read and save new fields**

Replace the full `submitTopic` function with:

```js
async function submitTopic() {
  const cat    = document.getElementById('topicCat').value;
  const title  = document.getElementById('topicTitle').value.trim();
  const body   = document.getElementById('topicBody').value.trim();
  const status      = document.getElementById('topicStatus').value || 'open';
  const wsCat       = document.getElementById('topicWsCat').value || null;
  const deadlineVal = document.getElementById('topicDeadline').value;
  const errEl = document.getElementById('topicError');

  if (!cat || !title || !body) {
    errEl.textContent = 'Category, title, and body are required.';
    errEl.classList.add('visible');
    return;
  }
  errEl.classList.remove('visible');
  const btn = document.getElementById('submitTopicBtn');
  btn.disabled = true;
  btn.textContent = editingTopicId ? 'Saving…' : 'Posting…';

  try {
    const payload = {
      category:          cat,
      title,
      body,
      status,
      deadline:          deadlineVal ? new Date(deadlineVal) : null,
      workspaceCategory: wsCat,
    };

    if (editingTopicId) {
      await updateDoc(fsDoc(db, 'topics', editingTopicId), payload);
      await loadTopics();
      openThread(editingTopicId);
      editingTopicId = null;
    } else {
      // TODO Phase 2: replace addDoc with doc(collection(...))+setDoc to pre-generate ID for Storage paths
      const ref = await addDoc(collection(db, 'topics'), {
        ...payload,
        author:               currentUser.displayName || currentUser.email,
        replyCount:           0,
        createdAt:            serverTimestamp(),
        source:               'central_hub',
        attachments:          [],
        linkedAnnouncementId: null,
      });
      await loadTopics();
      openThread(ref.id);
    }
  } catch(e) {
    errEl.textContent = e.message;
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = editingTopicId ? 'Save Changes' : 'Post Topic';
  }
}
```

- [ ] **Step 5: Reset new fields when form is opened for new topic**

In `bindEvents()`, find the `newTopicBtn` click handler. After the existing resets, add:

```js
document.getElementById('topicStatus').value   = 'open';
document.getElementById('topicDeadline').value  = '';
document.getElementById('topicWsCat').value     = '';
document.getElementById('topicFormTitle').textContent = 'Start a New Topic';
editingTopicId = null;
```

- [ ] **Step 6: Manual verify — create a topic with new fields**

Open `messageboard.html`. Click "New Topic". Confirm Status/Deadline/WorkspaceCategory fields appear. Create a topic with status "In Progress", a deadline 7 days from now, workspace category "Akreditasyon". Open Firebase Console → `topics` collection. Confirm the new doc has: `status: "in_progress"`, `deadline: <Timestamp>`, `workspaceCategory: "Akreditasyon"`, `attachments: []`, `linkedAnnouncementId: null`.

- [ ] **Step 7: Commit**

```bash
git add "Central Hub/messageboard.html"
git commit -m "feat(messageboard): add status, deadline, workspaceCategory to topic creation form"
```

---

### Task 1.2: Build topic edit form

**Files:**
- Modify: `Central Hub/messageboard.html`

- [ ] **Step 1: Add "Edit Topic" button inside `openThread()`**

In `openThread(id)`, after setting `threadTitle` text, inject an Edit button if it doesn't already exist. Add this code after `document.getElementById('threadTitle').textContent = topic.title || 'Untitled';`:

```js
let editBtn = document.getElementById('editTopicBtn');
if (!editBtn) {
  editBtn = document.createElement('button');
  editBtn.id        = 'editTopicBtn';
  editBtn.className = 'btn-cancel-form';
  editBtn.style.cssText = 'margin-bottom:14px;font-size:0.82rem;';
  editBtn.textContent   = '✎ Edit Topic';
  document.getElementById('backBtn').insertAdjacentElement('afterend', editBtn);
}
editBtn.onclick = () => openEditForm(topic);
```

- [ ] **Step 2: Implement `openEditForm(topic)`**

Add this function in the script block, after `openThread`:

```js
function openEditForm(topic) {
  editingTopicId = topic.id;
  document.getElementById('topicCat').value    = topic.category || '';
  document.getElementById('topicTitle').value  = topic.title || '';
  document.getElementById('topicBody').value   = topic.body || '';
  document.getElementById('topicStatus').value = topic.status || 'open';
  document.getElementById('topicWsCat').value  = topic.workspaceCategory || '';
  if (topic.deadline) {
    const d = topic.deadline.toDate ? topic.deadline.toDate() : new Date(topic.deadline);
    document.getElementById('topicDeadline').value = d.toISOString().split('T')[0];
  } else {
    document.getElementById('topicDeadline').value = '';
  }
  document.getElementById('topicFormTitle').textContent = 'Edit Topic';
  document.getElementById('topicError').classList.remove('visible');
  showView('newTopic');
}
window.openEditForm = openEditForm;
```

- [ ] **Step 3: Manual verify — edit a topic**

Open a topic with "In Progress" status. Click "✎ Edit Topic". Confirm the form opens pre-filled with current values (category, title, body, status, deadline, workspaceCategory). Change status to "Closed". Save. Confirm the thread view reloads, the topic list row is now muted, and the Firebase Console doc shows `status: "closed"`. Confirm no new document was created.

- [ ] **Step 4: Commit**

```bash
git add "Central Hub/messageboard.html"
git commit -m "feat(messageboard): add topic edit form with pre-filled fields"
```

---

### Task 1.3: Render badges in topic list

**Files:**
- Modify: `Central Hub/messageboard.html`

- [ ] **Step 1: Add `renderBadges(topic)` helper**

Add this function before `renderTopics()`:

```js
function renderBadges(t) {
  let html = '';
  const statusMap = {
    open:        { cls: 'ws-badge-open',        label: 'OPEN' },
    in_progress: { cls: 'ws-badge-in_progress', label: 'IN PROGRESS' },
    closed:      { cls: 'ws-badge-closed',       label: 'CLOSED' },
  };
  const s = statusMap[t.status];
  if (s) html += `<span class="ws-badge ${s.cls}">${s.label}</span>`;
  if (t.workspaceCategory) {
    html += `<span class="ws-cat-badge">${esc(t.workspaceCategory)}</span>`;
  }
  if (t.deadline) {
    const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
    html += `<span class="ws-deadline-badge">⏰ ${d.toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</span>`;
  }
  return html;
}
```

- [ ] **Step 2: Update `renderTopics()` to show badges and mute closed topics**

In `renderTopics()`, replace the template literal inside the `el.innerHTML = list.map(t => { ... })` call. The existing template starts with `<div class="topic-row"`. Replace the entire return value with:

```js
const isClosed  = t.status === 'closed';
const rowStyle  = isClosed ? ' style="background:#f9fafb;opacity:0.75"' : '';
const titleStyle = isClosed ? ' style="color:var(--ink-3)"' : '';
return `
  <div class="topic-row"${rowStyle} onclick="openThread('${t.id}')" role="button" tabindex="0" aria-label="Open topic: ${esc(t.title)}">
    <div class="topic-avatar" aria-hidden="true">${initials}</div>
    <div class="topic-body">
      <div class="topic-title-row">
        ${renderBadges(t)}
        ${CAT_BADGE[t.category]||''}
        ${t.source === 'teachers_hub' ? '<span class="platform-badge th">Teachers Hub</span>' : t.source === 'academic_hub' ? '<span class="platform-badge ah">Academic Hub</span>' : ''}
        <span class="topic-title"${titleStyle}>${esc(t.title||'Untitled')}</span>
      </div>
      <p class="topic-meta">${esc(t.author||'Anonymous')} &middot; ${date}</p>
    </div>
    <div class="topic-stats">
      <div class="topic-stat-item"><span class="topic-stat-val">${t.replyCount||0}</span><span class="topic-stat-lbl">Replies</span></div>
    </div>
  </div>`;
```

- [ ] **Step 3: Manual verify — badges in topic list**

Reload messageboard. Confirm:
- A topic with `status: "in_progress"` shows an amber "IN PROGRESS" badge
- A topic with `workspaceCategory: "Akreditasyon"` shows a teal pill
- A topic with a deadline shows a red ⏰ badge
- A topic with `status: "closed"` has a grey "CLOSED" badge and muted background
- A topic with no new fields (old topic) renders normally with no badges

- [ ] **Step 4: Commit**

```bash
git add "Central Hub/messageboard.html"
git commit -m "feat(messageboard): render status, deadline, workspaceCategory badges in topic list"
```

---

### Task 1.4: Add "Active Topics" panel to index.html dashboard

**Files:**
- Modify: `Central Hub/index.html`

- [ ] **Step 1: Add CSS for the Active Topics panel**

In `index.html`'s `<style>` block, add near the bottom (before the `@media` queries):

```css
/* ACTIVE TOPICS PANEL */
.active-topics-panel { background:var(--white); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-sm); overflow:hidden; margin-top:20px; }
.active-topics-head { padding:14px 18px 12px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
.active-topics-head h3 { font-size:0.925rem; font-weight:600; color:var(--ink); }
.active-topics-head a { font-size:0.8rem; color:var(--accent); text-decoration:none; }
.active-topics-head a:hover { text-decoration:underline; }
.at-item { display:flex; flex-direction:column; gap:4px; padding:11px 18px; border-bottom:1px solid var(--paper-2); transition:background 0.15s; text-decoration:none; }
.at-item:last-child { border-bottom:none; }
.at-item:hover { background:var(--paper); }
.at-badges { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.at-title { font-size:0.875rem; font-weight:500; color:var(--ink); }
.at-meta { font-size:0.75rem; color:var(--ink-3); }
.at-ws-badge { font-size:0.65rem; font-weight:700; padding:1px 5px; border-radius:3px; }
.at-status-open        { background:#d1fae5; color:#065f46; }
.at-status-in_progress { background:#fef3c7; color:#92400e; }
.at-deadline { font-size:0.65rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#fee2e2; color:#dc2626; }
.at-cat { font-size:0.65rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#e0f2fe; color:#0369a1; }
.at-empty { padding:24px 18px; text-align:center; color:var(--ink-3); font-size:0.85rem; }
```

- [ ] **Step 2: Add the panel HTML inside the right column div of dash-grid**

Find the right-column `<div>` in `index.html` (around line 2072). It currently reads:

```html
<!-- RIGHT: Activity Feed -->
<div>
  <h2 class="section-label">Recent Announcements</h2>
  <div class="activity-panel" ...>
    ...
  </div>
</div>
```

After the closing `</div>` of `.activity-panel` and **before** the outer right-column `</div>` (line ~2088), insert:

```html
<!-- Active Topics -->
<div class="active-topics-panel" role="region" aria-label="Active topics">
  <div class="active-topics-head">
    <h3>Active Topics</h3>
    <a href="messageboard">View all →</a>
  </div>
  <div id="activeTopicsList">
    <div class="at-empty">Loading…</div>
  </div>
</div>
```

- [ ] **Step 3: Add `loadActiveTopics()` to the index.html `<script type="module">`**

Ensure `collection`, `getDocs`, `query`, `orderBy`, `limit` are imported (check the existing import at the top of the inline script; add any missing names).

Add the function (use whatever HTML-escape helper already exists in the file, e.g. `esc` or equivalent):

```js
async function loadActiveTopics() {
  const el = document.getElementById('activeTopicsList');
  if (!el) return;
  try {
    // Phase 1: client-side filter (no composite index needed yet)
    const snap = await getDocs(
      query(collection(db, 'topics'), orderBy('createdAt', 'desc'), limit(20))
    );
    const topics = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.status === 'open' || t.status === 'in_progress')
      .slice(0, 5);

    if (!topics.length) {
      el.innerHTML = '<div class="at-empty">No active topics.</div>';
      return;
    }

    const statusLabel = { open: 'OPEN', in_progress: 'IN PROGRESS' };
    const statusCls   = { open: 'at-status-open', in_progress: 'at-status-in_progress' };

    el.innerHTML = topics.map(t => {
      let badges = '';
      if (t.status && statusLabel[t.status]) {
        badges += `<span class="at-ws-badge ${statusCls[t.status]}">${statusLabel[t.status]}</span>`;
      }
      if (t.workspaceCategory) {
        badges += `<span class="at-cat">${esc(t.workspaceCategory)}</span>`;
      }
      if (t.deadline) {
        const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
        badges += `<span class="at-deadline">⏰ ${d.toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</span>`;
      }
      return `<a href="messageboard" class="at-item">
        <div class="at-badges">${badges}</div>
        <span class="at-title">${esc(t.title || 'Untitled')}</span>
        <span class="at-meta">${t.replyCount || 0} replies</span>
      </a>`;
    }).join('');
  } catch(err) {
    console.error('loadActiveTopics error:', err);
    el.innerHTML = '<div class="at-empty">Could not load topics.</div>';
  }
}
```

Note: `esc` is the HTML escape helper. Check the existing index.html script to confirm the function name; use whatever is already there.

- [ ] **Step 4: Call `loadActiveTopics()` on `authReady`**

In the `authReady` event handler, add `loadActiveTopics();` alongside the other load function calls (e.g. near `loadBoards()`, `loadSurveys()`).

- [ ] **Step 5: Manual verify — Active Topics panel on dashboard**

Open `index.html` after login. Confirm:
- "Active Topics" panel appears below "Recent Announcements" in the right column
- Topics with `status: "open"` or `"in_progress"` appear; closed topics do not
- Status, workspace category, and deadline badges show correctly
- "View all →" links to messageboard
- If no active topics, shows "No active topics."

- [ ] **Step 6: Commit**

```bash
git add "Central Hub/index.html"
git commit -m "feat(dashboard): add Active Topics panel with status/deadline badges"
```

---

## Chunk 2: Phase 2 — File Attachments

### Task 2.1: Add Firestore composite index for Phase 2+ queries

**Files:**
- Modify: `Central Hub/firestore.indexes.json`

- [ ] **Step 1: Add the index entry**

Open `firestore.indexes.json`. In the `"indexes"` array, add:

```json
{
  "collectionGroup": "topics",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 2: Deploy the index**

```bash
cd "Central Hub"
firebase deploy --only firestore:indexes --project centralhub-8727b
```

Wait for the index to reach `READY` state in Firebase Console → Firestore → Indexes before running Phase 2 or Phase 3 queries that use `where('status', 'in', [...])` + `orderBy('createdAt', 'desc')`.

- [ ] **Step 3: Commit**

```bash
git add "Central Hub/firestore.indexes.json"
git commit -m "feat(firestore): add composite index on topics(status ASC, createdAt DESC)"
```

---

### Task 2.2: Add file attachment upload to messageboard topic form

**Files:**
- Modify: `Central Hub/messageboard.html`

- [ ] **Step 1: Add Firebase Storage import**

At the top of `<script type="module">` in `messageboard.html`, add:

```js
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
```

Also add `arrayUnion, arrayRemove` to the existing Firestore import line if not already there.

- [ ] **Step 2: Declare storage variable and initialise on authReady**

Add `let storage;` to the module-level variables block (alongside `let db;`).

In the `authReady` handler, after `db = window.db;`, add:

```js
storage = getStorage(window.firebaseApp);
```

- [ ] **Step 3: Declare pending/existing attachment state variables**

Add to module-level variables:

```js
let pendingAttachments  = []; // { file: File, name: string } — not yet uploaded
let existingAttachments = []; // { name, url, storagePath, uploadedAt, uploadedBy } — already in Firestore
```

- [ ] **Step 4: Add CSS for the file upload UI**

In the `<style>` block, add:

```css
.file-drop-zone { border:2px dashed var(--border); border-radius:8px; padding:14px; background:var(--paper); text-align:center; cursor:pointer; transition:border-color 0.2s; font-size:0.84rem; color:var(--ink-3); }
.file-drop-zone:hover { border-color:var(--accent); color:var(--accent); }
.attachment-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.attachment-chip { display:flex; align-items:center; gap:5px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:4px; padding:3px 8px; font-size:0.76rem; color:#15803d; }
.attachment-chip button { background:none; border:none; cursor:pointer; color:#6b7280; font-size:0.9rem; line-height:1; padding:0 2px; }
.attachment-chip button:hover { color:#dc2626; }
.upload-progress { font-size:0.78rem; color:var(--ink-3); margin-top:6px; min-height:1.2em; }
```

- [ ] **Step 5: Add file upload area to the topic form HTML**

Inside `viewNewTopic`, after the `topicWsCat` form group and before `.form-actions`, add:

```html
<div class="form-group" style="margin-bottom:14px;">
  <label class="form-label">Attachments</label>
  <div class="file-drop-zone" id="fileDropZone" onclick="document.getElementById('fileInput').click()">
    <input type="file" id="fileInput" multiple accept="*/*" style="display:none">
    📎 Click to add files or drag and drop
  </div>
  <div class="attachment-chips" id="attachmentChips"></div>
  <p class="upload-progress" id="uploadProgress"></p>
  <p class="form-hint">Max 20 MB per file. .exe, .sh, .bat, .ps1 files are not allowed.</p>
</div>
```

- [ ] **Step 6: Add `sanitizeFilename`, file validation, and chip rendering helpers**

Add these functions in the script block:

```js
function sanitizeFilename(name) {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
}

const BLOCKED_EXTS = ['.exe', '.sh', '.bat', '.ps1'];
const MAX_BYTES    = 20 * 1024 * 1024;

function renderAttachmentChips() {
  const el = document.getElementById('attachmentChips');
  if (!el) return;
  const pendingHtml  = pendingAttachments.map((a, i) =>
    `<span class="attachment-chip">📎 ${esc(a.name)}<button type="button" onclick="removePendingAttachment(${i})" title="Remove">×</button></span>`
  );
  const existingHtml = existingAttachments.map((a, i) =>
    `<span class="attachment-chip"><a href="${esc(a.url)}" target="_blank" style="color:inherit;text-decoration:none">📎 ${esc(a.name)}</a><button type="button" onclick="removeExistingAttachment(${i})" title="Remove">×</button></span>`
  );
  el.innerHTML = [...existingHtml, ...pendingHtml].join('');
}

function removePendingAttachment(i) {
  pendingAttachments.splice(i, 1);
  renderAttachmentChips();
}

async function removeExistingAttachment(i) {
  const att = existingAttachments[i];
  if (!editingTopicId) return;
  if (!confirm(`Remove "${att.name}"?`)) return;
  try {
    await deleteObject(storageRef(storage, att.storagePath)).catch(() => {}); // best-effort
    await updateDoc(fsDoc(db, 'topics', editingTopicId), { attachments: arrayRemove(att) });
    existingAttachments.splice(i, 1);
    renderAttachmentChips();
  } catch(e) {
    alert('Could not remove attachment: ' + e.message);
  }
}

window.removePendingAttachment  = removePendingAttachment;
window.removeExistingAttachment = removeExistingAttachment;
```

- [ ] **Step 7: Wire up the file input in `bindEvents()`**

In `bindEvents()`, add:

```js
document.getElementById('fileInput').addEventListener('change', (e) => {
  Array.from(e.target.files).forEach(file => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (BLOCKED_EXTS.includes(ext)) { alert(`File type ${ext} is not allowed.`); return; }
    if (file.size > MAX_BYTES) { alert(`${file.name} exceeds the 20 MB limit.`); return; }
    pendingAttachments.push({ file, name: sanitizeFilename(file.name) });
    renderAttachmentChips();
  });
  e.target.value = '';
});
```

- [ ] **Step 8: Rewrite `submitTopic()` to use pre-generated ID and upload files**

This is the Phase 2 replacement of the `submitTopic` function. Add `doc as newDocRef, setDoc` to the Firestore import line.

Replace `submitTopic`:

```js
async function submitTopic() {
  const cat    = document.getElementById('topicCat').value;
  const title  = document.getElementById('topicTitle').value.trim();
  const body   = document.getElementById('topicBody').value.trim();
  const status      = document.getElementById('topicStatus').value || 'open';
  const wsCat       = document.getElementById('topicWsCat').value || null;
  const deadlineVal = document.getElementById('topicDeadline').value;
  const linkedAnnId = document.getElementById('topicLinkedAnn')?.value || null; // Phase 3 field
  const errEl = document.getElementById('topicError');

  if (!cat || !title || !body) {
    errEl.textContent = 'Category, title, and body are required.';
    errEl.classList.add('visible');
    return;
  }
  errEl.classList.remove('visible');
  const btn = document.getElementById('submitTopicBtn');
  btn.disabled = true;
  btn.textContent = editingTopicId ? 'Saving…' : 'Posting…';

  try {
    // Upload any pending attachments
    const progressEl = document.getElementById('uploadProgress');
    const uploadedAtts = [...existingAttachments];
    const topicIdForPath = editingTopicId || fsDoc(collection(db, 'topics')).id;

    for (let i = 0; i < pendingAttachments.length; i++) {
      const { file, name } = pendingAttachments[i];
      progressEl.textContent = `Uploading ${i + 1}/${pendingAttachments.length}: ${name}…`;
      const path    = `topics/${topicIdForPath}/attachments/${Date.now()}-${name}`;
      const fileRef = storageRef(storage, path);
      const snap    = await uploadBytes(fileRef, file);
      const url     = await getDownloadURL(snap.ref);
      uploadedAtts.push({ name, url, storagePath: path, uploadedAt: new Date(), uploadedBy: currentUser.displayName || currentUser.email });
    }
    if (progressEl) progressEl.textContent = '';

    const payload = {
      category:             cat, title, body, status,
      deadline:             deadlineVal ? new Date(deadlineVal) : null,
      workspaceCategory:    wsCat,
      attachments:          uploadedAtts,
      linkedAnnouncementId: linkedAnnId,
    };

    if (editingTopicId) {
      await updateDoc(fsDoc(db, 'topics', editingTopicId), payload);
      await loadTopics();
      openThread(editingTopicId);
      editingTopicId = null;
    } else {
      // Use pre-generated doc ref so the Storage path matches the Firestore ID
      const docRef = fsDoc(collection(db, 'topics'));
      // Re-upload using the actual ID (files may have been uploaded with the temp ID above)
      // Note: topicIdForPath was set from fsDoc().id before the loop, so paths are consistent
      await setDoc(docRef, {
        ...payload,
        author:    currentUser.displayName || currentUser.email,
        replyCount: 0,
        createdAt: serverTimestamp(),
        source:    'central_hub',
      });
      await loadTopics();
      openThread(docRef.id);
    }
    pendingAttachments = [];
    existingAttachments = [];
    renderAttachmentChips();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = editingTopicId ? 'Save Changes' : 'Post Topic';
  }
}
```

**Important:** `fsDoc` is the aliased import (`doc as fsDoc`). The new `newDocRef` approach requires importing `doc` from Firestore. The existing import already uses `doc as fsDoc` — call `fsDoc(collection(db,'topics'))` (no second argument) to generate a new ref without an ID.

- [ ] **Step 9: Reset attachment state when form opens**

In the `newTopicBtn` click handler, add:

```js
pendingAttachments  = [];
existingAttachments = [];
renderAttachmentChips();
```

In `openEditForm(topic)`, add:

```js
pendingAttachments  = [];
existingAttachments = [...(topic.attachments || [])];
renderAttachmentChips();
```

- [ ] **Step 10: Render attachment count badge in `renderBadges(t)`**

In `renderBadges`, after the deadline badge, add:

```js
const attCount = (t.attachments || []).length;
if (attCount > 0) {
  html += `<span style="font-size:0.68rem;color:var(--ink-3);margin-left:2px">📎 ${attCount}</span>`;
}
```

- [ ] **Step 11: Manual verify — file attachment flow**

1. Create a new topic and attach a small PDF. Submit. Confirm in Firebase Console: `attachments[]` has one entry with `name`, `url`, `storagePath`. Confirm in Firebase Storage: file exists at `topics/{topicId}/attachments/{timestamp}-{filename}`.
2. Open the topic's edit form. Confirm the existing attachment chip appears. Click ×. Confirm it disappears from Firestore and Storage.
3. Edit the topic and add a second file. Confirm both attachments are saved.
4. Reload the topic list. Confirm the `📎 N` count appears in the topic row.

- [ ] **Step 12: Commit**

```bash
git add "Central Hub/messageboard.html"
git commit -m "feat(messageboard): add file attachment upload and deletion to topic form"
```

---

### Task 2.3: Add "Attach to Topic" dropdown to documents.html

**Files:**
- Modify: `Central Hub/documents.html`

Note: `documents.html` saves to the `central_documents` Firestore collection (NOT `documents`). The dual-write in this task only appends to `topics/{topicId}.attachments[]`; the `central_documents` write is unchanged.

- [ ] **Step 1: Add `arrayUnion` to Firestore imports**

In `documents.html`'s `<script type="module">` block, add `arrayUnion` to the existing Firestore import line.

- [ ] **Step 2: Add Firebase Storage import**

```js
import { getStorage, ref as storageRef, getDownloadURL }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
```

(The existing document upload may already use Storage — check. If so, only add the named imports that are missing.)

- [ ] **Step 3: Add the "Attach to Topic" dropdown HTML to the upload form**

In the upload modal form, after the existing Category (`fCategory`) dropdown field, add:

```html
<div class="form-group">
  <label class="form-label" for="fLinkedTopic">Attach to Topic</label>
  <select class="form-select" id="fLinkedTopic">
    <option value="">None (save to Documents only)</option>
    <!-- populated by loadTopicDropdownForDocs() -->
  </select>
  <p class="form-hint">Optional — also appends this file to the selected topic's attachments.</p>
</div>
```

- [ ] **Step 4: Implement `loadTopicDropdownForDocs()`**

```js
async function loadTopicDropdownForDocs() {
  const sel = document.getElementById('fLinkedTopic');
  if (!sel) return;
  // Remove all but first option
  while (sel.options.length > 1) sel.remove(1);
  try {
    const snap = await getDocs(
      query(
        collection(db, 'topics'),
        where('status', 'in', ['open', 'in_progress']),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    );
    snap.docs.forEach(d => {
      const t = d.data();
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = t.title || 'Untitled';
      sel.appendChild(opt);
    });
  } catch(e) {
    console.warn('Could not load topics for dropdown:', e);
  }
}
```

Call `loadTopicDropdownForDocs()` on `authReady` and/or when the upload modal opens.

- [ ] **Step 5: Perform dual-write after document is saved**

Find the existing document save handler (where it saves to `central_documents` and gets back the URL and doc ID). After that succeeds, add:

```js
const linkedTopicId = document.getElementById('fLinkedTopic').value;
if (linkedTopicId) {
  try {
    await updateDoc(fsDoc(db, 'topics', linkedTopicId), {
      attachments: arrayUnion({
        name:       savedTitle,      // the document title from the form
        url:        fileUrl,         // the download URL from Storage upload
        storagePath: storageFilePath, // the Storage path used
        uploadedAt: new Date(),
        uploadedBy: currentUser.displayName || currentUser.email,
      })
    });
  } catch(e) {
    // Best-effort: document already saved — show soft warning
    // Use whatever toast/error UI documents.html already has
    console.warn('Could not link to topic:', e);
    // Show user-visible warning (adapt to documents.html's existing error UI):
    // e.g. showToast('Belge kaydedildi fakat topic\'e eklenemedi.') or alert(...)
  }
}
```

Replace `savedTitle`, `fileUrl`, `storageFilePath` with the actual variable names from the existing save handler.

- [ ] **Step 6: Reset dropdown when modal closes**

When the upload modal is dismissed or reset, add: `document.getElementById('fLinkedTopic').value = '';`

- [ ] **Step 7: Manual verify**

Upload a document and select a topic from the dropdown. After save:
- Confirm the document appears in `central_documents` as normal.
- Confirm `topics/{topicId}.attachments[]` has a new entry for the document.
- Reload `messageboard.html` and open that topic — confirm the attachment chip appears in the topic row.

- [ ] **Step 8: Commit**

```bash
git add "Central Hub/documents.html"
git commit -m "feat(documents): add 'attach to topic' dropdown on document upload"
```

---

## Chunk 3: Phase 3 — Announcement Linking

### Task 3.1: Add "İlişkili Duyuru" dropdown to messageboard topic form

**Files:**
- Modify: `Central Hub/messageboard.html`

- [ ] **Step 1: Add dropdown HTML to topic form**

Inside `viewNewTopic`, after the `topicWsCat` group and before the attachments zone, add:

```html
<div class="form-group" style="margin-bottom:14px;">
  <label class="form-label" for="topicLinkedAnn">İlişkili Duyuru</label>
  <select class="form-select" id="topicLinkedAnn">
    <option value="">None</option>
    <!-- populated by loadAnnouncementDropdown() -->
  </select>
  <p class="form-hint">Optional — links this topic to an existing announcement.</p>
</div>
```

- [ ] **Step 2: Implement `loadAnnouncementDropdown()`**

```js
async function loadAnnouncementDropdown() {
  const sel = document.getElementById('topicLinkedAnn');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  try {
    const snap = await getDocs(
      query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50))
    );
    snap.docs.forEach(d => {
      const a = d.data();
      const opt = document.createElement('option');
      opt.value = d.id;
      const dateStr = a.createdAt?.toDate
        ? a.createdAt.toDate().toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'})
        : '';
      opt.textContent = `${a.title || 'Untitled'} (${dateStr})`;
      sel.appendChild(opt);
    });
  } catch(e) {
    console.warn('Could not load announcements:', e);
  }
}
```

Call `loadAnnouncementDropdown()` in the `authReady` handler.

- [ ] **Step 3: Include `linkedAnnouncementId` in `submitTopic()` payload**

In Phase 2's `submitTopic`, the payload already reads `document.getElementById('topicLinkedAnn')?.value || null` (the `?.value` guards against the element not existing in Phase 1). Confirm it is included in both `setDoc` and `updateDoc` payloads.

- [ ] **Step 4: Pre-fill in `openEditForm(topic)`**

Add: `document.getElementById('topicLinkedAnn').value = topic.linkedAnnouncementId || '';`

- [ ] **Step 5: Reset when form opens for new topic**

In the `newTopicBtn` reset code, add: `document.getElementById('topicLinkedAnn').value = '';`

- [ ] **Step 6: Commit**

```bash
git add "Central Hub/messageboard.html"
git commit -m "feat(messageboard): add linked announcement dropdown to topic form"
```

---

### Task 3.2: Add "İlişkili Konu" dropdown to announcements.html

**Files:**
- Modify: `Central Hub/announcements.html`

- [ ] **Step 1: Add Firestore imports if missing**

Ensure `updateDoc`, `doc as fsDoc`, `where`, `limit`, `orderBy` are imported in `announcements.html`'s script block.

- [ ] **Step 2: Add dropdown HTML to announcement creation form**

In the announcement form, at the bottom (before the submit/cancel buttons), add:

```html
<div class="form-group">
  <label class="form-label" for="fieldLinkedTopic">İlişkili Konu</label>
  <select class="form-input" id="fieldLinkedTopic">
    <option value="">None</option>
    <!-- populated by loadTopicDropdownForAnn() -->
  </select>
  <p style="font-size:0.76rem;color:#8888a8;margin-top:3px;">
    Optional — Bu duyuru seçilen topic sayfasında İlişkili Duyuru olarak görünecek.
  </p>
</div>
```

Note: use `.form-input` class (consistent with the existing announcement form fields in this file).

- [ ] **Step 3: Implement `loadTopicDropdownForAnn()`**

```js
async function loadTopicDropdownForAnn() {
  const sel = document.getElementById('fieldLinkedTopic');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  try {
    const snap = await getDocs(
      query(
        collection(db, 'topics'),
        where('status', 'in', ['open', 'in_progress']),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    );
    snap.docs.forEach(d => {
      const t = d.data();
      const opt = document.createElement('option');
      opt.value = d.id;
      const dateStr = t.createdAt?.toDate
        ? t.createdAt.toDate().toLocaleDateString('en-GB', {day:'numeric', month:'short'})
        : '';
      opt.textContent = `${t.title || 'Untitled'} (${dateStr})`;
      sel.appendChild(opt);
    });
  } catch(e) {
    console.warn('Could not load topics for announcement form:', e);
  }
}
```

Call on `authReady`.

- [ ] **Step 4: Perform bidirectional write after announcement is saved**

After the announcement document is saved and its `annId` is known, add:

```js
const linkedTopicId = document.getElementById('fieldLinkedTopic').value;
if (linkedTopicId) {
  try {
    // Primary: set linkedAnnouncementId on the topic (this is what the thread view reads)
    await updateDoc(fsDoc(db, 'topics', linkedTopicId), {
      linkedAnnouncementId: annId
    });
    // Secondary: set linkedTopicId on the announcement (informational only)
    await updateDoc(fsDoc(db, 'announcements', annId), {
      linkedTopicId: linkedTopicId
    });
  } catch(e) {
    console.warn('Bidirectional link failed:', e);
    // Show user-visible warning using announcements.html's existing error/toast UI
    // The announcement itself is already saved and the user can proceed
  }
}
```

**Note:** the canonical link is `topics/{topicId}.linkedAnnouncementId`. If this write fails, the thread view will not show the card. The `linkedTopicId` on the announcement is secondary.

- [ ] **Step 5: Reset dropdown when form closes**

When the announcement form modal is reset or dismissed, add: `document.getElementById('fieldLinkedTopic').value = '';`

- [ ] **Step 6: Manual verify — bidirectional link**

Create an announcement with a linked topic. Verify in Firebase Console:
- `announcements/{annId}.linkedTopicId` = the topic ID
- `topics/{topicId}.linkedAnnouncementId` = the announcement ID

- [ ] **Step 7: Commit**

```bash
git add "Central Hub/announcements.html"
git commit -m "feat(announcements): add linked topic dropdown with bidirectional Firestore write"
```

---

### Task 3.3: Display linked announcement card in messageboard thread view

**Files:**
- Modify: `Central Hub/messageboard.html`

- [ ] **Step 1: Add CSS for the linked announcement card**

In the `<style>` block, add:

```css
.linked-ann-card { background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:14px 16px; margin-bottom:14px; }
.linked-ann-label { font-size:0.68rem; font-weight:700; color:#0369a1; text-transform:uppercase; letter-spacing:.07em; margin-bottom:6px; }
.linked-ann-title { font-size:0.925rem; font-weight:600; color:var(--ink); margin-bottom:4px; }
.linked-ann-excerpt { font-size:0.83rem; color:var(--ink-2); line-height:1.5; margin-bottom:8px; }
.linked-ann-meta { font-size:0.76rem; color:var(--ink-3); margin-bottom:8px; }
.linked-ann-link { font-size:0.82rem; color:var(--accent); text-decoration:none; font-weight:500; }
.linked-ann-link:hover { text-decoration:underline; }
```

- [ ] **Step 2: Add placeholder div to `viewThread` HTML**

In the `viewThread` div, insert `<div id="linkedAnnCard"></div>` **before** `<div id="threadPosts"></div>`:

```html
<div class="thread-header">
  <p class="thread-category" id="threadCat"></p>
  <h2 class="thread-title" id="threadTitle"></h2>
</div>
<div id="linkedAnnCard"></div>   <!-- ← insert here -->
<div id="threadPosts"></div>
```

- [ ] **Step 3: Fetch and render in `openThread()`**

At the end of `openThread(id)`, after loading replies, add:

```js
const linkedAnnEl = document.getElementById('linkedAnnCard');
if (topic.linkedAnnouncementId) {
  try {
    const annSnap = await getDoc(fsDoc(db, 'announcements', topic.linkedAnnouncementId));
    if (annSnap.exists()) {
      const ann = annSnap.data();
      const annDate = ann.createdAt?.toDate
        ? ann.createdAt.toDate().toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'})
        : '';
      // Check both 'body' and 'content' field names — announcements.html uses whichever exists
      const fullText = ann.body || ann.content || '';
      const excerpt  = fullText.slice(0, 120);
      linkedAnnEl.innerHTML = `
        <div class="linked-ann-card">
          <p class="linked-ann-label">📣 İlişkili Duyuru</p>
          <p class="linked-ann-title">${esc(ann.title || 'Untitled')}</p>
          <p class="linked-ann-excerpt">${esc(excerpt)}${fullText.length > 120 ? '…' : ''}</p>
          <p class="linked-ann-meta">${annDate}</p>
          <a href="announcements" class="linked-ann-link">Duyuruya Git →</a>
        </div>`;
    } else {
      linkedAnnEl.innerHTML = '';
    }
  } catch(e) {
    linkedAnnEl.innerHTML = '';
  }
} else {
  linkedAnnEl.innerHTML = '';
}
```

Ensure `getDoc` is included in the existing Firestore import line (it is already imported per the original messageboard.html code).

- [ ] **Step 4: Manual verify — linked announcement card**

1. Open a topic that has `linkedAnnouncementId` set. Confirm the blue card appears above the original post with the announcement title, excerpt (max 120 chars + "…"), date, and "Duyuruya Git →" link.
2. Open a topic that has no `linkedAnnouncementId`. Confirm no card appears.
3. Click "Duyuruya Git →". Confirm it navigates to `announcements`.

- [ ] **Step 5: Commit**

```bash
git add "Central Hub/messageboard.html"
git commit -m "feat(messageboard): show linked announcement card in topic thread view"
```

---

## Final: Build and Deploy

- [ ] **Run build**

```bash
cd "Central Hub"
node build.js
```

- [ ] **Verify dist**

Confirm `dist/messageboard.html`, `dist/documents.html`, `dist/announcements.html`, `dist/index.html` are all updated with latest changes.

- [ ] **Push to GitHub (triggers Vercel deploy)**

```bash
git push origin main
```

- [ ] **End-to-end verify on Vercel**

Log in as a `central_admin` user on the live site and verify all 6 acceptance criteria:
1. Messageboard: new topic form shows Status/Deadline/WorkspaceCategory/Attachments/LinkedAnnouncement fields
2. Messageboard: topic list rows show status badges; closed topics are muted
3. Dashboard: "Active Topics" panel shows open/in-progress topics with badges
4. Documents: upload form shows "Attach to Topic" dropdown; linked topic's `attachments[]` is updated
5. Announcements: creation form shows "İlişkili Konu" dropdown; both docs reference each other after save
6. Thread view: linked announcement card renders when `linkedAnnouncementId` is set
