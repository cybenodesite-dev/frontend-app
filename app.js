import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://cn-img-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let activeServersMap = {};
let currentUser = null;
let selectedFilesArray = [];

// 1. التنقل بين الصفحات في الواجهة الرئيسية
window.switchMainPage = (pageName) => {
    document.querySelectorAll('.main-page').forEach(el => el.classList.add('hidden'));

    if (pageName === 'home') document.getElementById('pageHome').classList.remove('hidden');
    if (pageName === 'my-files') {
        if (!checkAuthRequired()) return;
        document.getElementById('pageMyFiles').classList.remove('hidden');
        loadUserCloudFiles();
    }
    if (pageName === 'pricing') document.getElementById('pagePricing').classList.remove('hidden');
    if (pageName === 'sdk') {
        if (!checkAuthRequired()) return;
        document.getElementById('pageSdk').classList.remove('hidden');
        loadSdkStatus();
    }
};

// 2. التحقق من تسجيل الدخول الإجباري
function checkAuthRequired() {
    if (!currentUser) {
        openAuthModal();
        return false;
    }
    return true;
}

window.openAuthModal = () => {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('authStep1').classList.remove('hidden');
    document.getElementById('authStep2').classList.add('hidden');
    document.getElementById('authStep3').classList.add('hidden');
};

window.closeAuthModal = () => {
    document.getElementById('authModal').classList.add('hidden');
};

// 3. جلب بيانات السيرفرات والإحصائيات الحية
function initMainDashboard() {
    // السيرفرات النشطة
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
                    opt.textContent = `${server.name || 'سيرفر'} (${server.allowedTypes ? server.allowedTypes.join(', ') : 'جميع الصيغ'})`;
                    select.appendChild(opt);
                }
            });
        } else {
            select.innerHTML = '<option value="">لا توجد سيرفرات متاحة حالياً</option>';
        }
    });

    // الإحصائيات العامة
    onValue(ref(db, 'uploads'), (snapshot) => {
        document.getElementById('liveFilesCount').textContent = snapshot.exists() ? snapshot.size : 0;
    });

    onValue(ref(db, 'stats'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.visits) document.getElementById('liveVisitsCount').textContent = data.visits;
            if (data.users) document.getElementById('liveUsersCount').textContent = data.users;
        }
    });

    // استرجاع جلسة المستخدم المسجلة محلياً
    const savedUser = localStorage.getItem('cn_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserUI();
    } else {
        document.getElementById('guestUploadBlocker').classList.remove('hidden');
    }
}

// 4. معالجة الرفع المعاين التفاعلي
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

// 5. زر الرفع الرئيسي
document.getElementById('uploadBtn').onclick = async () => {
    if (!checkAuthRequired()) return;

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
                    'x-server-id': serverConfig.serverId || 'vercel_blob_1',
                    'x-file-name': safeFileName,
                    'content-type': file.type || 'image/jpeg'
                },
                body: file
            });

            const data = await response.json();
            const fileUrl = data.url || data.fileUrl;

            progressBar.style.width = '100%';
            uploadPercent.textContent = '100%';

            // تسجيل الملف في الداتابيز وترتيبه بحساب المستخدم
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

// 6. استرجاع وعرض ملفات المستخدم المرفوعة
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

// 7. الاستبيان وتمرير خطوات تسجيل الدخول
window.handleUserAuth = (e) => {
    e.preventDefault();
    document.getElementById('authStep1').classList.add('hidden');
    document.getElementById('authStep2').classList.remove('hidden');
};

window.submitProfileSurvey = (e) => {
    e.preventDefault();
    currentUser = {
        uid: 'user_' + Date.now(),
        name: document.getElementById('surveyName').value,
        gender: document.getElementById('surveyGender').value,
        country: document.getElementById('surveyCountry').value,
        phone: document.getElementById('surveyPhone').value || '',
        plan: 'free'
    };

    document.getElementById('authStep2').classList.add('hidden');
    document.getElementById('authStep3').classList.remove('hidden');
};

window.selectInitialPlan = (planType) => {
    currentUser.plan = planType;
    set(ref(db, `users/${currentUser.uid}`), currentUser);
    localStorage.setItem('cn_user', JSON.stringify(currentUser));

    updateUserUI();
    closeAuthModal();
    alert("تم إنشاء حسابك وتحديد الخطة بنجاح!");
};

function updateUserUI() {
    if (!currentUser) return;

    document.getElementById('guestUploadBlocker').classList.add('hidden');
    document.getElementById('openAuthBtn').classList.add('hidden');
    document.getElementById('userProfileMenu').classList.remove('hidden');
    document.getElementById('userNameHeader').textContent = currentUser.name;
    document.getElementById('planBadge').textContent = currentUser.plan.toUpperCase();

    if (currentUser.plan === 'vip') {
        document.getElementById('navSdkBtn').classList.remove('hidden');
    }
}

window.logoutUser = () => {
    localStorage.removeItem('cn_user');
    currentUser = null;
    location.reload();
};

// 8. تقديم وتتبع طلب الـ SDK والخادم المدار
window.submitSdkRequest = () => {
    if (!currentUser) return;

    set(ref(db, `sdk_requests/${currentUser.uid}`), {
        userName: currentUser.name,
        userPhone: currentUser.phone,
        status: 'pending',
        requestedAt: Date.now()
    });

    alert("تم تقديم طلب الحصول على السيرفر الخاص والـ SDK بنجاح! سيتم مراجعته وتفعيله من الإدارة.");
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
