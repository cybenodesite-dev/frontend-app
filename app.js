import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// إعدادات Firebase Realtime Database
const firebaseConfig = {
    databaseURL: "https://cn-img-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// خريطة لتخزين بيانات السيرفرات المجلوبة ديناميكياً من لوحة التحكم
let activeServersMap = {};

// 1. جلب السيرفرات النشطة من لوحة التحكم تلقائياً
function loadActiveServers() {
    const serversRef = ref(db, 'servers');
    
    onValue(serversRef, (snapshot) => {
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
                    opt.textContent = `${server.name} (${server.type || 'Cloud Worker'})`;
                    select.appendChild(opt);
                }
            });
        } else {
            select.innerHTML = '<option value="">لا توجد سيرفرات متاحة حالياً</option>';
        }
    });
}

// 2. دالة الرفع عبر الووركر مع ترميز أسماء الملفات العربية
async function uploadToSelectedServer(file, serverConfig) {
    const targetEndpoint = serverConfig.endpoint || serverConfig.url;

    if (!targetEndpoint) {
        throw new Error("رابط السيرفر غير معرف في لوحة التحكم");
    }

    // ترميز اسم الملف لتجنب أخطاء الحروف العربية في HTTP Headers
    const safeFileName = encodeURIComponent(`${Date.now()}_${file.name}`);

    const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
            'x-server-id': serverConfig.serverId || serverConfig.type || 'vercel_blob_1',
            'x-file-name': safeFileName,
            'content-type': file.type || 'image/jpeg'
        },
        body: file
    });

    const data = await response.json();
    
    if (data.status === 'success' && data.url) {
        return data.url;
    } else if (data.url) {
        return data.url;
    } else {
        throw new Error(data.message || data.error || 'فشل الرفع من سيرفر Cloudflare Worker');
    }
}

// 3. زر الرفع الرئيسي
document.getElementById('uploadBtn').onclick = async () => {
    const files = document.getElementById('fileInput').files;
    if (!files.length) return alert("يرجى اختيار ملف أولاً");

    const selectedServerKey = document.getElementById('serverSelect').value;
    const selectedServerConfig = activeServersMap[selectedServerKey];

    if (!selectedServerConfig) {
        return alert("يرجى اختيار سيرفر رفع صحيح من القائمة");
    }

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const uploadPercent = document.getElementById('uploadPercent');
    const resultSection = document.getElementById('resultSection');
    const linksList = document.getElementById('linksList');

    progressContainer.classList.remove('hidden');
    linksList.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
            document.getElementById('uploadStatus').textContent = `جاري رفع ${file.name}...`;
            
            progressBar.style.width = '40%';
            uploadPercent.textContent = '40%';

            const fileUrl = await uploadToSelectedServer(file, selectedServerConfig);

            progressBar.style.width = '100%';
            uploadPercent.textContent = '100%';

            // تسجيل العملية في Firebase Realtime Database
            push(ref(db, 'uploads'), {
                fileName: file.name,
                fileSize: file.size,
                url: fileUrl,
                serverId: selectedServerKey,
                serverName: selectedServerConfig.name,
                timestamp: Date.now()
            });

            // عرض النتيجة
            renderFileResult(file.name, fileUrl);
            resultSection.classList.remove('hidden');

        } catch (err) {
            alert(`خطأ أثناء رفع ${file.name}: ` + err.message);
        }
    }
};

// 4. عرض النتائج ورمز QR
function renderFileResult(fileName, url) {
    const linksList = document.getElementById('linksList');
    const qrId = 'qr_' + Math.random().toString(36).substr(2, 9);
    
    const card = document.createElement('div');
    card.className = "p-4 bg-gray-900 border border-gray-700 rounded-xl flex flex-col md:flex-row items-center gap-4 mb-3";
    card.innerHTML = `
        <div id="${qrId}" class="bg-white p-2 rounded-lg"></div>
        <div class="flex-grow w-full space-y-2">
            <p class="font-bold text-sm text-gray-200">${fileName}</p>
            <input type="text" readonly value="${url}" class="w-full bg-gray-800 border border-gray-700 text-xs text-blue-400 p-2 rounded-lg">
            <div class="flex flex-wrap gap-2">
                <button onclick="navigator.clipboard.writeText('${url}')" class="bg-blue-600 hover:bg-blue-700 text-xs text-white px-3 py-1.5 rounded-lg transition">نسخ الرابط المباشر</button>
            </div>
        </div>
    `;
    linksList.appendChild(card);
    setTimeout(() => new QRCode(document.getElementById(qrId), { text: url, width: 80, height: 80 }), 100);
}

// 5. Drag & Drop
const dropzone = document.getElementById('dropzone');
if (dropzone) {
    dropzone.onclick = () => document.getElementById('fileInput').click();
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
    dropzone.ondragleave = () => dropzone.classList.remove('dragover');
    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        document.getElementById('fileInput').files = e.dataTransfer.files;
    };
}

loadActiveServers();
