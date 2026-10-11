import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// إعدادات Firebase Realtime Database لحفظ سجلات الرفع
const firebaseConfig = {
    databaseURL: "https://cn-img-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ضع هنا رابط Cloudflare Worker الخاص بك
const WORKER_URL = "https://YOUR_WORKER_NAME.workers.dev"; 

// 1. إظهار السيرفرات المتاحة في الواجهة
function loadActiveServers() {
    const select = document.getElementById('serverSelect');
    if (!select) return;

    select.innerHTML = `
        <option value="vercel_blob_1">سيرفر Vercel Blob السريع (1GB)</option>
        <option value="supabase_1">سيرفر Supabase السحابي (5GB)</option>
    `;
}

// 2. دالة الرفع الموحدة عبر الووركر
async function uploadViaWorker(file, serverId) {
    const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
            'x-server-id': serverId,
            'x-file-name': `${Date.now()}_${file.name}`,
            'content-type': file.type
        },
        body: file
    });

    const data = await response.json();
    if (data.status === 'success' && data.url) {
        return data.url;
    } else {
        throw new Error(data.message || 'فشل الرفع عبر سيرفر الووركر');
    }
}

// 3. زر الرفع الرئيسي
document.getElementById('uploadBtn').onclick = async () => {
    const files = document.getElementById('fileInput').files;
    if (!files.length) return alert("يرجى اختيار ملف أولاً");

    const selectedServerKey = document.getElementById('serverSelect').value;
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
            
            progressBar.style.width = '50%';
            uploadPercent.textContent = '50%';

            const fileUrl = await uploadViaWorker(file, selectedServerKey);

            progressBar.style.width = '100%';
            uploadPercent.textContent = '100%';

            // حفظ بيانات الرفع في Firebase Realtime Database
            push(ref(db, 'uploads'), {
                fileName: file.name,
                fileSize: file.size,
                url: fileUrl,
                server: selectedServerKey,
                timestamp: Date.now()
            });

            // عرض النتيجة ورمز QR
            renderFileResult(file.name, fileUrl);
            resultSection.classList.remove('hidden');

        } catch (err) {
            alert(`خطأ أثناء رفع ${file.name}: ` + err.message);
        }
    }
};

// 4. عرض النتائج
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
