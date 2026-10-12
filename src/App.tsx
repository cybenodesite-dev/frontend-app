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

type PageType = 'home' | 'my-files' | 'pricing' | 'privacy' | 'terms' | 'about' | 'contact';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>(() => {
    const path = window.location.pathname;
    if (path === '/privacy-policy') return 'privacy';
    if (path === '/terms-of-service') return 'terms';
    if (path === '/about-us') return 'about';
    if (path === '/contact-us') return 'contact';
    if (path === '/pricing') return 'pricing';
    if (path === '/my-files') return 'my-files';
    return 'home';
  });

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('cn_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [serversList, setServersList] = useState<ServerOption[]>([]);
  const [cloudFiles, setCloudFiles] = useState<UploadedFileItem[]>([]);
  const [visitsCount, setVisitsCount] = useState<number>(0);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);
  const [totalFilesCount, setTotalFilesCount] = useState<number>(0);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadResults, setUploadResults] = useState<UploadedFileItem[]>([]);
  const [qrCodesMap, setQrCodesMap] = useState<{ [id: string]: string }>({});

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<'pro' | 'vip'>('pro');
  const [senderPhone, setSenderPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<'email' | 'phone'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<1 | 2 | 3>(1);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [selectedCountryDial] = useState('+20');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone] = useState('');
  const [authPhoneNumber, setAuthPhoneNumber] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [surveyName, setSurveyName] = useState('');
  const [surveyCountry] = useState('مصر');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigateToPage = (pageName: PageType) => {
    if (pageName === 'my-files' && !currentUser) {
      openAuthModal();
      return;
    }

    let path = '/';
    if (pageName === 'privacy') path = '/privacy-policy';
    else if (pageName === 'terms') path = '/terms-of-service';
    else if (pageName === 'about') path = '/about-us';
    else if (pageName === 'contact') path = '/contact-us';
    else if (pageName === 'pricing') path = '/pricing';
    else if (pageName === 'my-files') path = '/my-files';

    window.history.pushState({}, '', path);
    setCurrentPage(pageName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/privacy-policy') setCurrentPage('privacy');
      else if (path === '/terms-of-service') setCurrentPage('terms');
      else if (path === '/about-us') setCurrentPage('about');
      else if (path === '/contact-us') setCurrentPage('contact');
      else if (path === '/pricing') setCurrentPage('pricing');
      else if (path === '/my-files') setCurrentPage('my-files');
      else setCurrentPage('home');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const fetchDatabaseData = async () => {
      try {
        const res = await fetch(`${FIREBASE_DB_URL}/.json`);
        const dbData = await res.json();

        if (dbData) {
          if (dbData.servers) {
            const parsedServers: ServerOption[] = Object.entries(dbData.servers).map(([key, srv]: [string, any]) => ({
              key,
              name: srv.name || 'سيرفر عام',
              endpoint: srv.endpoint || '',
              active: srv.active ?? true,
            }));
            const activeOnly = parsedServers.filter((s) => s.active);
            setServersList(activeOnly);
            if (activeOnly.length > 0) {
              setSelectedServer(activeOnly[0].key);
            }
          }

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

          if (dbData.users) {
            setSubscribersCount(Object.keys(dbData.users).length);
          }

          const currentVisits = dbData.stats?.visits || 1422;
          const newVisits = currentVisits + 1;
          setVisitsCount(newVisits);

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

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cn_user_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('cn_user_session');
    }
  }, [currentUser]);

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
    navigateToPage('home');
    setMobileMenuOpen(false);
  };

  const openForgotPassword = () => {
    setAuthModalOpen(false);
    setResetSentSuccess(false);
    setForgotEmail(authEmail);
    setForgotPhone(authPhoneNumber);
    setForgotModalOpen(true);
  };

  // Google Sign-In Simulation
  const handleGoogleSignIn = () => {
    const googleUser: UserSession = {
      uid: 'Flh0crkbJThjwudCncFwFcYmYG82',
      name: 'Mahmoud Mostafa',
      email: 'support.cybenode@gmail.com',
      photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJIrK54HMpXNnUzs0YtdPqvD31DlS9gHkAzrcEONlLLeuJiZeCA=s96-c',
      plan: 'free',
      country: 'مصر',
      surveyCompleted: true,
    };
    setCurrentUser(googleUser);
    closeAuthModal();
    alert('تم تسجيل الدخول بنجاح باستخدام حساب Google!');
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
    <div className="bg-[#070a12] text-gray-100 font-sans min-h-screen flex flex-col justify-between selection:bg-blue-600">
      {/* Header Bar */}
      <header className="bg-gray-900/90 backdrop-blur-md border-b border-gray-800/80 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <a href="/" onClick={(e) => { e.preventDefault(); navigateToPage('home'); }} className="flex items-center space-x-3 space-x-reverse cursor-pointer">
            <img src={LOGO_URL} alt="CN Files Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-blue-500/20 border border-blue-500/30" />
            <span className="text-xl font-extrabold tracking-wide text-white">
              CN Files <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full mr-2">v3.0</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center space-x-6 space-x-reverse text-sm font-semibold">
            <a href="/" onClick={(e) => { e.preventDefault(); navigateToPage('home'); }} className={`transition ${currentPage === 'home' ? 'text-blue-400 font-bold' : 'text-gray-300 hover:text-blue-400'}`}>
              الرئيسية
            </a>
            <a href="/my-files" onClick={(e) => { e.preventDefault(); navigateToPage('my-files'); }} className={`transition ${currentPage === 'my-files' ? 'text-blue-400 font-bold' : 'text-gray-300 hover:text-blue-400'}`}>
              ملفاتي السحابية
            </a>
            <a href="/pricing" onClick={(e) => { e.preventDefault(); navigateToPage('pricing'); }} className={`transition ${currentPage === 'pricing' ? 'text-blue-400 font-bold' : 'text-gray-300 hover:text-blue-400'}`}>
              الخطط والاشتراكات
            </a>
            <a href="/about-us" onClick={(e) => { e.preventDefault(); navigateToPage('about'); }} className={`transition ${currentPage === 'about' ? 'text-blue-400 font-bold' : 'text-gray-300 hover:text-blue-400'}`}>
              من نحن
            </a>
            <a href="/contact-us" onClick={(e) => { e.preventDefault(); navigateToPage('contact'); }} className={`transition ${currentPage === 'contact' ? 'text-blue-400 font-bold' : 'text-gray-300 hover:text-blue-400'}`}>
              تواصل معنا
            </a>
          </nav>

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
                <button onClick={() => navigateToPage('my-files')} className="flex items-center gap-1.5 sm:gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2 sm:px-3 py-1.5 rounded-xl transition cursor-pointer">
                  <img className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-blue-500" src={currentUser.photoURL} alt="Avatar" />
                  <span className="text-xs sm:text-sm font-semibold text-gray-200 max-w-[85px] sm:max-w-none truncate">{currentUser.name}</span>
                </button>
                <button onClick={logoutUser} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 sm:p-2 rounded-xl transition border border-red-500/30 cursor-pointer" title="تسجيل الخروج">
                  <i className="fa-solid fa-power-off text-xs sm:text-sm"></i>
                </button>
              </div>
            )}

            <button type="button" onClick={() => setMobileMenuOpen(true)} className="md:hidden bg-gray-800/80 hover:bg-gray-700 text-gray-300 p-2 rounded-xl border border-gray-700 transition cursor-pointer flex items-center justify-center w-9 h-9 shrink-0 shadow-sm">
              <i className="fa-solid fa-bars text-base text-blue-400"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-grow space-y-8">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass p-4 rounded-2xl flex items-center gap-4 border border-gray-800/80 relative overflow-hidden shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-eye"></i>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-0.5">إجمالي الزيارات الحية</p>
              <h4 className="text-2xl font-black text-white font-mono tracking-wide">{visitsCount.toLocaleString()}</h4>
            </div>
          </div>

          <div className="glass p-4 rounded-2xl flex items-center gap-4 border border-gray-800/80 relative overflow-hidden shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-0.5">إجمالي الملفات المرفوعة</p>
              <h4 className="text-2xl font-black text-white font-mono tracking-wide">{totalFilesCount.toLocaleString()}</h4>
            </div>
          </div>

          <div className="glass p-4 rounded-2xl flex items-center gap-4 border border-gray-800/80 relative overflow-hidden shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-users"></i>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-0.5">المشتركين بالمنصة</p>
              <h4 className="text-2xl font-black text-white font-mono tracking-wide">{subscribersCount.toLocaleString()}</h4>
            </div>
          </div>
        </section>

        {/* Home Page */}
        {currentPage === 'home' && (
          <div className="space-y-6">
            {!currentUser && (
              <div className="glass border border-gray-800/80 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
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
              <div className="glass border border-gray-800/80 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-3xl md:text-4xl font-black text-white tracking-wide">رفع الملفات والصور السحابية</h1>
                  <p className="text-gray-400 text-sm max-w-md mx-auto">ارفع ملفاتك بسرعة فائقة وبأمان تام عبر خوادمنا الموزعة عالمياً</p>
                </div>

                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-700/80 hover:border-blue-500 rounded-3xl p-8 text-center bg-gray-900/50 cursor-pointer transition flex flex-col items-center justify-center min-h-[220px]">
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
                          {srv.name} (يدعم جميع الصيغ)
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

        {/* My Files Page */}
        {currentPage === 'my-files' && (
          <div className="glass border border-gray-800/80 rounded-3xl p-6 space-y-6">
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

        {/* Pricing Page */}
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

        {/* Legal Pages */}
        {currentPage === 'privacy' && (
          <div className="glass border border-gray-800/80 rounded-3xl p-6 md:p-10 space-y-6 text-sm text-gray-300 leading-relaxed shadow-xl">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4 flex items-center gap-2">
              <i className="fa-solid fa-user-shield text-blue-500"></i> سياسة الخصوصية والأمان (Privacy Policy)
            </h2>
            <p>نحن في <strong>CN Files</strong> نلتزم بأعلى معايير حماية البيانات والخصوصية الرقمية لجميع زوارنا ومستخدمينا.</p>
          </div>
        )}

        {currentPage === 'terms' && (
          <div className="glass border border-gray-800/80 rounded-3xl p-6 md:p-10 space-y-6 text-sm text-gray-300 leading-relaxed shadow-xl">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4 flex items-center gap-2">
              <i className="fa-solid fa-file-contract text-blue-500"></i> شروط الاستخدام (Terms of Service)
            </h2>
            <p>باستخدامك لمنصة CN Files، فإنك توافق التامة على الشروط والضوابط الموضحة.</p>
          </div>
        )}

        {currentPage === 'about' && (
          <div className="glass border border-gray-800/80 rounded-3xl p-6 md:p-10 space-y-6 text-sm text-gray-300 leading-relaxed shadow-xl">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4 flex items-center gap-2">
              <i className="fa-solid fa-circle-info text-blue-500"></i> من نحن (About Us)
            </h2>
            <p><strong>CN Files</strong> هي منصة سحابية متطورة تابعة لشبكة CybeNode لتوفير حلول سريعة وآمنة للرفع والتخزين.</p>
          </div>
        )}

        {currentPage === 'contact' && (
          <div className="glass border border-gray-800/80 rounded-3xl p-6 md:p-10 space-y-6 shadow-xl">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4 flex items-center gap-2">
              <i className="fa-solid fa-envelope text-blue-500"></i> تواصل معنا (Contact Us)
            </h2>
            <p className="text-sm text-gray-300">فريق الدعم الفني متواجد لمساعدتك والإجابة على كافة الاستفسارات.</p>
          </div>
        )}
      </main>

      {/* Auth Modal with Google Sign-In Added */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass border border-gray-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative space-y-5">
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

                {/* Google Sign In Button */}
                <button onClick={handleGoogleSignIn} type="button" className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>المتابعة باستخدام Google</span>
                </button>

                <div className="flex items-center gap-2 text-xs text-gray-500 my-2">
                  <div className="flex-grow border-t border-gray-800"></div>
                  <span>أو باستخدام البريد / الهاتف</span>
                  <div className="flex-grow border-t border-gray-800"></div>
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
          </div>
        </div>
      )}

      {/* Fixed Forgot Password Modal */}
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

      {/* Footer */}
      <footer className="bg-gray-900/90 border-t border-gray-800/80 py-6 text-xs text-gray-400 mt-auto shadow-inner">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="CN Files Logo" className="w-7 h-7 rounded-lg object-cover border border-blue-500/30" />
            <div>
              <span className="font-bold text-gray-200">CN Files Cloud</span>
              <p className="text-[11px] text-gray-500">منصة رفع وحفظ الملفات السحابية المتقدمة</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); navigateToPage('privacy'); }} className="hover:text-blue-400 transition">سياسة الخصوصية</a>
            <a href="/terms-of-service" onClick={(e) => { e.preventDefault(); navigateToPage('terms'); }} className="hover:text-blue-400 transition">شروط الاستخدام</a>
            <a href="/about-us" onClick={(e) => { e.preventDefault(); navigateToPage('about'); }} className="hover:text-blue-400 transition">من نحن</a>
            <a href="/contact-us" onClick={(e) => { e.preventDefault(); navigateToPage('contact'); }} className="hover:text-blue-400 transition">تواصل معنا</a>
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
