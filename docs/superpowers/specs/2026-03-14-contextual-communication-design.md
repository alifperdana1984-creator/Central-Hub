# Contextual Communication — Design Spec

**Date:** 2026-03-14
**Platform:** Central Hub (CentralHub)
**Status:** Approved for implementation

---

## Problem

Announcements, documents, and messageboard topics exist on separate pages with no connection to each other. When a topic like "Cambridge Accreditation 2025" is active, the related announcement, supporting documents, and discussion thread are in three different places. There is no shared context tying them together.

---

## Goal

Transform messageboard topics into lightweight contextual workspaces. Each topic can hold a status, deadline, category, attached documents, and a linked announcement — so everything related to one subject lives in one place.

---

## Scope

Four pages are affected:

- `messageboard.html` — topic creation form + topic list view + topic detail view
- `index.html` — Active Boards dashboard widget
- `documents.html` — document upload form
- `announcements.html` — announcement creation form

No new pages are added. No new Firestore collections are created. All changes are additive and backward-compatible.

---

## Data Model

### `topics/{topicId}` — new fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `status` | `'open' \| 'in_progress' \| 'closed'` | `'open'` (pre-selected, user may change) | UI pre-selects `'open'`; user can change before submitting |
| `deadline` | `timestamp \| null` | `null` | Optional |
| `category` | `string \| null` | `null` | Free text, e.g. "Akreditasyon", "Müfredat" |
| `attachments` | `Array<{name, url, storagePath, uploadedAt, uploadedBy}>` | `[]` | Files attached directly to the topic |
| `linkedAnnouncementId` | `string \| null` | `null` | Reference to `announcements/{id}` |

### `announcements/{annId}` — new field

| Field | Type | Default | Notes |
|---|---|---|---|
| `linkedTopicId` | `string \| null` | `null` | Reference to `topics/{id}`; enables bidirectional lookup |

Existing documents without these fields remain valid. All new fields are nullable. Firestore rules do not change — topic writes are already restricted to `central_admin`.

---

## UI Changes

### 1. `messageboard.html` — Topic Creation Form

Add below the existing message body field (separated by a dashed divider):

- **Kategori** — predefined dropdown: Akreditasyon, Müfredat, Genel, Personel (plus free-text option). Optional.
- **Deadline** — date picker. Optional.
- **Status** — dropdown with three options: Open, In Progress, Closed. Pre-selected to `'open'`. User may change before submitting.
- **İlişkili Duyuru** — dropdown (Phase 3 only — not rendered in Phase 1 or 2)
- **Ekler** — drag-and-drop file upload area (Phase 2 only — not rendered in Phase 1)

### 2. `messageboard.html` — Topic Edit Form

The current messageboard has no edit form. An edit form must be built as part of Phase 1. It renders the same fields as the creation form, pre-filled with the current topic values. Only `central_admin` can edit. Replies are not affected.

### 3. `messageboard.html` — Topic List View

Each topic card shows:

- Status badge: `OPEN` (green) / `IN PROGRESS` (amber) / `CLOSED` (grey)
- Category badge: teal pill (if set)
- Deadline badge: red pill with ⏰ icon (if set)
- Attachment count: `📎 N` suffix on the meta line (Phase 2 — rendered only after attachments feature is live; field absent or zero hides the badge)

Closed topics render with muted background (`#f9fafb`) and muted text.

### 4. `index.html` — Active Boards Widget

Updated to show per-topic:

- Status badge (9px)
- Category badge (if set)
- Deadline badge (red, if set)
- Attachment count suffix `📎 N` (Phase 2)

Only `open` and `in_progress` topics appear. Closed topics are excluded. Query: `where('status', 'in', ['open', 'in_progress'])`, ordered by `createdAt` descending, limit 5.

### 5. `documents.html` — Upload Form

Add one optional field after the existing category dropdown:

- **Topic'e Ekle** — dropdown populated from open/in-progress topics (ordered by `createdAt` descending, limit 50). Selecting a topic triggers the dual-write described in the Phase 2 write strategy below.

### 6. `announcements.html` — Creation Form

Add one optional field at the bottom of the form:

- **İlişkili Konu** — dropdown populated from open/in-progress topics (ordered by `createdAt` descending, limit 50, showing title + creation date).

A note below the field: *"Bu duyuru seçilen topic sayfasında İlişkili Duyuru olarak görünecek."*

Write sequence on save:
1. Save the announcement document → get back `announcementId`
2. If a topic was selected: `updateDoc(topicRef, { linkedAnnouncementId: announcementId })`
3. Also write `linkedTopicId: topicId` onto the announcement document via a second `updateDoc`

If step 2 or 3 fails after the announcement is saved, show an error toast: *"Duyuru kaydedildi fakat topic bağlantısı kurulamadı."* The announcement itself is not rolled back.

