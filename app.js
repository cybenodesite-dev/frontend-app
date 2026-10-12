import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyCFlIDNppjhYjnYNdZf6tGG45N480GDX50",
  authDomain: "cn-img.firebaseapp.com",
  databaseURL: "https://cn-img-default-rtdb.firebaseio.com",
  projectId: "cn-img",
  storageBucket: "cn-img.firebasestorage.app",
  messagingSenderId: "205454564363",
  appId: "1:205454564363:web:941826fc55127a6c62bb0e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let activeServersMap = {};
let currentUser = null;
let selectedFilesArray = [];
let targetPaymentPlan = null;

// 1. مراقبة حالة التسجيل المباشرة وسرعة الاستجابة
onAuthStateChanged(auth, (user) => {
    if (user) {
        onValue(ref(db, `users/${user.uid}`), (snapshot) => {
            if (snapshot.exists()) {
                currentUser = snapshot.val();
                currentUser.uid = user.uid;
            } else {
                currentUser = {
                    uid: user.uid,
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=2563eb&color=fff`,
                    plan: 'free'
                };
            }
            localStorage.setItem('cn_user_session', JSON.stringify(currentUser));
            updateUserUI();
        });
    } else {
        const savedSession = localStorage.getItem('cn_user_session');
        if (savedSession) {
            currentUser = JSON.parse(savedSession);
            updateUserUI();
        } else {
            currentUser = null;
            updateUserUI();
        }
    }
});

// 2. تحديث الواجهة بناءً على حالة تسجيل الدخول
function updateUserUI() {
    const uploadBox = document.getElementById('uploadBoxSection');
    const loginGate = document.getElementById('loginRequiredGate');
    const authBtn = document.getElementById('openAuthBtn');
    const profileMenu = document.getElementById('userProfileMenu');

    if (currentUser) {
        if (uploadBox) uploadBox.classList.remove('hidden');
        if (loginGate) loginGate.classList.add('hidden');
        if (authBtn) authBtn.classList.add('hidden');
        if (profileMenu) profileMenu.classList.remove('hidden');

        document.getElementById('userNameHeader').textContent = currentUser.name || 'المستخدم';
        document.getElementById('planBadge').textContent = (currentUser.plan || 'FREE').toUpperCase();

        if (currentUser.photoURL) {
            document.getElementById('userAvatarHeader').src = currentUser.photoURL;
        }

        if (currentUser.plan === 'vip') {
            document.getElementById('navSdkBtn').classList.remove('hidden');
        }
    } else {
        if (uploadBox) uploadBox.classList.add('hidden');
        if (loginGate) loginGate.classList.remove('hidden');
        if (authBtn) authBtn.classList.remove('hidden');
        if (profileMenu) profileMenu.classList.add('hidden');
    }
}

// 3. تسجيل الدخول عبر Google
document.getElementById('googleAuthBtn').onclick = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        currentUser = { uid: user.uid, name: user.displayName, email: user.email, photoURL: user.photoURL, plan: 'free' };
        document.getElementById('authStep1').classList.add('hidden');
        document.getElementById('authStep2').classList.remove('hidden');
    } catch (err) {
        alert("خطأ أثناء الدخول عبر Google: " + err.message);
    }
};

// 4. تسجيل الدخول وإنشاء الحساب عبر البريد
window.handleUserAuth = async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeAuthModal();
    } catch (err) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            try {
                const newCred = await createUserWithEmailAndPassword(auth, email, password);
                currentUser = { uid: newCred.user.uid, email, name: email.split('@')[0], plan: 'free' };
                document.getElementById('authStep1').classList.add('hidden');
                document.getElementById('authStep2').classList.remove('hidden');
            } catch (createErr) {
                alert("خطأ أثناء إنشاء الحساب: " + createErr.message);
            }
        } else {
            alert("خطأ في البيانات: " + err.message);
        }
    }
};

// 5. نسيت كلمة المرور وإرسال الرابط
window.showForgotPasswordView = () => {
    document.getElementById('authStep1').classList.add('hidden');
    document.getElementById('forgotPasswordStep').classList.remove('hidden');
};

window.hideForgotPasswordView = () => {
    document.getElementById('forgotPasswordStep').classList.add('hidden');
    document.getElementById('authStep1').classList.remove('hidden');
};

window.handleForgotPassword = async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    try {
        await sendPasswordResetEmail(auth, email);
        alert("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح!");
        hideForgotPasswordView();
    } catch (err) {
        alert("خطأ أثناء إرسال البريد: " + err.message);
    }
};

// 6. استبيان البيانات الأساسية
window.submitProfileSurvey = (e) => {
    e.preventDefault();
    currentUser.name = document.getElementById('surveyName').value;
    currentUser.gender = document.getElementById('surveyGender').value;
    currentUser.country = document.getElementById('surveyCountry').value;
    currentUser.phone = document.getElementById('surveyPhone').value || '';

    document.getElementById('authStep2').classList.add('hidden');
    document.getElementById('authStep3').classList.remove('hidden');
};

window.selectInitialPlan = (planType) => {
    currentUser.plan = planType;
    set(ref(db, `users/${currentUser.uid}`), currentUser);
    localStorage.setItem('cn_user_session', JSON.stringify(currentUser));
    updateUserUI();
    closeAuthModal();
    alert("تم تفعيل حسابك واختيار الخطة بنجاح!");
};

window.logoutUser = () => {
    signOut(auth);
    localStorage.removeItem('cn_user_session');
    currentUser = null;
    updateUserUI();
};

// 7. بوابة الدفع اليدوي (فودافون كاش)
window.openPaymentGateway = (planName, amount) => {
    if (!currentUser) return openAuthModal();

    targetPaymentPlan = { planName, amount };
    document.getElementById('payPlanTitle').textContent = planName.toUpperCase();
    document.getElementById('payAmountTitle').textContent = `${amount} ج.م`;
    document.getElementById('paymentModal').classList.remove('hidden');
};

window.closePaymentModal = () => {
    document.getElementById('paymentModal').classList.add('hidden');
};

window.submitPaymentReceipt = (e) => {
    e.preventDefault();
    const senderPhone = document.getElementById('paySenderPhone').value;
    const whatsapp = document.getElementById('payWhatsapp').value;

    push(ref(db, 'payments'), {
        userId: currentUser.uid,
        userName: currentUser.name,
        userEmail: currentUser.email || '',
        plan: targetPaymentPlan.planName,
        amount: targetPaymentPlan.amount,
        senderPhone: senderPhone,
        whatsapp: whatsapp,
        status: 'pending',
        timestamp: Date.now()
    });

    alert("تم إرسال طلب الترقية وإيصال التحويل للإدارة بنجاح! سيتم المراجعة وتفعيل الخطة في أقرب وقت.");
    closePaymentModal();
};

// 8. التنقل بين الصفحات الرئيسية
window.switchMainPage = (pageName) => {
    document.querySelectorAll('.main-page').forEach(el => el.classList.add('hidden'));

    if (pageName === 'home') document.getElementById('pageHome').classList.remove('hidden');
    if (pageName === 'about') document.getElementById('pageAbout').classList.remove('hidden');
    if (pageName === 'pricing') document.getElementById('pagePricing').classList.remove('hidden');
    if (pageName === 'my-files') {
        if (!currentUser) return openAuthModal();
        document.getElementById('pageMyFiles').classList.remove('hidden');
        loadUserCloudFiles();
    }
    if (pageName === 'sdk') {
        if (!currentUser) return openAuthModal();
        document.getElementById('pageSdk').classList.remove('hidden');
        loadSdkStatus();
    }
};

window.openAuthModal = () => {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('authStep1').classList.remove('hidden');
    document.getElementById('forgotPasswordStep').classList.add('hidden');
    document.getElementById('authStep2').classList.add('hidden');
    document.getElementById('authStep3').classList.add('hidden');
};

window.closeAuthModal = () => {
    document.getElementById('authModal').classList.add('hidden');
};

// 9. جلب العدادات الحقيقية والسيرفرات
function initMainDashboard() {
    onValue(ref(db, 'servers'), (snapshot) => {
        const select = document.getElementById('serverSelect');
        if (!select) return;
        select.innerHTML = '';
        activeServersMap = {};

        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const server = child.val();
                if (server.active) {
                    activeServersMap[child.key] = server;
                    const opt = document.createElement('option');
                    opt.value = child.key;
                    opt.textContent = `${server.name || 'سيرفر'} (${server.type || 'Custom API'})`;
                    select.appendChild(opt);
                }
            });
        }
    });

    // العدادات الحقيقية المطابقة لملف JSON
    onValue(ref(db, 'uploads'), (snapshot) => {
        document.getElementById('liveFilesCount').textContent = snapshot.exists() ? snapshot.size : 0;
    });

    onValue(ref(db, 'users'), (snapshot) => {
        document.getElementById('liveUsersCount').textContent = snapshot.exists() ? snapshot.size : 0;
    });

    onValue(ref(db, 'stats'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.visits) document.getElementById('liveVisitsCount').textContent = data.visits;
        }
    });
}

// 10. الرفع السحابي والمعاينة
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');

if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
    dropzone.ondragleave = () => dropzone.classList.remove('dragover');
    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFilesSelection(e.dataTransfer.files);
    };

    fileInput.onchange = (e) => {
        handleFilesSelection(e.target.files);
    };
}

function handleFilesSelection(files) {
    if (!files.length) return;
    selectedFilesArray = Array.from(files);
    const container = document.getElementById('selectedFilesPreview');
    container.innerHTML = '';
    container.classList.remove('hidden');

    selectedFilesArray.forEach(file => {
        const isImg = file.type.startsWith('image/');
        const card = document.createElement('div');
        card.className = "p-3 bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-3 text-xs";
        card.innerHTML = `
            <div class="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-blue-400">
                ${isImg ? '<i class="fa-solid fa-image"></i>' : '<i class="fa-solid fa-file"></i>'}
            </div>
            <div class="flex-grow truncate">
                <p class="font-bold text-gray-200 truncate">${file.name}</p>
                <p class="text-gray-500 text-[10px]">${(file.size / 1024).toFixed(1)} KB</p>
            </div>
        `;
        container.appendChild(card);
    });
}

document.getElementById('uploadBtn').onclick = async () => {
    if (!currentUser) return openAuthModal();
    if (!selectedFilesArray.length) return alert("يرجى اختيار ملف واحد على الأقل للرفع");

    const selectedServerKey = document.getElementById('serverSelect').value;
    const serverConfig = activeServersMap[selectedServerKey];

    if (!serverConfig) return alert("يرجى اختيار سيرفر رفع صحيح من القائمة");

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const uploadPercent = document.getElementById('uploadPercent');
    const resultSection = document.getElementById('resultSection');
    const linksList = document.getElementById('linksList');

    progressContainer.classList.remove('hidden');
    linksList.innerHTML = '';

    for (let i = 0; i < selectedFilesArray.length; i++) {
        const file = selectedFilesArray[i];

        try {
            document.getElementById('uploadStatus').textContent = `جاري رفع ${file.name}...`;
            progressBar.style.width = '50%';
            uploadPercent.textContent = '50%';

            const targetEndpoint = serverConfig.endpoint || serverConfig.url;
            const safeFileName = encodeURIComponent(`${Date.now()}_${file.name}`);

            const response = await fetch(targetEndpoint, {
                method: 'POST',
                headers: {
                    'x-server-id': serverConfig.serverId || 'custom_api',
                    'x-file-name': safeFileName,
                    'content-type': file.type || 'image/jpeg'
                },
                body: file
            });

            const data = await response.json();
            const fileUrl = data.url || data.fileUrl;

            progressBar.style.width = '100%';
            uploadPercent.textContent = '100%';

            push(ref(db, 'uploads'), {
                fileName: file.name,
                fileSize: file.size,
                url: fileUrl,
                userId: currentUser.uid,
                userName: currentUser.name,
                serverId: selectedServerKey,
                timestamp: Date.now()
            });

            renderResultCard(file.name, fileUrl);
            resultSection.classList.remove('hidden');

        } catch (err) {
            alert(`خطأ أثناء رفع ${file.name}: ` + err.message);
        }
    }
};

function renderResultCard(fileName, url) {
    const linksList = document.getElementById('linksList');
    const qrId = 'qr_' + Math.random().toString(36).substr(2, 9);

    const card = document.createElement('div');
    card.className = "p-4 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col md:flex-row items-center gap-4";
    card.innerHTML = `
        <div id="${qrId}" class="bg-white p-2 rounded-xl"></div>
        <div class="flex-grow w-full space-y-2">
            <p class="font-bold text-sm text-gray-200">${fileName}</p>
            <input type="text" readonly value="${url}" class="w-full bg-gray-950 border border-gray-800 text-xs text-blue-400 p-2.5 rounded-xl outline-none">
            <button onclick="navigator.clipboard.writeText('${url}')" class="bg-blue-600 hover:bg-blue-700 text-xs text-white px-4 py-2 rounded-xl transition">نسخ الرابط المباشر</button>
        </div>
    `;
    linksList.appendChild(card);
    setTimeout(() => new QRCode(document.getElementById(qrId), { text: url, width: 80, height: 80 }), 100);
}

// 11. عرض الملفات المرفوعة وتقديم SDK
function loadUserCloudFiles() {
    if (!currentUser) return;

    onValue(ref(db, 'uploads'), (snapshot) => {
        const grid = document.getElementById('userCloudFilesGrid');
        grid.innerHTML = '';
        let count = 0;

        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const file = child.val();
                if (file.userId === currentUser.uid) {
                    count++;
                    const fileId = child.key;
                    const isImg = file.fileName && file.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);

                    grid.innerHTML += `
                        <div class="p-4 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col justify-between space-y-3">
                            <div class="h-28 bg-gray-950 rounded-xl overflow-hidden flex items-center justify-center border border-gray-800">
                                ${isImg ? `<img src="${file.url}" class="w-full h-full object-cover">` : `<span class="text-gray-500 text-xs font-bold">${file.fileName.split('.').pop().toUpperCase()}</span>`}
                            </div>
                            <p class="font-bold text-xs text-gray-200 truncate">${file.fileName}</p>
                            <div class="flex justify-between text-xs pt-2 border-t border-gray-800">
                                <button onclick="navigator.clipboard.writeText('${file.url}')" class="text-blue-400 hover:underline">مشاركة</button>
                                <button onclick="deleteMyCloudFile('${fileId}')" class="text-red-400 hover:underline">حذف</button>
                            </div>
                        </div>
                    `;
                }
            });
        }
        document.getElementById('myFilesCountBadge').textContent = `${count} ملف`;
    });
}

window.deleteMyCloudFile = (fileId) => {
    if (confirm("هل أنت متأكد من حذف الملف؟")) {
        remove(ref(db, `uploads/${fileId}`));
    }
};

window.submitSdkRequest = () => {
    if (!currentUser) return;

    set(ref(db, `sdk_requests/${currentUser.uid}`), {
        userName: currentUser.name,
        userPhone: currentUser.phone || '',
        status: 'pending',
        requestedAt: Date.now()
    });

    alert("تم تقديم طلب الحصول على السيرفر الخاص والـ SDK بنجاح!");
    loadSdkStatus();
};

function loadSdkStatus() {
    if (!currentUser) return;

    onValue(ref(db, `sdk_requests/${currentUser.uid}`), (snapshot) => {
        if (snapshot.exists()) {
            const req = snapshot.val();
            const badge = document.getElementById('sdkRequestStatusBadge');
            
            if (req.status === 'pending') {
                badge.textContent = "قيد المراجعة";
                badge.className = "text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold";
            } else if (req.status === 'approved') {
                badge.textContent = "تم الاعتماد والتفعيل";
                badge.className = "text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold";
                
                document.getElementById('sdkApprovedContent').classList.remove('hidden');
                if (req.note) document.getElementById('adminSdkNote').textContent = req.note;
                if (req.sdkCode) document.getElementById('sdkCodeBox').value = req.sdkCode;
            }
        }
    });
}

window.copySdkCode = () => {
    const box = document.getElementById('sdkCodeBox');
    box.select();
    navigator.clipboard.writeText(box.value);
    alert("تم نسخ كود الـ SDK بنجاح!");
};

initMainDashboard();
