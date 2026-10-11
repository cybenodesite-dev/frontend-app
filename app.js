import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    onValue, 
    query, 
    orderByChild, 
    equalTo 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getStorage, 
    ref as storageRef, 
    uploadBytesResumable, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase Config (cn-img)
const firebaseConfig = {
    apiKey: "AIzaSyCFlIDNppjhYjnYNdZf6tGG45N480GDX50",
    authDomain: "cn-img.firebaseapp.com",
    databaseURL: "https://cn-img-default-rtdb.firebaseio.com",
    projectId: "cn-img",
    storageBucket: "cn-img.firebasestorage.app",
    messagingSenderId: "205454564363",
    appId: "1:205454564363:web:941826fc55127a6c62bb0e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

let currentUser = null;
let confirmationResult = null;

// Load Active Servers from RTDB
function loadActiveServers() {
    const serversRef = ref(db, 'servers');
    onValue(serversRef, (snapshot) => {
        const select = document.getElementById('serverSelect');
        select.innerHTML = '<option value="default">سيرفر التخزين الافتراضي (Firebase Storage)</option>';
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const server = child.val();
                if (server.active) {
                    const opt = document.createElement('option');
                    opt.value = child.key;
                    opt.textContent = `${server.name} (${server.type || 'Custom'})`;
                    select.appendChild(opt);
                }
            });
        }
    });
}

// Authentication Listeners
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const openAuthBtn = document.getElementById('openAuthBtn');
    const userProfileMenu = document.getElementById('userProfileMenu');

    if (user) {
        openAuthBtn.classList.add('hidden');
        userProfileMenu.classList.remove('hidden');
        document.getElementById('userNameHeader').textContent = user.displayName || user.email || user.phoneNumber || 'مستخدم';
        document.getElementById('userAvatarHeader').src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=0D8ABC&color=fff`;
    } else {
        openAuthBtn.classList.remove('hidden');
        userProfileMenu.classList.add('hidden');
    }
});

// Auth Modals Toggle
document.getElementById('openAuthBtn').onclick = () => document.getElementById('authModal').classList.remove('hidden');
document.getElementById('closeAuthModal').onclick = () => document.getElementById('authModal').classList.add('hidden');
document.getElementById('openProfileBtn').onclick = () => {
    document.getElementById('profileModal').classList.remove('hidden');
    loadUserFiles();
};
document.getElementById('closeProfileModal').onclick = () => document.getElementById('profileModal').classList.add('hidden');

// Google Auth
document.getElementById('googleAuthBtn').onclick = async () => {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        document.getElementById('authModal').classList.add('hidden');
    } catch (err) {
        alert("خطأ في تسجيل الدخول بـ Google: " + err.message);
    }
};

// Email Auth Tabs & Login/Register
document.getElementById('tabEmail').onclick = () => {
    document.getElementById('emailAuthForm').classList.remove('hidden');
    document.getElementById('phoneAuthForm').classList.add('hidden');
    document.getElementById('tabEmail').className = "flex-1 py-2 text-center border-b-2 border-blue-500 font-semibold text-blue-400 text-sm";
    document.getElementById('tabPhone').className = "flex-1 py-2 text-center border-b-2 border-transparent font-semibold text-gray-400 hover:text-white text-sm";
};

document.getElementById('tabPhone').onclick = () => {
    document.getElementById('emailAuthForm').classList.add('hidden');
    document.getElementById('phoneAuthForm').classList.remove('hidden');
    document.getElementById('tabPhone').className = "flex-1 py-2 text-center border-b-2 border-blue-500 font-semibold text-blue-400 text-sm";
    document.getElementById('tabEmail').className = "flex-1 py-2 text-center border-b-2 border-transparent font-semibold text-gray-400 hover:text-white text-sm";
    initRecaptcha();
};

document.getElementById('emailLoginBtn').onclick = async () => {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        document.getElementById('authModal').classList.add('hidden');
    } catch (err) { alert("خطأ: " + err.message); }
};

document.getElementById('emailRegisterBtn').onclick = async () => {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    try {
        await createUserWithEmailAndPassword(auth, email, pass);
        document.getElementById('authModal').classList.add('hidden');
    } catch (err) { alert("خطأ: " + err.message); }
};

// Phone Authentication
function initRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptchaContainer', { size: 'invisible' });
    }
}

document.getElementById('sendSmsBtn').onclick = async () => {
    const phone = document.getElementById('phoneNumber').value;
    try {
        confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
        document.getElementById('otpBox').classList.remove('hidden');
        alert("تم إرسال رمز التحقق إلى هاتفك");
    } catch (err) { alert("خطأ الهاتف: " + err.message); }
};

document.getElementById('verifyOtpBtn').onclick = async () => {
    const code = document.getElementById('otpCode').value;
    try {
        await confirmationResult.confirm(code);
        document.getElementById('authModal').classList.add('hidden');
    } catch (err) { alert("رمز التحقق غير صحيح: " + err.message); }
};

// Logout
document.getElementById('logoutBtn').onclick = () => {
    signOut(auth);
    document.getElementById('profileModal').classList.add('hidden');
};

// File Upload Logic
document.getElementById('uploadBtn').onclick = () => {
    const files = document.getElementById('fileInput').files;
    if (!files.length) return alert("يرجى اختيار ملف أولاً");

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const uploadPercent = document.getElementById('uploadPercent');
    const resultSection = document.getElementById('resultSection');
    const linksList = document.getElementById('linksList');

    progressContainer.classList.remove('hidden');
    linksList.innerHTML = '';

    Array.from(files).forEach((file) => {
        const fileRef = storageRef(storage, `uploads/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressBar.style.width = progress + '%';
                uploadPercent.textContent = Math.round(progress) + '%';
            }, 
            (error) => alert("خطأ في الرفع: " + error.message), 
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // Save Record to Database
                const uploadRecord = {
                    fileName: file.name,
                    fileSize: file.size,
                    url: downloadURL,
                    userId: currentUser ? currentUser.uid : 'anonymous',
                    timestamp: Date.now()
                };
                push(ref(db, 'uploads'), uploadRecord);

                // Render Results
                renderFileResult(file.name, downloadURL);
                resultSection.classList.remove('hidden');
            }
        );
    });
};

