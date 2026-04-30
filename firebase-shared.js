/**
 * firebase-shared.js
 * ملف مشترك — يُستدعى من index.html / services.html / checkout.html / profile.html
 * استخدام: <script type="module" src="firebase-shared.js"></script>
 */

import { initializeApp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore,
    doc, getDoc, updateDoc, increment,
    collection, addDoc, query, where, getDocs,
    serverTimestamp, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── Config ── */
const firebaseConfig = {
    apiKey:            "AIzaSyC2OC1cAlWwY2CJ80cIGJE8_LFOG5UglCE",
    authDomain:        "sombl-studio.firebaseapp.com",
    projectId:         "sombl-studio",
    storageBucket:     "sombl-studio.firebasestorage.app",
    messagingSenderId: "612989064432",
    appId:             "1:612989064432:web:4b4f6c6808d9c8272c5e35"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ══════════════════════════════════════════
   AUTH — تحقق من الجلسة وارجع بيانات المستخدم
══════════════════════════════════════════ */
export function requireAuth(callback) {
    // زائر؟
    const guest = localStorage.getItem('ss-guest');
    if (guest) {
        const guestUser = JSON.parse(localStorage.getItem('ss-user') || '{}');
        callback(null, guestUser);
        return;
    }

    onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            window.location.href = 'auth.html';
            return;
        }
        // جلب بيانات المستخدم من Firestore
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = snap.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null;
        callback(firebaseUser, userData);
    });
}

/* ══════════════════════════════════════════
   WALLET — قراءة الرصيد
══════════════════════════════════════════ */
export async function getWalletBalance(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data().wallet : 0;
}

/* ══════════════════════════════════════════
   WALLET — خصم من الرصيد عند الشراء
══════════════════════════════════════════ */
export async function deductWallet(uid, amount) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) throw new Error('المستخدم غير موجود');
    const balance = snap.data().wallet;
    if (balance < amount) throw new Error('رصيد غير كافٍ');
    await updateDoc(doc(db, 'users', uid), { wallet: balance - amount });
    return balance - amount; // الرصيد الجديد
}

/* ══════════════════════════════════════════
   ORDERS — تسجيل طلب جديد
══════════════════════════════════════════ */
export async function createOrder(uid, orderData) {
    const ref = await addDoc(collection(db, 'orders'), {
        userId:    uid,
        ...orderData,
        status:    'pending',
        createdAt: serverTimestamp()
    });
    // زيادة عداد الطلبات
    await updateDoc(doc(db, 'users', uid), { orders: increment(1) });
    return ref.id;
}

/* ══════════════════════════════════════════
   ORDERS — جلب طلبات المستخدم
══════════════════════════════════════════ */
export async function getUserOrders(uid, maxCount = 10) {
    const q = query(
        collection(db, 'orders'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ══════════════════════════════════════════
   PRODUCTS — جلب المنتجات من Firestore
══════════════════════════════════════════ */
export async function getProducts(category = null) {
    let q;
    if (category) {
        q = query(collection(db, 'products'), where('category', '==', category), where('active', '==', true));
    } else {
        q = query(collection(db, 'products'), where('active', '==', true));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ══════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════ */
export async function logoutUser() {
    localStorage.removeItem('ss-guest');
    localStorage.removeItem('ss-user');
    await signOut(auth);
    window.location.href = 'auth.html';
}

/* ══════════════════════════════════════════
   UPDATE PROFILE
══════════════════════════════════════════ */
export async function updateProfile(uid, data) {
    await updateDoc(doc(db, 'users', uid), data);
}

/* export refs للاستخدام المباشر لو احتجت */
export { auth, db, doc, getDoc, updateDoc, serverTimestamp };
