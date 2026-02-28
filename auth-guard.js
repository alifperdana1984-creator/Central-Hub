// ============================================================
// auth-guard.js — CentralHub
// Load AFTER: firebase-app-compat, firebase-auth-compat,
//             firebase-firestore-compat CDN scripts.
// Include on every protected page (NOT on login.html).
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyA0NCwUiks96zpL8mKU4aEXq7Ad7p0l7QE",
  authDomain: "centralhub-8727b.firebaseapp.com",
  projectId: "centralhub-8727b",
  storageBucket: "centralhub-8727b.firebasestorage.app",
  messagingSenderId: "244951050014",
  appId: "1:244951050014:web:3f310da2efcc26f4a2cb0f",
  measurementId: "G-B5FTL2MXDQ"
};

// Guard against double-init when navigating between pages
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const ALLOWED_DOMAINS = ['eduversal.org'];

// Expose shared instances for page scripts
window.db   = firebase.firestore();
window.auth = firebase.auth();

// Returns true if:
//   • email domain is in ALLOWED_DOMAINS (@eduversal.org), OR
//   • user signed in via email/password — meaning they were manually
//     added to Firebase Authentication by an admin (they know the password).
// Google OAuth users with non-allowed domains are always rejected.
function isAuthorized(user) {
  if (ALLOWED_DOMAINS.includes(user.email.split('@')[1])) return true;
  return user.providerData.some(p => p.providerId === 'password');
}

firebase.auth().onAuthStateChanged(async (user) => {
  // 1. Not signed in → go to login
  if (!user) {
    window.location.replace('login.html');
    return;
  }

  // 2. Not authorized (wrong domain AND not a manually-added email/password user)
  if (!isAuthorized(user)) {
    await firebase.auth().signOut();
    window.location.replace('login.html?error=domain');
    return;
  }

  // 3. Valid user — expose globally
  window.currentUser = user;

  // --- Populate nav elements (present on all protected pages) ---
  const navUserName = document.querySelector('.nav-user-name');
  const navAvatar   = document.getElementById('navAvatar');
  const logoutBtn   = document.getElementById('logoutBtn');

  if (navUserName) {
    navUserName.textContent = user.displayName
      ? user.displayName.split(' ')[0]   // first name only
      : user.email;
  }

  if (navAvatar) {
    const initials = user.displayName
      ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
      : user.email[0].toUpperCase();
    navAvatar.textContent = initials;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await firebase.auth().signOut();
      window.location.href = 'login.html';
    });
  }

  // --- Ensure Firestore user profile exists ---
  const userRef = window.db.collection('users').doc(user.uid);
  try {
    const snap = await userRef.get();
    if (!snap.exists) {
      await userRef.set({
        uid:         user.uid,
        email:       user.email,
        displayName: user.displayName || '',
        photoURL:    user.photoURL    || '',
        role:        'viewer',
        school:      '',
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
      });
      window.userProfile = { role: 'viewer' };
    } else {
      window.userProfile = snap.data();
    }
  } catch (err) {
    console.warn('Could not fetch/create user profile:', err);
    window.userProfile = { role: 'viewer' };
  }

  // --- Notify the page that auth + profile are ready ---
  document.dispatchEvent(new CustomEvent('authReady', {
    detail: { user, profile: window.userProfile }
  }));
});
