import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// إعدادات Firebase Realtime Database لحفظ السجلات
const firebaseConfig = {
    databaseURL: "https://cn-img-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 1. تعريف السيرفرات المتاحة (Supabase + Vercel Blob)
const storageServers = {
    "supabase_1": {
        name: "سيرفر Supabase السحابي (5GB)",
        type: "supabase",
        url: "https://YOUR_SUPABASE_PROJECT_ID.supabase.co", // استبدل برابط مشروع Supabase
        key: "YOUR_SUPABASE_ANON_KEY"                       // استبدل بمفتاح Anon Key
    },
    "vercel_blob": {
        name: "سيرفر Vercel Blob السريع (1GB)",
        type: "vercel_blob",
        uploadApi: "/api/upload-blob"                       // مسار الرفع الخاص بـ Vercel Blob
    }
};

// 2. تحميل السيرفرات المتاحة في القائمة المنسدلة
function loadActiveServers() {
    const select = document.getElementById('serverSelect');
    if (!select) return;

    select.innerHTML = '';
    Object.keys(storageServers).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = storageServers[key].name;
        select.appendChild(opt);
    });
}

// 3. دالة الرفع إلى Supabase Storage
async function uploadToSupabase(file, serverConfig) {
    const fileName = `${Date.now()}_${file.name}`;
    const uploadUrl = `${serverConfig.url}/storage/v1/object/uploads/${fileName}`;

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serverConfig.key}`,
            'apiKey': serverConfig.key,
            'Content-Type': file.type
        },
        body: file
    });

    if (response.ok) {
        return `${serverConfig.url}/storage/v1/object/public/uploads/${fileName}`;
    } else {
        const err = await response.json();
        throw new Error(err.message || 'فشل الرفع إلى Supabase');
    }
}

// 4. دالة الرفع إلى Vercel Blob
async function uploadToVercelBlob(file, serverConfig) {
    const response = await fetch(`${serverConfig.uploadApi}?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file
    });

    const data = await response.json();
    if (response.ok && data.url) {
        return data.url;
    } else {
        throw new Error(data.error || 'فشل الرفع إلى Vercel Blob');
    }
}

// 5. زر الرفع الرئيسي
document.getElementById('uploadBtn').onclick = async () => {
    const files = document.getElementById('fileInput').files;
    if (!files.length) return alert("يرجى اختيار ملف أولاً");

    const selectedServerKey = document.getElementById('serverSelect').value;
    const serverConfig = storageServers[selectedServerKey];

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const uploadPercent = document.getElementById('uploadPercent');
    const resultSection = document.getElementById('resultSection');
    const linksList = document.getElementById('linksList');

    progressContainer.classList.remove('hidden');
    linksList.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let fileUrl = '';

        try {
            document.getElementById('uploadStatus').textContent = `جاري رفع ${file.name}...`;
            
            progressBar.style.width = '40%';
            uploadPercent.textContent = '40%';

            if (serverConfig.type === 'supabase') {
                fileUrl = await uploadToSupabase(file, serverConfig);
            } else if (serverConfig.type === 'vercel_blob') {
                fileUrl = await uploadToVercelBlob(file, serverConfig);
            }

            progressBar.style.width = '100%';
            uploadPercent.textContent = '100%';

            // حفظ بيانات الملف في Realtime Database
            push(ref(db, 'uploads'), {
                fileName: file.name,
                fileSize: file.size,
                url: fileUrl,
                server: selectedServerKey,
                timestamp: Date.now()
            });

            // عرض نتيجة الرفع
            renderFileResult(file.name, fileUrl);
            resultSection.classList.remove('hidden');

        } catch (err) {
            alert(`خطأ أثناء رفع ${file.name}: ` + err.message);
        }
    }
};

// 6. عرض النتيجة ورمز QR
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

// 7. Drag & Drop
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
