import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// إعدادات Firebase Realtime Database
const firebaseConfig = {
    databaseURL: "https://cn-img-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 1. جلب وإظهار السيرفرات في القائمة المنسدلة تلقائياً
function loadActiveServers() {
    const select = document.getElementById('serverSelect');
    if (!select) return;

    // إضافة الخيارات الثابتة مباشرة لضمان ظهورها دائماً
    select.innerHTML = `
        <option value="custom_php">سيرفر PHP المباشر (http://img-12.rf.gd/upload.php)</option>
    `;

    // جلب أي سيرفرات إضافية مسجلة من Realtime Database إن وجدت
    const serversRef = ref(db, 'servers');
    onValue(serversRef, (snapshot) => {
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

// 2. دالة تحويل الملف إلى Base64 للرفع المباشر
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// 3. دالة الرفع المباشرة لسيرفر PHP
async function uploadFileDirectly(file, endpointUrl) {
    const base64Data = await fileToBase64(file);

    const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            file_name: file.name,
            file_data: base64Data
        })
    });

    const data = await response.json();
    if (data.status === 'success' && data.url) {
        return data.url;
    } else {
        throw new Error(data.message || 'فشل الرفع من السيرفر');
    }
}

// 4. زر الرفع الرئيسي
document.getElementById('uploadBtn').onclick = async () => {
    const files = document.getElementById('fileInput').files;
    if (!files.length) return alert("يرجى اختيار ملف أولاً");

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const uploadPercent = document.getElementById('uploadPercent');
    const resultSection = document.getElementById('resultSection');
    const linksList = document.getElementById('linksList');

    progressContainer.classList.remove('hidden');
    linksList.innerHTML = '';

    const serverEndpoint = 'http://img-12.rf.gd/upload.php'; // رابط سيرفرك المباشر

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
            document.getElementById('uploadStatus').textContent = `جاري رفع ${file.name}...`;
            
            progressBar.style.width = '40%';
            uploadPercent.textContent = '40%';

            const fileUrl = await uploadFileDirectly(file, serverEndpoint);

            progressBar.style.width = '100%';
            uploadPercent.textContent = '100%';

            // حفظ بيانات الرفع في Realtime Database
            push(ref(db, 'uploads'), {
                fileName: file.name,
                fileSize: file.size,
                url: fileUrl,
                timestamp: Date.now()
            });

            // عرض النتائج والروابط المباشرة و QR
            renderFileResult(file.name, fileUrl);
            resultSection.classList.remove('hidden');

        } catch (err) {
            alert(`خطأ أثناء رفع ${file.name}: ` + err.message);
        }
    }
};

// 5. عرض النتائج ورموز QR
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
                <button onclick="navigator.clipboard.writeText('${url}')" class="bg-blue-600 hover:bg-blue-700 text-xs text-white px-3 py-1.5 rounded-lg transition">نسخ الرابط</button>
            </div>
        </div>
    `;
    linksList.appendChild(card);
    setTimeout(() => new QRCode(document.getElementById(qrId), { text: url, width: 80, height: 80 }), 100);
}

// 6. إعدادات Drag & Drop
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

// بدء التطبيق
loadActiveServers();
