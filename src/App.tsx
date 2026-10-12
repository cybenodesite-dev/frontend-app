/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface UserSession {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  photoURL: string;
  plan: 'free' | 'pro' | 'vip';
  gender?: string;
  country?: string;
  referralSource?: string;
  surveyCompleted?: boolean;
}

interface UploadedFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  url: string;
  userId: string;
  userName: string;
  serverId: string;
  timestamp: number;
}

interface ServerOption {
  key: string;
  name: string;
  endpoint: string;
  active: boolean;
}

interface PaymentSubmission {
  id: string;
  userId: string;
  plan: 'pro' | 'vip';
  amount: number;
  senderPhone: string;
  whatsappNumber: string;
  receiptImage: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

const FIREBASE_DB_URL = 'https://cn-img-default-rtdb.firebaseio.com';
const LOGO_URL =
  'https://inrm89btf01qqqe0.public.blob.vercel-storage.com/1791798855162_NCRpMlt6SEB3fpH6Guxu_UOe0fxcKdExSc7JKhFG2yoG7ALw3ZkywO_gHqT_gs_seQSioE9o4DetTGRTT4p1RXW7IgI0VzOpusK1mCaVG1qJf21kZ2IIAo5o72qNI6pbXxv_-A4ti82l7Z22av9WWiaJeYWvZGquEdJVx68o24pwVcSIh0XALTzgaIdJ2Kpj-P4CEiY1CnLDPmEilS8G3SxETHA0rvT.jpeg';

const PAYMENT_NUMBER = '01029583799';
const OFFICIAL_EMAIL = 'info@cybenode.site';

interface CountryDial {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const COUNTRIES_LIST: CountryDial[] = [
  { code: 'EG', name: 'مصر', dial: '+20', flag: '🇪🇬' },
  { code: 'SA', name: 'المملكة العربية السعودية', dial: '+966', flag: '🇸🇦' },
  { code: 'AE', name: 'الإمارات العربية المتحدة', dial: '+971', flag: '🇦🇪' },
  { code: 'KW', name: 'الكويت', dial: '+965', flag: '🇰🇼' },
  { code: 'QA', name: 'قطر', dial: '+974', flag: '🇶🇦' },
  { code: 'OM', name: 'عُمان', dial: '+968', flag: '🇴🇲' },
  { code: 'BH', name: 'البحرين', dial: '+973', flag: '🇧🇭' },
  { code: 'JO', name: 'الأردن', dial: '+962', flag: '🇯🇴' },
  { code: 'IQ', name: 'العراق', dial: '+964', flag: '🇮🇶' },
  { code: 'LB', name: 'لبنان', dial: '+961', flag: '🇱🇧' },
  { code: 'SY', name: 'سوريا', dial: '+963', flag: '🇸🇾' },
  { code: 'PS', name: 'فلسطين', dial: '+970', flag: '🇵🇸' },
  { code: 'YE', name: 'اليمن', dial: '+967', flag: '🇾🇪' },
  { code: 'LY', name: 'ليبيا', dial: '+218', flag: '🇱🇾' },
  { code: 'TN', name: 'تونس', dial: '+216', flag: '🇹🇳' },
  { code: 'DZ', name: 'الجزائر', dial: '+213', flag: '🇩🇿' },
  { code: 'MA', name: 'المغرب', dial: '+212', flag: '🇲🇦' },
  { code: 'SD', name: 'السودان', dial: '+249', flag: '🇸🇩' },
  { code: 'TR', name: 'تركيا', dial: '+90', flag: '🇹🇷' },
  { code: 'US', name: 'الولايات المتحدة', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'المملكة المتحدة', dial: '+44', flag: '🇬🇧' },
  { code: 'DE', name: 'ألمانيا', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'فرنسا', dial: '+33', flag: '🇫🇷' },
  { code: 'CA', name: 'كندا', dial: '+1', flag: '🇨🇦' },
];

type PageType = 'home' | 'my-files' | 'pricing' | 'sdk' | 'privacy' | 'terms' | 'about' | 'contact';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');

  // User session
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('cn_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Dynamic state loaded from Realtime Database
  const [serversList, setServersList] = useState<ServerOption[]>([]);
  const [cloudFiles, setCloudFiles] = useState<UploadedFileItem[]>([]);
  const [visitsCount, setVisitsCount] = useState<number>(0);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);
  const [totalFilesCount, setTotalFilesCount] = useState<number>(0);

  // Selected files & upload states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadResults, setUploadResults] = useState<UploadedFileItem[]>([]);
  const [qrCodesMap, setQrCodesMap] = useState<{ [id: string]: string }>({});