---

## Write Strategies for Dual-Collection Operations

### Phase 2 — Document attached to topic from `documents.html`

When the user selects a topic and saves the document:

1. Upload file to Firebase Storage at `topics/{topicId}/attachments/{timestamp}-{sanitizedFilename}` (timestamp prefix prevents collision)
2. Save the document to `central_documents` collection
3. Use `updateDoc` with `arrayUnion` to append the attachment entry to `topics/{topicId}.attachments[]`

Steps 2 and 3 are not wrapped in a transaction (cross-collection transactions are possible but add complexity). Strategy: best-effort — if step 3 fails, show error toast *"Belge kaydedildi fakat topic'e eklenemedi."* The central_documents entry is not rolled back. The user can retry linking manually from the messageboard edit form.

### Phase 3 — Announcement linked to topic from `announcements.html`

Write sequence defined above in section 6. Same best-effort strategy on partial failure.

---

## Storage Path Convention

All topic attachments use the path: `topics/{topicId}/attachments/{Date.now()}-{sanitizedFilename}`

`sanitizedFilename` is computed as: `filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')`. This prevents URL encoding issues and filename collisions.

**File constraints (client-side validation):** max 20 MB per file; executable extensions (`.exe`, `.sh`, `.bat`, `.ps1`) are rejected with an error message before upload begins.

## Attachment Deletion

When a user removes an attachment from the topic edit form:

1. Call `deleteObject` on the Firebase Storage reference (`storagePath` field from the attachment entry)
2. Call `updateDoc` with `arrayRemove` to remove the entry from `topics/{topicId}.attachments[]`

Best-effort: if Storage delete succeeds but Firestore update fails (or vice versa), show error toast. Orphaned Storage files at this scale are acceptable; no background cleanup job is needed.

## Firestore Index Requirement

The query used in Active Boards widget, documents.html, and announcements.html dropdowns — `where('status', 'in', ['open', 'in_progress']), orderBy('createdAt', 'desc')` — requires a composite index on the `topics` collection: `(status ASC, createdAt DESC)`. This index must be created in the Firebase Console (or `firestore.indexes.json`) before Phase 2 goes live. Phase 1 does not use this query on the dashboard (it can use a simpler `orderBy('createdAt', 'desc')` and filter client-side since topics are few).

---

## Implementation Phases

### Phase 1 — Status, Deadline, Category + Edit Form

**Files changed:** `messageboard.html`, `index.html`

- Add `status` (pre-selected dropdown), `deadline` (date picker), `category` (dropdown) to topic creation form
- Build topic edit form (same fields, pre-filled)
- Render status + deadline + category badges in topic list (attachment badge hidden until Phase 2)
- Update `index.html` Active Boards widget to show badges; filter closed topics out

**Deliverable:** Topics have structure and urgency at a glance on both the messageboard and dashboard.

### Phase 2 — File Attachments

**Files changed:** `messageboard.html`, `documents.html`

- Add drag-and-drop file upload to topic creation and edit form
- Storage path: `topics/{topicId}/attachments/{timestamp}-{sanitizedFilename}`
- Write `attachments[]` to topic document on save
- Render `📎 N` attachment chips in topic list and dashboard widget
- Add "Topic'e Ekle" dropdown to `documents.html` upload form with best-effort dual-write

### Phase 3 — Announcement Linking

**Files changed:** `messageboard.html`, `announcements.html`

- Add "İlişkili Duyuru" dropdown to topic creation/edit form; populate from announcements (ordered by `createdAt` desc, limit 50)
- Add "İlişkili Konu" dropdown to announcement creation form; populate from open/in-progress topics (ordered by `createdAt` desc, limit 50)
- Write sequence on save: save announcement → update topic `linkedAnnouncementId` → update announcement `linkedTopicId`
- In `messageboard.html` topic detail view, if `linkedAnnouncementId` is set, fetch and display the linked announcement as a highlighted card showing: title, first 120 characters of body, creation date, and a "Duyuruya Git →" link to `announcements.html`

---

## Out of Scope

- No changes to Firestore rules
- No new collections
- No read-receipt or notification system (separate feature area)
- No school-level scoping (topics remain platform-wide)
- No mobile-specific layout changes
- No full-text search on the topic dropdown — limit 50 ordered by recency is sufficient at current scale

---

## Success Criteria

- A `central_admin` can create a topic with status, deadline, and category in one form submission
- A `central_admin` can edit an existing topic's status, deadline, category, and attachments
- The dashboard Active Boards widget shows status and deadline without navigating away
- A document uploaded via `documents.html` can be attached to a topic in the same upload flow
- An announcement can be linked to a topic; both documents reference each other (`linkedAnnouncementId` on topic, `linkedTopicId` on announcement)
- Partial write failures surface as error toasts without data loss
