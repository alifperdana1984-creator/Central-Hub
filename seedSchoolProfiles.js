/**
 * seedSchoolProfiles.js
 * ─────────────────────────────────────────────────────────────────
 * Reads "resources/School Profile.xlsx" and upserts profile data
 * into the Firestore `schools` collection.
 *
 * Prerequisites:
 *   1. npm install firebase-admin xlsx   (run in this directory)
 *   2. Download service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Save it as serviceAccountKey.json in THIS directory (Central Hub/).
 *
 * Usage:
 *   node seedSchoolProfiles.js
 *   node seedSchoolProfiles.js --dry-run   (preview only, no writes)
 *
 * Behaviour:
 *   - If a school with the same name (case-insensitive) exists in
 *     Firestore, it UPDATES only the profile fields (does not touch
 *     name / types / status / city / socialLinks).
 *   - If no match is found, it CREATES a new document with all fields
 *     inferred from the Excel row.
 * ─────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');
const XLSX  = require('xlsx');
const path  = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Firebase init ──────────────────────────────────────────────────
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Constants ──────────────────────────────────────────────────────
const VALID_TYPES   = ['TK', 'SD', 'SMP', 'SMA'];
const YEAR_KEYS     = [
  '2017_2018','2018_2019','2019_2020','2020_2021',
  '2021_2022','2022_2023','2023_2024','2024_2025','2025_2026_ongoing',
];

// ── Helpers ────────────────────────────────────────────────────────
function parseTypes(level) {
  if (!level) return [];
  return level.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t));
}

function num(val) {
  return (typeof val === 'number' && !isNaN(val)) ? val : null;
}

// ── Read Excel ─────────────────────────────────────────────────────
const xlsxPath = path.join(__dirname, 'resources', 'School Profile.xlsx');
const wb  = XLSX.readFile(xlsxPath);
const ws  = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headers = raw[0];
// Find index of each admission column
const admIdx = {};
for (const key of YEAR_KEYS) {
  // Excel header format: "admission_2017/2018" or "admission_2025/2026_ongoing"
  const xlKey = key === '2025_2026_ongoing'
    ? 'admission_2025/2026_ongoing'
    : `admission_${key.replace('_', '/')}`;
  admIdx[key] = headers.indexOf(xlKey);
}
const totalIdx = headers.indexOf('total_admission_2017_2025');

// Filter to data rows (skip nulls, totals row, and the Key Takeaways note at the bottom)
const dataRows = raw.slice(1).filter(row =>
  row[0] && typeof row[0] === 'string' && row[0].trim() &&
  !row[0].includes('\n') && !row[0].startsWith('Key Takeaways')
);

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📋 Reading ${dataRows.length} schools from Excel…`);
  if (DRY_RUN) console.log('⚠️  DRY RUN — no Firestore writes will happen\n');

  // Fetch all existing school docs
  const snap = await db.collection('schools').get();
  const existing = {};                        // lowercase name → doc id
  snap.forEach(d => {
    if (d.data().name) existing[d.data().name.toLowerCase().trim()] = d.id;
  });
  console.log(`🔍 Found ${snap.size} existing school(s) in Firestore\n`);

  let updated = 0, created = 0, skipped = 0;

  for (const row of dataRows) {
    const schoolName = String(row[0]).trim();

    // Build admissions object (only include years that have a real number)
    const admissions = {};
    for (const key of YEAR_KEYS) {
      const idx = admIdx[key];
      if (idx !== -1) {
        const v = num(row[idx]);
        if (v !== null) admissions[key] = v;
      }
    }

    const profileData = {
      foundation_representative: row[1] ? String(row[1]).trim() : null,
      teaching_staff:     num(row[3]),
      non_teaching_staff: num(row[4]),
      students:           num(row[5]),
      admissions,
      total_admission:    num(row[totalIdx]),
    };

    const matchKey = schoolName.toLowerCase();

    if (existing[matchKey]) {
      // ── UPDATE existing doc (profile fields only) ──────────────
      console.log(`✏️  Update  → ${schoolName}`);
      if (!DRY_RUN) {
        await db.collection('schools').doc(existing[matchKey]).update(profileData);
      }
      updated++;
    } else {
      // ── CREATE new doc ─────────────────────────────────────────
      const types = parseTypes(String(row[2] || ''));
      const newDoc = {
        name:       schoolName,
        types,
        type:       types[0] || '',
        status:     'active',
        city:       '',
        adminEmail: '',
        socialLinks: {},
        createdAt:  admin.firestore.FieldValue.serverTimestamp(),
        ...profileData,
      };
      console.log(`➕ Create  → ${schoolName} (types: ${types.join(', ') || '—'})`);
      if (!DRY_RUN) {
        await db.collection('schools').add(newDoc);
      }
      created++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated : ${updated}`);
  console.log(`   Created : ${created}`);
  if (skipped) console.log(`   Skipped : ${skipped}`);
  if (DRY_RUN) console.log('\n   (No writes — this was a dry run)');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