  // Mobile menu drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Payment Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<'pro' | 'vip'>('pro');
  const [senderPhone, setSenderPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Auth & Forgot password modal states
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<'email' | 'phone'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<1 | 2 | 3>(1);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [selectedCountryDial, setSelectedCountryDial] = useState('+20');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPhoneNumber, setAuthPhoneNumber] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [surveyName, setSurveyName] = useState('');
  const [surveyCountry, setSurveyCountry] = useState('مصر');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync data from Firebase RTDB on initial load
  useEffect(() => {
    const fetchDatabaseData = async () => {
      try {
        const res = await fetch(`${FIREBASE_DB_URL}/.json`);
        const dbData = await res.json();

        if (dbData) {
          // Parse Servers
          if (dbData.servers) {
            const parsedServers: ServerOption[] = Object.entries(dbData.servers).map(([key, srv]: [string, any]) => ({
              key,
              name: srv.name || 'سيرفر عام',
              endpoint: srv.endpoint || '',
              active: srv.active ?? true,
            }));
            setServersList(parsedServers.filter((s) => s.active));
            if (parsedServers.length > 0) {
              setSelectedServer(parsedServers[0].key);
            }
          }

          // Parse Uploads Count & Items
          if (dbData.uploads) {
            const uploadEntries = Object.entries(dbData.uploads);
            setTotalFilesCount(uploadEntries.length);
            const parsedUploads: UploadedFileItem[] = uploadEntries.map(([id, item]: [string, any]) => ({
              id,
              fileName: item.fileName,
              fileSize: item.fileSize,
              url: item.url,
              userId: item.userId,
              userName: item.userName,
              serverId: item.serverId,
              timestamp: item.timestamp,
            }));
            setCloudFiles(parsedUploads.reverse());
          }

          // Parse Users Count
          if (dbData.users) {
            setSubscribersCount(Object.keys(dbData.users).length);
          }

          // Parse Visits Count & Increment
          const currentVisits = dbData.stats?.visits || 1422;
          const newVisits = currentVisits + 1;
          setVisitsCount(newVisits);

          // Update visit count in Firebase
          fetch(`${FIREBASE_DB_URL}/stats/visits.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newVisits),
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Error connecting to Firebase DB:', err);
      }
    };

    fetchDatabaseData();
  }, []);

  // Save user session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cn_user_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('cn_user_session');
    }
  }, [currentUser]);

  const switchMainPage = (pageName: PageType) => {
    if ((pageName === 'my-files' || pageName === 'sdk') && !currentUser) {
      openAuthModal();
      return;
    }
    setCurrentPage(pageName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuthModal = () => {
    setAuthStep(1);
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const logoutUser = () => {
    setCurrentUser(null);
    setCurrentPage('home');
    setMobileMenuOpen(false);
  };

  const openForgotPassword = () => {
    setAuthModalOpen(false);
    setResetSentSuccess(false);
    setForgotEmail(authEmail);
    setForgotPhone(authPhoneNumber);
    setForgotModalOpen(true);
  };

  const openPaymentModal = (plan: 'pro' | 'vip') => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    setSelectedPlanForPayment(plan);
    setSenderPhone(currentUser.phone || '');
    setWhatsappNumber(currentUser.phone || '');
    setReceiptFile(null);
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderPhone.trim() || !whatsappNumber.trim() || !receiptFile) {
      alert('يرجى ملء جميع الحقول وإرفاق إيصال التحويل');
      return;
    }

    setIsSubmittingPayment(true);
    const reader = new FileReader();
    reader.onload = () => {
      const receiptDataUrl = reader.result as string;
      const submission: PaymentSubmission = {
        id: 'pay_' + Date.now().toString(36),
        userId: currentUser!.uid,
        plan: selectedPlanForPayment,
        amount: selectedPlanForPayment === 'pro' ? 150 : 450,
        senderPhone,
        whatsappNumber,
        receiptImage: receiptDataUrl,
        status: 'pending',
        timestamp: Date.now(),
      };

      try {
        const existing = JSON.parse(localStorage.getItem('cn_payments') || '[]');
        localStorage.setItem('cn_payments', JSON.stringify([submission, ...existing]));
      } catch {}

      setIsSubmittingPayment(false);
      setPaymentModalOpen(false);
      alert('تم إرسال بيانات التحويل بنجاح! سيتم المراجعة وتفعيل الخطة والتواصل عبر الواتساب.');
    };
    reader.readAsDataURL(receiptFile);
  };

  const handleUserAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = authPhoneNumber.trim().replace(/^0+/, '');
    const fullPhone = `${selectedCountryDial}${cleanNumber}`;

    if (authMode === 'login') {
      const loggedUser: UserSession = {
        uid: 'Flh0crkbJThjwudCncFwFcYmYG82',
        name: authMethod === 'email' ? authEmail.split('@')[0] : 'Mahmoud Mostafa',
        email: authMethod === 'email' ? authEmail : 'support.cybenode@gmail.com',
        phone: fullPhone,
        photoURL: 'https://ui-avatars.com/api/?name=Mahmoud+Mostafa&background=2563eb&color=fff',
        plan: 'free',
        country: 'مصر',
        surveyCompleted: true,
      };
      setCurrentUser(loggedUser);
      closeAuthModal();
      alert(`أهلاً بعودتك، ${loggedUser.name}! تم تسجيل الدخول بنجاح.`);
    } else {
      setSurveyName(authMethod === 'email' ? authEmail.split('@')[0] : 'مستخدم جديد');
      setAuthStep(2);
    }
  };

  const selectInitialPlan = (planType: 'free' | 'pro' | 'vip') => {
    if (planType !== 'free') {
      closeAuthModal();
      openPaymentModal(planType);
      return;
    }

    const newUser: UserSession = {
      uid: 'usr_' + Date.now().toString(36),
      name: surveyName || 'مستخدم جديد',
      email: authMethod === 'email' ? authEmail : undefined,
      phone: authPhone || undefined,
      password: authPassword,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(surveyName || 'User')}&background=2563eb&color=fff`,
      plan: 'free',
      country: surveyCountry,
      surveyCompleted: true,
    };

    setCurrentUser(newUser);
    closeAuthModal();
    alert('تم إنشاء حسابك وتفعيل الخطة المجانية بنجاح!');
  };

  const handleUploadClick = async () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    if (selectedFiles.length === 0) {
      alert('يرجى اختيار ملف واحد على الأقل للرفع');
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);

    const newUploadedItems: UploadedFileItem[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadStatusText(`جاري رفع ${file.name}...`);
      setUploadPercent(Math.round(((i + 0.5) / selectedFiles.length) * 100));

      const fileDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.readAsDataURL(file);
      });

      const fileId = 'cf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const uploadedItem: UploadedFileItem = {
        id: fileId,
        fileName: file.name,
        fileSize: file.size,
        url: fileDataUrl,
        userId: currentUser.uid,
        userName: currentUser.name,
        serverId: selectedServer,
        timestamp: Date.now(),
      };

      newUploadedItems.push(uploadedItem);

      try {
        const qrUrl = await QRCode.toDataURL(fileDataUrl, {
          width: 100,
          margin: 1.5,
          color: { dark: '#090d16', light: '#ffffff' },
        });
        setQrCodesMap((prev) => ({ ...prev, [fileId]: qrUrl }));
      } catch {}

      await new Promise((r) => setTimeout(r, 150));
    }

    setUploadPercent(100);
    setUploadStatusText('اكتمل الرفع بنجاح!');
    setUploadResults(newUploadedItems);
    setCloudFiles((prev) => [...newUploadedItems, ...prev]);
    setTotalFilesCount((prev) => prev + newUploadedItems.length);
    setSelectedFiles([]);
    setIsUploading(false);
  };