function renderFileResult(fileName, url) {
    const linksList = document.getElementById('linksList');
    const qrId = 'qr_' + Math.random().toString(36).substr(2, 9);
    
    const card = document.createElement('div');
    card.className = "p-4 bg-gray-900 border border-gray-700 rounded-xl flex flex-col md:flex-row items-center gap-4";
    card.innerHTML = `
        <div id="${qrId}" class="bg-white p-2 rounded-lg"></div>
        <div class="flex-grow w-full space-y-2">
            <p class="font-bold text-sm text-gray-200">${fileName}</p>
            <input type="text" readonly value="${url}" class="w-full bg-gray-800 border border-gray-700 text-xs text-blue-400 p-2 rounded-lg">
            <div class="flex gap-2">
                <button onclick="navigator.clipboard.writeText('${url}')" class="bg-blue-600 hover:bg-blue-700 text-xs text-white px-3 py-1.5 rounded-lg transition">نسخ الرابط المباشر</button>
                <button onclick="navigator.clipboard.writeText('[img]${url}[/img]')" class="bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 px-3 py-1.5 rounded-lg transition">BBCode</button>
                <button onclick="navigator.clipboard.writeText('<img src=\\'${url}\\' />')" class="bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 px-3 py-1.5 rounded-lg transition">HTML</button>
            </div>
        </div>
    `;
    linksList.appendChild(card);
    setTimeout(() => new QRCode(document.getElementById(qrId), { text: url, width: 80, height: 80 }), 100);
}

// Load Files in Profile
function loadUserFiles() {
    if (!currentUser) return;
    document.getElementById('profileName').textContent = currentUser.displayName || 'مستخدم';
    document.getElementById('profileDetail').textContent = currentUser.email || currentUser.phoneNumber || currentUser.uid;
    document.getElementById('profileAvatar').src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.email || 'User')}&background=0D8ABC&color=fff`;

    const userFilesList = document.getElementById('userFilesList');
    userFilesList.innerHTML = '';

    const uploadsRef = query(ref(db, 'uploads'), orderByChild('userId'), equalTo(currentUser.uid));
    onValue(uploadsRef, (snapshot) => {
        if (!snapshot.exists()) {
            userFilesList.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">لم تقم برفع أي ملفات بعد.</p>';
            return;
        }
        userFilesList.innerHTML = '';
        snapshot.forEach((child) => {
            const item = child.val();
            const itemEl = document.createElement('div');
            itemEl.className = "bg-gray-900 p-3 rounded-xl border border-gray-700 flex justify-between items-center gap-2";
            itemEl.innerHTML = `
                <div class="truncate">
                    <p class="text-xs font-bold text-gray-200 truncate">${item.fileName}</p>
                    <a href="${item.url}" target="_blank" class="text-[10px] text-blue-400 underline">${item.url}</a>
                </div>
                <button onclick="navigator.clipboard.writeText('${item.url}')" class="bg-gray-700 hover:bg-gray-600 text-xs px-2.5 py-1.5 rounded-lg text-white">نسخ</button>
            `;
            userFilesList.appendChild(itemEl);
        });
    });
}

// Dropzone UI Setup
const dropzone = document.getElementById('dropzone');
dropzone.onclick = () => document.getElementById('fileInput').click();
dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
dropzone.ondragleave = () => dropzone.classList.remove('dragover');
dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    document.getElementById('fileInput').files = e.dataTransfer.files;
};

// Init App
loadActiveServers();