  const userFiles = currentUser ? cloudFiles.filter((f) => f.userId === currentUser.uid) : [];

  return (
    <div className="bg-gray-950 text-gray-100 font-sans min-h-screen flex flex-col justify-between selection:bg-blue-600">
      {/* Header Navigation Bar */}
      <header className="bg-gray-900/90 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse cursor-pointer" onClick={() => switchMainPage('home')}>
            <img src={LOGO_URL} alt="CN Files Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-blue-500/20 border border-blue-500/30" />
            <span className="text-xl font-extrabold tracking-wide text-white">
              CN Files <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full mr-2">v3.0</span>
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 space-x-reverse text-sm font-semibold">
            <button onClick={() => switchMainPage('home')} className={`transition cursor-pointer ${currentPage === 'home' ? 'text-blue-400 font-bold' : 'hover:text-blue-400'}`}>
              الرئيسية
            </button>
            <button onClick={() => switchMainPage('my-files')} className={`transition cursor-pointer ${currentPage === 'my-files' ? 'text-blue-400 font-bold' : 'hover:text-blue-400'}`}>
              ملفاتي السحابية
            </button>
            <button onClick={() => switchMainPage('pricing')} className={`transition cursor-pointer ${currentPage === 'pricing' ? 'text-blue-400 font-bold' : 'hover:text-blue-400'}`}>
              الخطط والاشتراكات
            </button>
            <button onClick={() => switchMainPage('about')} className={`transition cursor-pointer ${currentPage === 'about' ? 'text-blue-400 font-bold' : 'hover:text-blue-400'}`}>
              من نحن
            </button>
            <button onClick={() => switchMainPage('contact')} className={`transition cursor-pointer ${currentPage === 'contact' ? 'text-blue-400 font-bold' : 'hover:text-blue-400'}`}>
              تواصل معنا
            </button>
          </nav>

          {/* Header Actions & Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!currentUser ? (
              <button onClick={openAuthModal} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-lg shadow-blue-600/30 flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>تسجيل الدخول / الحساب</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-[11px] bg-blue-500/20 border border-blue-500/40 text-blue-400 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full font-bold uppercase">
                  {currentUser.plan}
                </span>
                <button onClick={() => switchMainPage('my-files')} className="flex items-center gap-1.5 sm:gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2 sm:px-3 py-1.5 rounded-xl transition cursor-pointer">
                  <img className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-blue-500" src={currentUser.photoURL} alt="Avatar" />
                  <span className="text-xs sm:text-sm font-semibold text-gray-200 max-w-[85px] sm:max-w-none truncate">{currentUser.name}</span>
                </button>
                <button onClick={logoutUser} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 sm:p-2 rounded-xl transition border border-red-500/30 cursor-pointer" title="تسجيل الخروج">
                  <i className="fa-solid fa-power-off text-xs sm:text-sm"></i>
                </button>
              </div>
            )}

            {/* Mobile Sidebar Hamburger Toggle */}
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="md:hidden bg-gray-800 hover:bg-gray-700 text-gray-300 p-2 rounded-xl border border-gray-700 transition cursor-pointer flex items-center justify-center w-9 h-9 shrink-0 shadow-sm">
              <i className="fa-solid fa-bars text-base text-blue-400"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-grow space-y-8">
        {/* Real Dynamic Banner Statistics */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass p-4 rounded-2xl flex items-center gap-4 border border-gray-800 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-eye"></i>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-0.5">إجمالي الزيارات الحية</p>
              <h4 className="text-2xl font-black text-white font-mono tracking-wide">{visitsCount.toLocaleString()}</h4>
            </div>
          </div>

          <div className="glass p-4 rounded-2xl flex items-center gap-4 border border-gray-800 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-0.5">إجمالي الملفات المرفوعة</p>
              <h4 className="text-2xl font-black text-white font-mono tracking-wide">{totalFilesCount.toLocaleString()}</h4>
            </div>
          </div>

          <div className="glass p-4 rounded-2xl flex items-center gap-4 border border-gray-800 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-users"></i>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-0.5">المشتركين بالمنصة</p>
              <h4 className="text-2xl font-black text-white font-mono tracking-wide">{subscribersCount.toLocaleString()}</h4>
            </div>
          </div>
        </section>

        {/* PAGE 1: Upload View */}
        {currentPage === 'home' && (
          <div className="space-y-6">
            {!currentUser && (
              <div className="glass border border-gray-800 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
                <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-4xl mx-auto">
                  <i className="fa-solid fa-lock"></i>
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h2 className="text-2xl font-black text-white">تسجيل الدخول مطلوب للرفع</h2>
                  <p className="text-gray-400 text-sm">يرجى تسجيل الدخول أو إنشاء حساب جديد لتتمكن من رفع الصور والملفات وحفظها بحسابك.</p>
                </div>
                <button onClick={openAuthModal} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-8 py-3 rounded-2xl transition shadow-lg shadow-blue-600/30 inline-flex items-center gap-2 cursor-pointer">
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>تسجيل الدخول / إنشاء حساب</span>
                </button>
              </div>
            )}

            {currentUser && (
              <div className="glass border border-gray-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-3xl md:text-4xl font-black text-white tracking-wide">رفع الملفات والصور السحابية</h1>
                  <p className="text-gray-400 text-sm max-w-md mx-auto">ارفع ملفاتك بسرعة فائقة وبأمان تام عبر خوادمنا الموزعة عالمياً</p>
                </div>

                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-3xl p-8 text-center bg-gray-900/50 cursor-pointer transition flex flex-col items-center justify-center min-h-[220px]">
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-3xl mb-4">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <p className="text-gray-200 font-bold text-base mb-1">
                    اسحب وأسقط الملفات هنا، أو <span className="text-blue-400 underline">اضغط لاختيار ملفاتك</span>
                  </p>
                  <p className="text-gray-400 text-xs">يدعم الصور، المستندات، الأكواد، والفيديوهات</p>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="p-3 bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-3 text-xs">
                        <i className="fa-solid fa-file text-blue-400 text-lg"></i>
                        <div className="flex-grow truncate">
                          <p className="font-bold text-gray-200 truncate">{file.name}</p>
                          <p className="text-gray-500 text-[10px]">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2">اختر سيرفر الرفع النشط</label>
                    <select value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded-xl px-4 py-3 outline-none cursor-pointer">
                      {serversList.map((srv) => (
                        <option key={srv.key} value={srv.key}>
                          {srv.name} ({srv.endpoint})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleUploadClick} disabled={isUploading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold py-3 rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                      <i className="fa-solid fa-rocket"></i>
                      <span>{isUploading ? 'جاري الرفع السحابي...' : 'بدء الرفع السحابي الآن'}</span>
                    </button>
                  </div>
                </div>

                {isUploading && (
                  <div className="mt-6 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-gray-300">
                      <span>{uploadStatusText}</span>
                      <span className="text-blue-400">{uploadPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadPercent}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {uploadResults.length > 0 && (
              <div className="glass border border-gray-800 rounded-3xl p-6 shadow-xl space-y-4">
                <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i> تم الرفع والحفظ بنجاح!
                </h2>
                <div className="space-y-3">
                  {uploadResults.map((item) => (
                    <div key={item.id} className="p-4 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col md:flex-row items-center gap-4">
                      {qrCodesMap[item.id] && <img src={qrCodesMap[item.id]} alt="QR" className="w-16 h-16 bg-white p-1 rounded-xl" />}
                      <div className="flex-grow w-full space-y-2">
                        <p className="font-bold text-sm text-gray-200">{item.fileName}</p>
                        <input type="text" readOnly value={item.url} className="w-full bg-gray-950 border border-gray-800 text-xs text-blue-400 p-2.5 rounded-xl outline-none" />
                        <button onClick={() => { navigator.clipboard.writeText(item.url); alert('تم نسخ الرابط!'); }} className="bg-blue-600 hover:bg-blue-700 text-xs text-white px-4 py-2 rounded-xl transition cursor-pointer">
                          نسخ الرابط المباشر
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 2: User Cloud Files */}
        {currentPage === 'my-files' && (
          <div className="glass border border-gray-800 rounded-3xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-4">
              <i className="fa-solid fa-folder-open text-blue-500"></i> ملفاتي المرفوعة ({userFiles.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {userFiles.length === 0 ? (
                <p className="text-gray-500 text-sm text-center col-span-full py-8">لا توجد ملفات مرفوعة في حسابك بعد.</p>
              ) : (
                userFiles.map((file) => (
                  <div key={file.id} className="p-4 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col justify-between space-y-3">
                    <p className="font-bold text-xs text-gray-200 truncate">{file.fileName}</p>
                    <div className="flex justify-between text-xs pt-2 border-t border-gray-800">
                      <button onClick={() => { navigator.clipboard.writeText(file.url); alert('تم نسخ رابط الملف!'); }} className="text-blue-400 hover:underline cursor-pointer">مشاركة</button>
                      <button onClick={() => setCloudFiles((prev) => prev.filter((f) => f.id !== file.id))} className="text-red-400 hover:underline cursor-pointer">حذف</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PAGE 3: Plans & Pricing */}
        {currentPage === 'pricing' && (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-black text-white">خطط الاشتراكات والترقية</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto">اختر الخطة المناسبة واشترك بأمان عبر التحويل المباشر</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass border border-gray-800 rounded-3xl p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <span className="text-xs bg-gray-800 text-gray-300 px-3 py-1 rounded-full font-bold">الخطة المجانية</span>
                  <h3 className="text-3xl font-black text-white">0 <span className="text-xs font-normal text-gray-400">ج.م / شهرياً</span></h3>
                  <ul className="space-y-3 text-xs text-gray-300">
                    <li><i className="fa-solid fa-check text-emerald-400"></i> رفع صور ومستندات أساسية</li>
                    <li><i className="fa-solid fa-check text-emerald-400"></i> خوادم عامة</li>
                  </ul>
                </div>
                <button onClick={() => selectInitialPlan('free')} className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl text-sm transition">
                  {currentUser?.plan === 'free' ? 'خيارك الحالي' : 'الخطة المجانية'}
                </button>
              </div>

              <div className="glass border border-blue-500/50 rounded-3xl p-6 flex flex-col justify-between space-y-6 relative">
                <div className="space-y-4">
                  <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full font-bold">الخطة الاحترافية (Pro)</span>
                  <h3 className="text-3xl font-black text-white">150 <span className="text-xs font-normal text-gray-400">ج.م / شهرياً</span></h3>
                  <ul className="space-y-3 text-xs text-gray-300">
                    <li><i className="fa-solid fa-check text-emerald-400"></i> رفع جميع الصيغ بلا حدود</li>
                    <li><i className="fa-solid fa-check text-emerald-400"></i> خوادم فائقة السرعة</li>
                    <li><i className="fa-solid fa-check text-emerald-400"></i> دعم فني مخصص</li>
                  </ul>
                </div>
                <button onClick={() => openPaymentModal('pro')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-blue-600/30 cursor-pointer">
                  اشترك الآن (150 ج.م)
                </button>
              </div>

              <div className="glass border border-amber-500/50 rounded-3xl p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold">سيرفر خاص VIP</span>
                  <h3 className="text-3xl font-black text-white">450 <span className="text-xs font-normal text-gray-400">ج.م / شهرياً</span></h3>
                  <ul className="space-y-3 text-xs text-gray-300">
                    <li><i className="fa-solid fa-check text-amber-400"></i> سيرفر خاص بك كامل</li>
                    <li><i className="fa-solid fa-check text-amber-400"></i> حزمة SDK وAPI خاصة</li>
                    <li><i className="fa-solid fa-check text-amber-400"></i> سعة NVMe بريميوم</li>
                  </ul>
                </div>
                <button onClick={() => openPaymentModal('vip')} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-gray-950 font-extrabold py-3 rounded-xl text-sm transition shadow-lg shadow-amber-500/30 cursor-pointer">
                  طلب السيرفر الخاص (450 ج.م)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 4: Privacy & Security */}
        {currentPage === 'privacy' && (
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-10 space-y-6 text-sm text-gray-300 leading-relaxed">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4">سياسة الخصوصية والأمان</h2>
            <p>نحن في <strong>CN Files</strong> نلتزم بأعلى معايير حماية البيانات والخصوصية الرقمية. تتضمن سياستنا البنود التالية:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>تشفير البيانات:</strong> يتم تشفير جميع ملفاتك أثناء النقل والتخزين بأعلى بروتوكولات الأمان SSL/TLS.</li>
              <li><strong>سرية المعلومات:</strong> لا نقوم ببيع أو مشاركة بياناتك الشخصية أو ملفاتك مع أي أطراف خارجية إطلاقاً.</li>
              <li><strong>التحكم الكامل:</strong> يحق لك حذف ملفاتك أو حسابك نهائياً في أي وقت من خلال خيارات التحكم بالمنصة.</li>
            </ul>
          </div>
        )}

        {/* PAGE 5: Terms of Use */}
        {currentPage === 'terms' && (
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-10 space-y-6 text-sm text-gray-300 leading-relaxed">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4">شروط الاستخدام</h2>
            <p>باستخدامك لمنصة CN Files، فإنك توافق على الشروط والضوابط التالية:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>يُمنع منعاً باتاً رفع أو مشاركة أي محتوى يرتكب مخالفات قانونية أو ينتهك حقوق الملكية الفكرية.</li>
              <li>المستخدم مسؤول مسؤولية كاملة عن سلامة وصحة الملفات والمحتوى الذي يقوم بنشره عبر حسابه.</li>
              <li>نحتفظ بحق تعليق الحسابات التي تتجاوز الاستخدام العادل أو تسبب ضرراً لأداء سيرفرات المنصة.</li>
            </ul>
          </div>
        )}

        {/* PAGE 6: About Us */}
        {currentPage === 'about' && (
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-10 space-y-6 text-sm text-gray-300 leading-relaxed">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4">من نحن</h2>
            <p>
              <strong>CN Files</strong> هي منصة سحابية متطورة تابعة لشبكة <strong>CybeNode</strong>، تم تطويرها لتوفير حلول سريعة وآمنة لرفع، حفظ، ومشاركة الصور والملفات عبر الإنترنت.
            </p>
            <p>
              هدفنا الأساسي هو تقديم تجربة استخدام فائقة بأسعار مناسبة، مع الاعتماد على خوادم ومراكز بيانات عالمية توفر أقصى معدل استقرار وسرعة نقل بيانات.
            </p>
          </div>
        )}

        {/* PAGE 7: Contact Us */}
        {currentPage === 'contact' && (
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-10 space-y-6">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4">تواصل معنا</h2>
            <p className="text-sm text-gray-300">فريق الدعم الفني متواجد لمساعدتك والإجابة على الاستفسارات طوال الأسبوع.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl shrink-0">
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">البريد الإلكتروني الرسمي</span>
                  <a href={`mailto:${OFFICIAL_EMAIL}`} className="text-white font-bold text-sm hover:text-blue-400">{OFFICIAL_EMAIL}</a>
                </div>
              </div>

              <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                  <i className="fa-brands fa-whatsapp"></i>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">واتساب والدفع المباشر</span>
                  <span className="text-white font-bold text-sm font-mono" dir="ltr">{PAYMENT_NUMBER}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Payment Gateway Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative space-y-6">
            <button onClick={() => setPaymentModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white cursor-pointer">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="text-center space-y-2">
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">بوابة الدفع الآمنة</span>
              <h2 className="text-xl font-bold text-white">
                تأكيد الاشتراك - خطة {selectedPlanForPayment === 'pro' ? 'الاحترافية (Pro)' : 'السيرفر الخاص (VIP)'}
              </h2>
              <p className="text-xs text-gray-400">
                المبلغ المطلوب: <span className="text-emerald-400 font-bold font-mono text-sm">{selectedPlanForPayment === 'pro' ? '150' : '450'} ج.م</span>
              </p>
            </div>

            <div className="p-4 bg-gray-900/90 border border-emerald-500/30 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400">قم بتحويل المبلغ إلى رقم كاش:</span>
                <span className="text-emerald-400 font-bold font-mono text-base" dir="ltr">{PAYMENT_NUMBER}</span>
              </div>
              <p className="text-gray-400">يدعم التحويل من كافة المحافظ الإلكترونية (فودافون كاش، أورنج، اتصالات، وي، فوري، المحافظ البنكية).</p>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">رقم المحفظة التي قمت بالتحويل منها *</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 text-right font-mono"
                  placeholder="01000000000"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">رقم الواتساب للتواصل وتأكيد التفعيل *</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 text-right font-mono"
                  placeholder="01000000000"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">صورة إيصال / لقطة شاشة التحويل (Screenshot) *</label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full bg-gray-900 border border-gray-800 text-gray-300 rounded-xl p-2 outline-none cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPayment ? 'جاري إرسال الإيصال...' : 'تأكيد وإرسال التحويل'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative space-y-5">
            <button onClick={() => setForgotModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white cursor-pointer">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30 text-xl mb-2">
                <i className="fa-solid fa-key"></i>
              </div>
              <h2 className="text-xl font-bold text-white">استعادة كلمة المرور</h2>
              <p className="text-xs text-gray-400">سيتم إرسال رابط آمن ومباشر لإعادة تعيين كلمة المرور</p>
            </div>

            {!resetSentSuccess ? (
              <form onSubmit={(e) => { e.preventDefault(); setResetSentSuccess(true); }} className="space-y-4">
                <div className="flex items-center justify-center gap-6 text-xs text-gray-300 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={forgotMethod === 'email'} onChange={() => setForgotMethod('email')} className="accent-blue-600 cursor-pointer" />
                    <span>البريد الإلكتروني</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={forgotMethod === 'phone'} onChange={() => setForgotMethod('phone')} className="accent-blue-600 cursor-pointer" />
                    <span>رقم الهاتف</span>
                  </label>
                </div>

                {forgotMethod === 'email' ? (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">البريد الإلكتروني المسجل</label>
                    <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 outline-none" placeholder="name@domain.com" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">رقم الهاتف المسجل</label>
                    <input type="tel" required dir="ltr" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3.5 py-2.5 text-sm focus:border-blue-500 outline-none text-right font-mono" placeholder="01000000000" />
                  </div>
                )}

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold transition shadow-lg shadow-blue-600/30 cursor-pointer">
                  إرسال رابط إعادة التعيين
                </button>
              </form>
            ) : (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3">
                <i className="fa-solid fa-paper-plane text-emerald-400 text-2xl"></i>
                <p className="text-xs text-emerald-300 leading-relaxed">
                  تم إرسال رابط تعيين كلمة المرور بنجاح إلى ({forgotMethod === 'email' ? forgotEmail : forgotPhone}). يرجى مراجعة رسائلك واتباع التعليمات.
                </p>
                <button onClick={() => setForgotModalOpen(false)} className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-4 py-2 rounded-xl transition cursor-pointer">
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative space-y-6">
            <button onClick={closeAuthModal} className="absolute top-4 left-4 text-gray-400 hover:text-white cursor-pointer">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            {authStep === 1 && (
              <div className="space-y-4">
                <div className="flex bg-gray-900 p-1 rounded-2xl border border-gray-800">
                  <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${authMode === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
                    تسجيل الدخول
                  </button>
                  <button type="button" onClick={() => setAuthMode('register')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${authMode === 'register' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
                    إنشاء حساب جديد
                  </button>
                </div>

                <h2 className="text-xl font-bold text-center text-white">{authMode === 'login' ? 'تسجيل الدخول إلى حسابك' : 'إنشاء حساب جديد بالمنصة'}</h2>

                <div className="flex items-center justify-center gap-6 text-xs text-gray-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={authMethod === 'email'} onChange={() => setAuthMethod('email')} className="accent-blue-600 cursor-pointer" />
                    <span>البريد الإلكتروني</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={authMethod === 'phone'} onChange={() => setAuthMethod('phone')} className="accent-blue-600 cursor-pointer" />
                    <span>رقم الهاتف</span>
                  </label>
                </div>

                <form onSubmit={handleUserAuth} className="space-y-3">
                  {authMethod === 'email' ? (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">البريد الإلكتروني</label>
                      <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 outline-none" placeholder="example@domain.com" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">رقم الهاتف المحمول</label>
                      <input type="tel" required dir="ltr" value={authPhoneNumber} onChange={(e) => setAuthPhoneNumber(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3.5 py-2.5 text-sm focus:border-blue-500 outline-none text-right font-mono" placeholder="01000000000" />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs text-gray-400">كلمة المرور</label>
                      {authMode === 'login' && (
                        <button type="button" onClick={openForgotPassword} className="text-xs text-blue-400 hover:underline cursor-pointer">
                          نسيت كلمة المرور؟
                        </button>
                      )}
                    </div>
                    <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 outline-none" placeholder="••••••••" />
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold transition shadow-lg shadow-blue-600/30 cursor-pointer">
                    {authMode === 'login' ? 'تسجيل الدخول' : 'المتابعة لإنشاء الحساب'}
                  </button>
                </form>
              </div>
            )}

            {authStep === 2 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-bold text-white">استكمال البيانات الأساسية</h2>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); setAuthStep(3); }} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">الاسم بالكامل *</label>
                    <input type="text" required value={surveyName} onChange={(e) => setSurveyName(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">البلد *</label>
                    <select value={surveyCountry} onChange={(e) => setSurveyCountry(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 cursor-pointer">
                      {COUNTRIES_LIST.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold transition cursor-pointer">
                    المتابعة لاختيار الخطة
                  </button>
                </form>
              </div>
            )}

            {authStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-center text-white">اختر الخطة للبدء</h2>
                <div className="space-y-3">
                  <div onClick={() => selectInitialPlan('free')} className="p-3 bg-gray-900 border border-gray-800 rounded-xl cursor-pointer hover:border-blue-500 transition flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm text-white">الخطة المجانية</h4>
                      <p className="text-[11px] text-gray-400">رفع أساسي على خوادم عامة</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">مجاناً</span>
                  </div>

                  <div onClick={() => selectInitialPlan('pro')} className="p-3 bg-gray-900 border border-blue-500/40 rounded-xl cursor-pointer hover:border-blue-500 transition flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm text-blue-400">الخطة الاحترافية (Pro)</h4>
                      <p className="text-[11px] text-gray-400">رفع بلا حدود وسيرفرات فائقة</p>
                    </div>
                    <span className="text-xs font-bold text-white">150 ج.م</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-xs bg-gray-950 border-r border-gray-800 h-full p-5 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <div className="flex items-center space-x-2.5 space-x-reverse cursor-pointer" onClick={() => { switchMainPage('home'); setMobileMenuOpen(false); }}>
                  <img src={LOGO_URL} alt="CN Files Logo" className="w-8 h-8 rounded-xl object-cover border border-blue-500/30" />
                  <span className="font-black text-white text-base">CN Files</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white border border-gray-800">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              {currentUser && (
                <div className="p-3 bg-gray-900 rounded-2xl border border-gray-800 flex items-center gap-3">
                  <img src={currentUser.photoURL} alt={currentUser.name} className="w-10 h-10 rounded-full border border-blue-500 object-cover" />
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-sm text-white truncate">{currentUser.name}</h4>
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                      {currentUser.plan}
                    </span>
                  </div>
                </div>
              )}

              <nav className="space-y-2 text-sm font-bold">
                <button onClick={() => { switchMainPage('home'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-xl transition ${currentPage === 'home' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-300 hover:bg-gray-900'}`}>
                  <span>الرئيسية</span>
                  <i className="fa-solid fa-house"></i>
                </button>
                <button onClick={() => { switchMainPage('my-files'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-xl transition ${currentPage === 'my-files' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-300 hover:bg-gray-900'}`}>
                  <span>ملفاتي السحابية</span>
                  <i className="fa-solid fa-folder-open"></i>
                </button>
                <button onClick={() => { switchMainPage('pricing'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-xl transition ${currentPage === 'pricing' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-300 hover:bg-gray-900'}`}>
                  <span>الخطط والاشتراكات</span>
                  <i className="fa-solid fa-gem"></i>
                </button>
                <button onClick={() => { switchMainPage('about'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-xl transition ${currentPage === 'about' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-300 hover:bg-gray-900'}`}>
                  <span>من نحن</span>
                  <i className="fa-solid fa-circle-info"></i>
                </button>
                <button onClick={() => { switchMainPage('contact'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-xl transition ${currentPage === 'contact' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-300 hover:bg-gray-900'}`}>
                  <span>تواصل معنا</span>
                  <i className="fa-solid fa-envelope"></i>
                </button>
              </nav>
            </div>

            <div className="pt-4 border-t border-gray-800 text-center text-xs text-gray-500">
              CN Files Cloud &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900/90 border-t border-gray-800 py-6 text-xs text-gray-400 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="CN Files Logo" className="w-7 h-7 rounded-lg object-cover border border-blue-500/30" />
            <div>
              <span className="font-bold text-gray-200">CN Files Cloud</span>
              <p className="text-[11px] text-gray-500">منصة رفع وحفظ الملفات السحابية المتقدمة</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button onClick={() => switchMainPage('privacy')} className="hover:text-blue-400 transition">سياسة الخصوصية</button>
            <button onClick={() => switchMainPage('terms')} className="hover:text-blue-400 transition">شروط الاستخدام</button>
            <button onClick={() => switchMainPage('contact')} className="hover:text-blue-400 transition">تواصل معنا</button>
          </div>

          <div>
            <span>جميع الحقوق محفوظة &copy; {new Date().getFullYear()} لـ </span>
            <a href="https://cybenode.site" target="_blank" rel="noopener noreferrer" className="text-blue-400 font-bold hover:underline">
              CybeNode (cybenode.site)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
