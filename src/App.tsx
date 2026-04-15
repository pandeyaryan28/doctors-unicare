import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Clock,
  History,
  Bell,
  Plus,
  ChevronRight,
  ChevronDown,
  Activity,
  FileText,
  Calendar,
  CalendarCheck,
  CalendarX,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Stethoscope,
  Pill,
  FileSearch,
  ClipboardCheck,
  LogOut,
  Sun,
  Moon,
  UserCog,
  Save,
  Printer,
  Phone,
  MapPin,
  Award,
  Hash,
  Timer,
  UserPlus,
  X,
  Search,
  PlayCircle,
  SkipForward,
  Hourglass,
  ClipboardList,
  ChevronUp,
  RefreshCw,
  Menu,
  Clock as ClockIcon,
  QrCode,
  ScanLine,
  UserCheck,
  Camera,
  Keyboard,
} from 'lucide-react';
import { cn, calculateAge, formatDateTime } from './lib/utils';
import { Patient, Consultation, QueueItem, PacketData, Medicine, Appointment, AppointmentStatus } from './types';
import { useAuth } from './contexts/AuthContext';
import type { DoctorProfile } from './contexts/AuthContext';
import { supabase, patientSupabase } from './lib/supabase';
import { classifyQRContent, resolvePatientCode } from './services/patientIdentityService';
import LoginPage from './pages/LoginPage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Theme ───────────────────────────────────────────────────────────────────

function getInitialTheme(): boolean {
  const saved = localStorage.getItem('theme');
  if (saved) return saved === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    localStorage.setItem('theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    localStorage.setItem('theme', 'light');
  }
}

// ─── Medicine helpers ─────────────────────────────────────────────────────────

function formatMedicineTiming(med: Medicine): string {
  const timing = (med.timing || []).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
  const food = med.food === 'before' ? 'Before Food' : 'After Food';
  const days = med.days ? `${med.days} day${med.days !== 1 ? 's' : ''}` : '';
  return [timing, food, days].filter(Boolean).join(' • ');
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function useElapsedTime(startISO: string | null): string {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!startISO) { setElapsed(''); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(startISO).getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startISO]);
  return elapsed;
}

function useWaitTime(createdAt: string): string {
  const [wait, setWait] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      const m = Math.floor(diff / 60);
      if (m < 1) setWait('<1 min');
      else if (m < 60) setWait(`${m} min`);
      else setWait(`${Math.floor(m / 60)}h ${m % 60}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [createdAt]);
  return wait;
}

function TokenBadge({ token }: { token: number }) {
  return (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm shadow-lg shadow-blue-200 dark:shadow-none flex-shrink-0">
      #{String(token).padStart(2, '0')}
    </span>
  );
}

// ─── PDF Generator ───────────────────────────────────────────────────────────

const PrescriptionPDF = (consultation: Consultation, patient: Patient, doctor: DoctorProfile) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(doctor.clinic_name || 'UniCare Health', 20, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if ((doctor as any).clinic_address) doc.text((doctor as any).clinic_address, 20, 27);
  if ((doctor as any).phone) doc.text(`Tel: ${(doctor as any).phone}`, 20, 33);

  const doctorName = `DR. ${(doctor.full_name || 'Doctor').toUpperCase()}`;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(doctorName, pageWidth - 20, 16, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (doctor.specialty) doc.text(doctor.specialty, pageWidth - 20, 22, { align: 'right' });
  if ((doctor as any).qualification) doc.text((doctor as any).qualification, pageWidth - 20, 28, { align: 'right' });
  if (doctor.registration_number) doc.text(`Reg No: ${doctor.registration_number}`, pageWidth - 20, 34, { align: 'right' });

  doc.setFillColor(249, 250, 251);
  doc.rect(20, 52, pageWidth - 40, 30, 'F');
  doc.setDrawColor(243, 244, 246);
  doc.rect(20, 52, pageWidth - 40, 30, 'D');

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.text('PATIENT NAME', 25, 60);
  doc.text('AGE / GENDER', 85, 60);
  doc.text('PATIENT ID', 135, 60);
  doc.text('DATE', pageWidth - 25, 60, { align: 'right' });

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(patient.name.toUpperCase(), 25, 68);
  doc.text(`${patient.age}Y / ${patient.gender.toUpperCase()}`, 85, 68);
  doc.text(`#${patient.id.slice(0, 8).toUpperCase()}`, 135, 68);
  doc.text(new Date().toLocaleDateString('en-IN'), pageWidth - 25, 68, { align: 'right' });

  doc.setTextColor(37, 99, 235);
  doc.setFontSize(32);
  doc.text('Rx', 20, 98);

  doc.setTextColor(75, 85, 99);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CHIEF COMPLAINTS:', 20, 113);
  doc.setFont('helvetica', 'normal');
  doc.text(consultation.symptoms || 'None reported', 20, 120, { maxWidth: pageWidth - 40 });

  doc.setFont('helvetica', 'bold');
  doc.text('DIAGNOSIS:', 20, 134);
  doc.setFont('helvetica', 'normal');
  doc.text(consultation.diagnosis || 'Clinical evaluation pending', 20, 141, { maxWidth: pageWidth - 40 });

  autoTable(doc, {
    startY: 155,
    head: [['Medicine', 'Timing', 'Food', 'Duration']],
    body: consultation.medicines.map(m => [
      m.name.toUpperCase(),
      (m.timing || []).map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ') || '—',
      m.food === 'before' ? 'Before Food' : m.food === 'after' ? 'After Food' : '—',
      m.days ? `${m.days} day${m.days !== 1 ? 's' : ''}` : '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold', halign: 'left' },
    bodyStyles: { fontSize: 10, textColor: [31, 41, 55], cellPadding: 6 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 20, right: 20 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  if (consultation.notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('ADVICE / NOTES:', 20, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(consultation.notes, 20, finalY + 7, { maxWidth: pageWidth - 40 });
  }

  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(229, 231, 235);
  doc.line(20, footerY, pageWidth - 20, footerY);
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('This is a digitally generated prescription. Valid only with doctor seal/signature.', pageWidth / 2, footerY + 10, { align: 'center' });
  doc.text('UniCare EMR Security Hash: ' + btoa(consultation.id).slice(0, 16), pageWidth / 2, footerY + 16, { align: 'center' });
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Digitally Signed by:', pageWidth - 20, footerY + 26, { align: 'right' });
  doc.text(doctorName, pageWidth - 20, footerY + 32, { align: 'right' });

  return doc;
};

// ─── PatientRecordView ────────────────────────────────────────────────────────

const PatientRecordView = ({
  packet, onClose, onPreview,
}: {
  packet: PacketData; onClose: () => void; onPreview: (record: any) => void;
}) => (
  <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-slate-950/20">
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-sm">Back</span>
        </button>
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
          Health Packet Verified
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-start gap-8">
        <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/40 rounded-3xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
          <Users className="w-10 h-10" />
        </div>
        <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8">
          <div className="col-span-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{packet.profile_data.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {packet.profile_data.dob ? `${calculateAge(packet.profile_data.dob)} years • Born ${formatDateTime(packet.profile_data.dob)}` : 'Age unknown'}
            </p>
          </div>
          <div><p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Gender</p><p className="font-bold text-gray-900 dark:text-white">{packet.profile_data.gender}</p></div>
          <div><p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Blood Group</p><p className="font-bold text-red-600 dark:text-red-400">{packet.profile_data.blood_group}</p></div>
        </div>
      </div>
      {packet.medical_history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 px-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg"><ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            Medical History
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packet.medical_history.map((h, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">{h.question}</p>
                <p className="text-gray-900 dark:text-gray-100 font-medium">{h.answer || 'No response'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 px-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg"><FileSearch className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
          Shared Records ({packet.records.length})
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {packet.records.length > 0 ? packet.records.map((r, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-blue-400 transition-all">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl", r.type === 'lab' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600")}><FileText className="w-6 h-6" /></div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{r.title}</h3>
                  <p className="text-xs text-gray-400 font-medium uppercase">{r.provider} • {formatDateTime(r.date)}</p>
                </div>
              </div>
              <button onClick={() => onPreview(r)} className="px-6 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-bold text-xs hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                <FileSearch className="w-4 h-4" />View
              </button>
            </div>
          )) : (
            <div className="bg-gray-50 dark:bg-slate-900/50 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center">
              <p className="text-sm font-medium text-gray-400">No clinical records shared.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

// ─── MediaPreviewModal ────────────────────────────────────────────────────────

const MediaPreviewModal = ({ record, onClose }: { record: any; onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-12">
    <div className="bg-white dark:bg-slate-900 w-full h-full rounded-3xl overflow-hidden flex flex-col shadow-2xl">
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
          <div><h3 className="font-bold text-gray-900 dark:text-white">{record.title}</h3><p className="text-xs text-gray-500 font-medium">{record.file_name} • {record.file_type}</p></div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
      </div>
      <div className="flex-1 bg-gray-900 flex items-center justify-center overflow-auto p-4">
        {record.file_type?.includes('pdf') ? (
          <iframe src={record.file_url} className="w-full h-full rounded-xl" title={record.title} />
        ) : (
          <img src={record.file_url} alt={record.title} className="max-w-full max-h-full object-contain rounded-xl" />
        )}
      </div>
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-4">
        <button onClick={() => window.open(record.file_url, '_blank')} className="px-6 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-all">Open in Tab</button>
        <button onClick={onClose} className="px-6 py-2 bg-gray-900 dark:bg-blue-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all">Close</button>
      </div>
    </div>
  </div>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const Sidebar = ({
  darkMode, onToggleTheme, open, onClose,
}: {
  darkMode: boolean; onToggleTheme: () => void; open?: boolean; onClose?: () => void;
}) => {
  const { doctorProfile, signOut } = useAuth();
  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Patients', icon: Users, path: '/patients' },
    { label: 'Today\'s Patients', icon: Clock, path: '/queue' },
    { label: 'Appointments', icon: Calendar, path: '/appointments' },
    { label: 'Consultations', icon: History, path: '/consultations' },
  ];
  const initials = doctorProfile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';

  return (
    <>
      {/* Overlay backdrop for mobile */}
      {open && <div className="mobile-overlay" onClick={onClose} />}

      <motion.div
        className={cn(
          "w-64 bg-white dark:bg-slate-900/90 backdrop-blur-xl border-r border-gray-100 dark:border-slate-800 flex flex-col h-screen z-50",
          // Desktop: sticky in flow; Mobile: fixed drawer
          "md:sticky md:top-0",
          "max-md:fixed max-md:top-0 max-md:left-0 max-md:shadow-2xl",
        )}
        initial={false}
        animate={{
          x: typeof open !== 'undefined' ? (open ? 0 : '-100%') : 0,
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ display: 'flex' }}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
              <Stethoscope className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white leading-tight">UniCare</h1>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tracking-widest uppercase">EMR Portal</p>
            </div>
          </div>
          {/* Close button visible only on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Main Menu</p>
          {menuItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) => cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-200/50 dark:shadow-none" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:hover:text-white"
              )}>
              {({ isActive }) => (<><item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600")} /><span className="font-bold text-sm">{item.label}</span></>)}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-2">
          <button onClick={onToggleTheme} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:hover:text-white transition-all group">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", darkMode ? "bg-slate-700 text-yellow-400" : "bg-blue-50 text-blue-600")}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </div>
            <span className="font-bold text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        <div className="p-4 border-t border-gray-50 dark:border-slate-800 space-y-2">
          <NavLink to="/profile" onClick={onClose} className={({ isActive }) => cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
            isActive ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800" : "bg-gray-50 dark:bg-slate-800/50 border-transparent dark:border-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-800"
          )}>
            {doctorProfile?.avatar_url ? (
              <img src={doctorProfile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-xs flex-shrink-0">{initials}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doctorProfile?.full_name || 'Doctor'}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1"><UserCog className="w-2.5 h-2.5" />Edit Profile</p>
            </div>
          </NavLink>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all text-sm font-medium">
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </motion.div>
    </>
  );
};

// ─── Mobile Bottom Navigation ─────────────────────────────────────────────────

const MobileBottomNav = ({ darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void }) => {
  const navItems = [
    { label: 'Home', icon: LayoutDashboard, path: '/' },
    { label: 'Patients', icon: Clock, path: '/queue' },
    { label: 'Appts', icon: Calendar, path: '/appointments' },
    { label: 'History', icon: History, path: '/consultations' },
    { label: darkMode ? 'Light' : 'Dark', icon: darkMode ? Sun : Moon, path: null },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) =>
        item.path ? (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className="w-5 h-5"
                  style={{ color: isActive ? '#2563eb' : undefined }}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ) : (
          <button key={item.label} onClick={onToggleTheme}>
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        )
      )}
    </nav>
  );
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl group-hover:scale-110 transition-transform duration-500", colors[color] || color)}><Icon className="w-6 h-6" /></div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Today</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1 animate-pulse" />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
};

// ─── QR Scanner Modal (Camera + Keyboard, auto-classify) ────────────────────

type ScanTab = 'camera' | 'keyboard';
type ScanState = 'idle' | 'scanning' | 'resolved' | 'failed';

interface QRScannerModalProps {
  onScanPacket: (url: string) => void;
  /** New: Accept UC-XXXXXXXX code (from camera or typed input) */
  onScanPatientCode: (code: string) => void;
  onClose: () => void;
}

function QRScannerModal({ onScanPacket, onScanPatientCode, onClose }: QRScannerModalProps) {
  const [tab, setTab] = useState<ScanTab>('camera');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [input, setInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const cameraContainerId = 'qr-camera-viewport';
  const scannerRef = useRef<any>(null);
  const processingRef = useRef(false); // debounce / lock

  /** Dispatch classified QR content to the right handler */
  const dispatchScan = useCallback((raw: string) => {
    if (processingRef.current) return; // prevent double-fire
    processingRef.current = true;
    setLocalError(null);

    const classified = classifyQRContent(raw);

    if (classified.type === 'patient_qr' || classified.type === 'patient_code') {
      setScanState('resolved');
      onScanPatientCode(classified.code);
      onClose();
    } else if (classified.type === 'shared_packet') {
      setScanState('resolved');
      onScanPacket(classified.uuid);
      onClose();
    } else {
      setScanState('failed');
      setLocalError('Unrecognised QR code. Please scan a valid UniCare patient QR or enter a UC- code.');
      processingRef.current = false; // allow retry
    }
  }, [onScanPacket, onScanPatientCode, onClose]);

  // ── Camera scanner lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    if (tab !== 'camera') {
      // Stop and clear scanner when switching away
      if (scannerRef.current) {
        try { scannerRef.current.clear(); } catch { /* ignore */ }
        scannerRef.current = null;
      }
      setScanState('idle');
      processingRef.current = false;
      return;
    }

    // Dynamically import html5-qrcode to avoid SSR issues
    let cancelled = false;
    (async () => {
      try {
        const { Html5QrcodeScanner, Html5QrcodeScanType } = await import('html5-qrcode');
        if (cancelled) return;

        setScanState('scanning');
        const scanner = new Html5QrcodeScanner(
          cameraContainerId,
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
          },
          /* verbose = */ false
        );
        scannerRef.current = scanner;

        scanner.render(
          (decoded: string) => {
            if (!cancelled) dispatchScan(decoded);
          },
          (err: string) => {
            // Per-frame errors are normal (no QR in frame) — ignore
            if (!err.includes('No QR')) {
              console.debug('[QRScanner] scan frame error:', err);
            }
          }
        );
      } catch (initErr: any) {
        if (!cancelled) {
          setScanState('failed');
          setLocalError(
            initErr?.message?.includes('NotAllowedError') || initErr?.message?.includes('Permission')
              ? 'Camera permission denied. Please allow camera access and try again.'
              : `Could not start camera: ${initErr?.message || initErr}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        try { scannerRef.current.clear(); } catch { /* ignore */ }
        scannerRef.current = null;
      }
    };
  }, [tab, dispatchScan]);

  // ── Keyboard (type/paste) submit ──────────────────────────────────────────

  const handleKeyboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    dispatchScan(input.trim());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Patient Intake</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scan QR or type the UC- patient code</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-0 border-b border-gray-100 dark:border-slate-800">
          <button
            onClick={() => { setTab('camera'); setLocalError(null); processingRef.current = false; }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all border-b-2',
              tab === 'camera'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            )}
          >
            <Camera className="w-4 h-4" />
            Camera
          </button>
          <button
            onClick={() => { setTab('keyboard'); setLocalError(null); processingRef.current = false; }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all border-b-2',
              tab === 'keyboard'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            )}
          >
            <Keyboard className="w-4 h-4" />
            Type / Paste
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── Camera tab ── */}
          {tab === 'camera' && (
            <>
              {/* html5-qrcode mounts its UI inside this div */}
              <div
                id={cameraContainerId}
                className="w-full rounded-2xl overflow-hidden bg-black min-h-[260px] flex items-center justify-center"
              />
              {scanState === 'idle' && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Initialising camera…
                </div>
              )}
              {scanState === 'scanning' && (
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  Point camera at a <span className="font-bold text-blue-600 dark:text-blue-400">UniCare patient QR code</span>
                </p>
              )}
            </>
          )}

          {/* ── Keyboard tab ── */}
          {tab === 'keyboard' && (
            <form onSubmit={handleKeyboardSubmit} className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                Enter a <span className="font-bold">UC-XXXXXXXX</span> patient code, a health packet UUID, or paste QR content directly.
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setLocalError(null); processingRef.current = false; }}
                placeholder="e.g. UC-A8KM3NQZ or packet UUID"
                className="w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 dark:shadow-none"
              >
                <UserCheck className="w-4 h-4" />
                Identify Patient
              </button>
            </form>
          )}

          {/* ── Error banner ── */}
          {localError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{localError}</p>
            </motion.div>
          )}

          {/* ── Info chip ── */}
          <p className="text-center text-[10px] text-gray-400 dark:text-gray-500">
            Supports permanent patient codes <span className="font-mono font-bold">UC-XXXXXXXX</span> and time-limited health packets
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Add Walk-in Modal ────────────────────────────────────────────────────────

interface AddToQueueModalProps {
  patients: Patient[];
  onAdd: (patientId: string, complaint: string, newPatient?: Omit<Patient, 'id'>) => Promise<void>;
  onClose: () => void;
}

function AddToQueueModal({ patients, onAdd, onClose }: AddToQueueModalProps) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [complaint, setComplaint] = useState('');
  const [newForm, setNewForm] = useState({ name: '', age: '', gender: 'Male', phone: '' });
  const [loading, setLoading] = useState(false);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone && p.phone.includes(search))
  );

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (tab === 'existing' && selectedPatient) {
        await onAdd(selectedPatient.id, complaint);
      } else if (tab === 'new' && newForm.name) {
        await onAdd('', complaint, { name: newForm.name, age: parseInt(newForm.age) || 0, gender: newForm.gender, phone: newForm.phone });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Patient to Queue</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Select an existing patient or register a walk-in</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
            {(['existing', 'new'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2", tab === t ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}>
                {t === 'existing' ? <><Search className="w-3.5 h-3.5" />Existing Patient</> : <><UserPlus className="w-3.5 h-3.5" />New Walk-in</>}
              </button>
            ))}
          </div>

          {tab === 'existing' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {filtered.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">No patients found</p>
                ) : filtered.map(p => (
                  <button key={p.id} onClick={() => setSelectedPatient(p)} className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    selectedPatient?.id === p.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-transparent bg-gray-50 dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700"
                  )}>
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm flex-shrink-0">{p.name[0]}</div>
                    <div><p className="font-bold text-gray-900 dark:text-white text-sm">{p.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{p.age}Y · {p.gender} {p.phone && `· ${p.phone}`}</p></div>
                    {selectedPatient?.id === p.id && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input type="text" placeholder="Full Name *" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Age" value={newForm.age} onChange={e => setNewForm(p => ({ ...p, age: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                <select value={newForm.gender} onChange={e => setNewForm(p => ({ ...p, gender: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <input type="tel" placeholder="Phone (optional)" value={newForm.phone} onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          )}

          {/* Chief complaint */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Chief Complaint (optional)</label>
            <input type="text" placeholder="e.g. Fever since 3 days, headache..." value={complaint} onChange={e => setComplaint(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || (tab === 'existing' ? !selectedPatient : !newForm.name)}
            className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Add to Queue
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Queue Token Card ─────────────────────────────────────────────────────────

const WaitingCard: React.FC<{ item: QueueItem; onStart: () => void; onRemove: () => void }> = ({ item, onStart, onRemove }) => {
  const wait = useWaitTime(item.created_at);
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <TokenBadge token={item.token_number} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-white truncate">{item.patient?.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.patient?.age}Y · {item.patient?.gender}</p>
        </div>
        <div className="flex items-center gap-1.5 text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2.5 py-1 rounded-full">
          <Hourglass className="w-3 h-3" />
          <span className="text-[10px] font-bold">{wait}</span>
        </div>
      </div>
      {item.chief_complaint && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 px-3 py-2 rounded-xl mb-3 italic">
          "{item.chief_complaint}"
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={onRemove}
          className="p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
        <button onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-100 dark:shadow-none">
          <PlayCircle className="w-4 h-4" />
          Start Consultation
        </button>
      </div>
    </motion.div>
  );
}

function ConsultingCard({ item, onOpen }: { item: QueueItem; onOpen: () => void }) {
  const elapsed = useElapsedTime(item.called_at);
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-xl shadow-blue-200/50 dark:shadow-none relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
      <div className="flex items-center gap-3 mb-3 relative">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm">
          #{String(item.token_number).padStart(2, '0')}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100">In Consultation</span>
          </div>
          <p className="font-bold text-white">{item.patient?.name}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full">
          <Timer className="w-3 h-3" />
          <span className="text-[10px] font-bold">{elapsed}</span>
        </div>
      </div>
      {item.chief_complaint && <p className="text-xs text-blue-100 italic mb-3">"{item.chief_complaint}"</p>}
      <button onClick={onOpen} className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/20">
        <FileText className="w-4 h-4" />Open Consultation Form
      </button>
    </motion.div>
  );
}

const CompletedCard: React.FC<{ item: QueueItem }> = ({ item }) => {
  const elapsed = item.called_at
    ? `${Math.round((new Date(item.updated_at).getTime() - new Date(item.called_at).getTime()) / 60000)} min`
    : '—';
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50">
      <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-black flex-shrink-0">
        #{String(item.token_number).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.patient?.name}</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{item.patient?.age}Y · {item.patient?.gender}</p>
      </div>
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-[10px] font-bold">{elapsed}</span>
      </div>
    </div>
  );
}

// ─── Page: Dashboard ─────────────────────────────────────────────────────────

function DashboardPage({ patients, queue, onQRScan, onScanPatientCode, onStartConsultation }: {
  patients: Patient[];
  queue: QueueItem[];
  onQRScan: (url: string) => void;
  onScanPatientCode: (code: string) => void;
  onStartConsultation: (item: QueueItem) => void;
}) {
  const navigate = useNavigate();
  const { doctorProfile } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const waiting = queue.filter(q => q.status === 'waiting');
  const completed = queue.filter(q => q.status === 'completed');
  const inConsult = queue.find(q => q.status === 'in-consultation');

  const clinicCode = (doctorProfile as any)?.clinic_code || '';
  const bookingUrl = clinicCode ? `https://unicare-patient.vercel.app/book?d=${clinicCode}` : '';

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }
      else { setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); }
    } catch {}
  };

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      {/* ── Clinic Booking Code card ── */}
      {clinicCode && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-blue-100 dark:border-blue-900/50 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 px-6 py-4 border-b border-blue-100 dark:border-blue-900/50 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Clinic Booking Code</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Share this code — patients use it to book appointments with you</p>
            </div>
          </div>

          <div className="p-6 flex flex-col sm:flex-row gap-6 items-center">
            {/* QR Code */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="w-[130px] h-[130px] rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-slate-700 bg-white p-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&margin=2&data=${encodeURIComponent(bookingUrl)}`}
                  alt="Booking QR Code"
                  className="w-full h-full"
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">Scan to book</p>
            </div>

            {/* Code + URL */}
            <div className="flex-1 min-w-0 space-y-4 w-full">
              {/* The code itself — big and prominent */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Clinic Code</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 flex items-center justify-between">
                    <span className="text-2xl font-black tracking-[0.2em] text-blue-600 dark:text-blue-400 font-mono">
                      {clinicCode}
                    </span>
                    <span className="text-xs text-gray-400 ml-3">permanent</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(clinicCode, 'code')}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all',
                      codeCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    )}
                  >
                    {codeCopied ? <CheckCircle2 className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>


              {/* Instruction hint */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  Patients enter <strong>{clinicCode}</strong> in UniCare to book appointments directly with you. This code never changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Patients" value={patients.length} icon={Users} color="blue" />
        <StatCard label="Waiting" value={waiting.length} icon={Hourglass} color="orange" />
        <StatCard label="In Session" value={inConsult ? 1 : 0} icon={Activity} color="purple" />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* QR Scan panel */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">QR Patient Access</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Scan health packet or register a new patient</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowScanner(true)}
              className="flex flex-col items-center gap-3 p-5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-2 border-blue-100 dark:border-blue-800/50 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none group-hover:scale-105 transition-transform">
                <ScanLine className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-blue-700 dark:text-blue-300 text-sm">Health Packet</p>
                <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">Dynamic medical history</p>
              </div>
            </button>
            <button
              onClick={() => setShowScanner(true)}
              className="flex flex-col items-center gap-3 p-5 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border-2 border-green-100 dark:border-green-800/50 rounded-2xl transition-all group"
            >
              <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-none group-hover:scale-105 transition-transform">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-green-700 dark:text-green-300 text-sm">Patient ID</p>
                <p className="text-[10px] text-green-500 dark:text-green-400 mt-0.5">Permanent registration</p>
              </div>
            </button>
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="w-full mt-4 py-3 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />Open Scanner
          </button>
        </div>

        {/* Live Queue Preview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Live Queue</h3>
            <button onClick={() => navigate('/queue')} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              Manage <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {inConsult && (
            <div className="mb-4">
              <ConsultingCard item={inConsult} onOpen={() => navigate('/consultation')} />
            </div>
          )}
          <div className="space-y-3">
            {waiting.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                <TokenBadge token={item.token_number} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{item.patient?.name}</p>
                  <p className="text-[10px] text-gray-500">{item.patient?.age}Y · {item.patient?.gender}</p>
                </div>
                <button onClick={() => onStartConsultation(item)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                  <PlayCircle className="w-3 h-3" />Start
                </button>
              </div>
            ))}
            {waiting.length === 0 && !inConsult && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Queue is empty</p>
              </div>
            )}
            {waiting.length > 3 && (
              <p className="text-xs text-center text-gray-400 font-medium">+{waiting.length - 3} more waiting</p>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showScanner && (
          <QRScannerModal
            onScanPacket={(url) => { onQRScan(url); setShowScanner(false); }}
            onScanPatientCode={(code) => { onScanPatientCode(code); setShowScanner(false); }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Patient History Drawer ───────────────────────────────────────────────────

function PatientHistoryDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [consultations, setConsultations] = useState<(Consultation & { patient?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { doctorProfile } = useAuth();

  useEffect(() => {
    setLoading(true);
    supabase
      .from('consultations')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setConsultations((data as unknown as Consultation[]) || []);
        setLoading(false);
      });
  }, [patient.id]);

  const handleReprint = (c: Consultation) => {
    if (!doctorProfile) return;
    const doc = PrescriptionPDF(c, patient, doctorProfile);
    doc.save(`Rx_${patient.name.replace(/\s+/g, '_')}_${new Date(c.created_at).toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[90] flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-gray-100 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
            {patient.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white">{patient.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{patient.age}Y · {patient.gender}{patient.phone ? ` · ${patient.phone}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Consultation history */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Consultation History ({consultations.length})</p>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-400">No consultations yet</p>
            </div>
          ) : consultations.map(c => (
            <div key={c.id} className="bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full flex items-start gap-3 p-4 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{c.diagnosis || 'No diagnosis recorded'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {(c.medicines as Medicine[])?.length || 0} medication(s)
                  </p>
                  {c.symptoms && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic truncate">{c.symptoms}</p>}
                </div>
                {expanded === c.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
              </button>
              <AnimatePresence>
                {expanded === c.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-200 dark:border-slate-700">
                    <div className="p-4 space-y-3">
                      {c.medicines && (c.medicines as Medicine[]).length > 0 && (
                        <div className="space-y-2">
                          {(c.medicines as Medicine[]).map((m, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-900 rounded-xl">
                              <Pill className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase">{m.name}</p>
                                <p className="text-[10px] text-gray-500">{formatMedicineTiming(m)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {c.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">{c.notes}</p>
                      )}
                      <button onClick={() => handleReprint(c)}
                        className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all">
                        <Printer className="w-3.5 h-3.5" />Reprint Prescription
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page: Patients ───────────────────────────────────────────────────────────

function PatientsPage({ patients, onSelectPatient }: { patients: Patient[]; onSelectPatient: (p: Patient) => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone && p.phone.includes(search))
  );

  return (
    <>
    <motion.div key="patients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search patients by name or phone..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-5 py-3.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50 dark:border-slate-800">
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Patient</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Age / Gender</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Contact</th>
              <th className="text-right py-4 px-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((patient) => (
              <tr key={patient.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm flex-shrink-0">{patient.name[0]}</div>
                    <span className="font-bold text-gray-900 dark:text-white">{patient.name}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">{patient.age}Y / {patient.gender}</td>
                <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">{patient.phone || '—'}</td>
                <td className="py-4 px-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setHistoryPatient(patient)}
                      className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-bold text-xs hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />History
                    </button>
                    <button onClick={() => { onSelectPatient(patient); navigate('/consultation'); }}
                      className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-bold text-xs hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />Consult
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No patients found</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No patients found</p>
          </div>
        ) : filtered.map((patient) => (
          <div key={patient.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base flex-shrink-0">
              {patient.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white truncate">{patient.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.age}Y · {patient.gender}{patient.phone ? ` · ${patient.phone}` : ''}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setHistoryPatient(patient)}
                className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <History className="w-4 h-4" />
              </button>
              <button onClick={() => { onSelectPatient(patient); navigate('/consultation'); }}
                className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>

    <AnimatePresence>
      {historyPatient && (
        <PatientHistoryDrawer patient={historyPatient} onClose={() => setHistoryPatient(null)} />
      )}
    </AnimatePresence>
    </>
  );
}

// ─── Page: Queue (Unified — Walk-ins + Confirmed Appointments) ───────────────

function QueuePage({
  queue, patients, onStartConsultation, onRemoveFromQueue, onAddToQueue, onQRScan, onScanPatientCode,
}: {
  queue: QueueItem[];
  patients: Patient[];
  onStartConsultation: (item: QueueItem) => void;
  onRemoveFromQueue: (id: string) => void;
  onAddToQueue: (patientId: string, complaint: string, newPatient?: Omit<Patient, 'id'>) => Promise<void>;
  onQRScan: (url: string) => void;
  onScanPatientCode: (code: string) => void;
}) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const waiting = queue.filter(q => q.status === 'waiting').sort((a, b) => a.token_number - b.token_number);
  const inConsult = queue.find(q => q.status === 'in-consultation');
  const completed = queue.filter(q => q.status === 'completed').sort((a, b) => b.token_number - a.token_number);

  const avgWait = waiting.length > 0
    ? Math.round(waiting.reduce((acc, item) => acc + (Date.now() - new Date(item.created_at).getTime()) / 60000, 0) / waiting.length)
    : 0;

  return (
    <motion.div key="queue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-3 py-1 rounded-full">{waiting.length} in queue</span>
            {inConsult && <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">1 in session</span>}
            <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">{completed.length} seen</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            <QrCode className="w-4 h-4" />Scan
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all text-sm">
            <UserPlus className="w-4 h-4" />Add Walk-in
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main queue list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-widest">
              Waiting ({waiting.length})
            </h3>
          </div>
          <AnimatePresence>
            {waiting.map((item) => {
              const handleStart = () => { onStartConsultation(item); navigate('/consultation'); };
              return <WaitingCard key={item.id} item={item} onStart={handleStart} onRemove={() => onRemoveFromQueue(item.id)} />;
            })}
          </AnimatePresence>
          {waiting.length === 0 && !inConsult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-100 dark:border-slate-800 p-12 text-center">
              <Hourglass className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-400">Queue is empty</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Walk-ins and confirmed appointments appear here</p>
              <button onClick={() => setShowModal(true)} className="mt-4 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mx-auto">
                <Plus className="w-3.5 h-3.5" />Add a walk-in patient
              </button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-widest">In Session</h3>
            </div>
            {inConsult ? (
              <ConsultingCard item={inConsult} onOpen={() => navigate('/consultation')} />
            ) : (
              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-slate-800 p-8 text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-xs font-medium text-gray-400">No active session</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today's Summary</h4>
            {[
              { label: 'Patients Seen', value: completed.length, icon: CheckCircle2, color: 'text-green-600' },
              { label: 'Still Waiting', value: waiting.length, icon: Clock, color: 'text-orange-500' },
              { label: 'Avg Wait Time', value: avgWait > 0 ? `${avgWait} min` : '—', icon: Timer, color: 'text-blue-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Icon className={cn('w-4 h-4', color)} />
                  <span className="text-sm">{label}</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white text-sm">{value}</span>
              </div>
            ))}
          </div>

          {completed.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <button onClick={() => setShowCompleted(v => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="font-bold text-gray-900 dark:text-white text-sm">Seen Today ({completed.length})</span>
                </div>
                {showCompleted ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showCompleted && (
                <div className="px-4 pb-4 space-y-2 max-h-60 overflow-y-auto">
                  {completed.map(item => <CompletedCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && <AddToQueueModal patients={patients} onAdd={onAddToQueue} onClose={() => setShowModal(false)} />}

      <AnimatePresence>
        {showScanner && (
          <QRScannerModal
            onScanPacket={(url) => { onQRScan(url); setShowScanner(false); }}
            onScanPatientCode={(code) => { onScanPatientCode(code); setShowScanner(false); }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page: Consultations History ──────────────────────────────────────────────

function ConsultationsPage() {
  const { doctorProfile } = useAuth();
  const [consultations, setConsultations] = useState<(Consultation & { patient?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorProfile) return;
    const fetchConsultations = async () => {
      setLoading(true);
      try {
        const { data: raw } = await supabase
          .from('consultations')
          .select('*, patient:patients(*)')
          .eq('doctor_id', doctorProfile.id)
          .order('created_at', { ascending: false })
          .limit(100);
        const typed = (raw ?? []) as unknown as (Consultation & { patient?: Patient })[];
        setConsultations(typed);
      } finally {
        setLoading(false);
      }
    };
    fetchConsultations();
  }, [doctorProfile]);

  const filtered = consultations.filter(c =>
    c.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
    c.symptoms?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by date
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, c) => {
    const date = new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(c);
    return acc;
  }, {});

  const handleReprint = (c: Consultation & { patient?: Patient }) => {
    if (!doctorProfile || !c.patient) return;
    const doc = PrescriptionPDF(c, c.patient, doctorProfile);
    doc.save(`Rx_${c.patient.name.replace(/\s+/g, '_')}_${new Date(c.created_at).toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);
  };

  return (
    <motion.div key="consultations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search by patient, diagnosis, or symptoms..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-5 py-3.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-16 text-center shadow-sm">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No consultations yet</h3>
          <p className="text-gray-400 text-sm">Completed consultations will appear here.</p>
        </div>
      ) : (
        (Object.entries(grouped) as [string, (Consultation & { patient?: Patient })[]][]).map(([date, items]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{date}</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map(c => (
                <div key={c.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Summary row */}
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {c.patient?.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white">{c.patient?.name || 'Unknown Patient'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {c.patient?.age}Y · {c.patient?.gender} ·
                        <span className="text-blue-600 dark:text-blue-400 font-medium ml-1">{c.diagnosis || 'No diagnosis'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {(c.medicines as Medicine[])?.length || 0} medicine{(c.medicines as Medicine[])?.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {expanded === c.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {expanded === c.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-50 dark:border-slate-800">
                        <div className="p-5 space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {c.symptoms && (
                              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Symptoms</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{c.symptoms}</p>
                              </div>
                            )}
                            {c.diagnosis && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Diagnosis</p>
                                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{c.diagnosis}</p>
                              </div>
                            )}
                          </div>
                          {c.medicines && c.medicines.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Prescribed Medicines</p>
                              <div className="space-y-2">
                                {c.medicines.map((m: Medicine, i: number) => (
                                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-gray-900 dark:text-white text-sm uppercase">{m.name}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatMedicineTiming(m)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {c.notes && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Doctor's Notes</p>
                              <p className="text-sm text-amber-700 dark:text-amber-300">{c.notes}</p>
                            </div>
                          )}
                          <div className="flex justify-end">
                            <button onClick={() => handleReprint(c)}
                              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-100 dark:shadow-none">
                              <Printer className="w-4 h-4" />Reprint Rx
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
}

// ─── Medicine Entry UI ────────────────────────────────────────────────────────

const TimingChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={cn(
    "px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-200 select-none",
    active ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none scale-105" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:border-blue-400"
  )}>{label}</button>
);

const MedicineEntryForm = ({ newMedicine, setNewMedicine, addMedicine }: {
  newMedicine: Medicine; setNewMedicine: React.Dispatch<React.SetStateAction<Medicine>>; addMedicine: () => void;
}) => {
  const toggleTiming = (t: 'morning' | 'noon' | 'evening') => {
    setNewMedicine(prev => ({ ...prev, timing: prev.timing.includes(t) ? prev.timing.filter(x => x !== t) : [...prev.timing, t] }));
  };
  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/50 space-y-4">
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Medicine Name</label>
        <input type="text" placeholder="e.g. Paracetamol 500mg" value={newMedicine.name} onChange={(e) => setNewMedicine(p => ({ ...p, name: e.target.value }))}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white dark:placeholder:text-gray-500 transition-all" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">When to Take</label>
        <div className="flex gap-2 flex-wrap">
          <TimingChip label="Morning" active={newMedicine.timing.includes('morning')} onClick={() => toggleTiming('morning')} />
          <TimingChip label="Noon" active={newMedicine.timing.includes('noon')} onClick={() => toggleTiming('noon')} />
          <TimingChip label="Evening" active={newMedicine.timing.includes('evening')} onClick={() => toggleTiming('evening')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Food Timing</label>
          <div className="flex gap-2">
            {(['before', 'after'] as const).map(f => (
              <button key={f} type="button" onClick={() => setNewMedicine(p => ({ ...p, food: f }))} className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all",
                newMedicine.food === f ? "bg-green-600 border-green-600 text-white" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 hover:border-green-400"
              )}>{f === 'before' ? 'Before Food' : 'After Food'}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Duration (Days)</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={365} placeholder="5" value={newMedicine.days || ''} onChange={(e) => setNewMedicine(p => ({ ...p, days: parseInt(e.target.value) || 0 }))}
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-all" />
            <span className="text-xs font-bold text-gray-400 shrink-0">days</span>
          </div>
        </div>
      </div>
      <button type="button" onClick={addMedicine} disabled={!newMedicine.name || newMedicine.timing.length === 0}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-100 dark:shadow-none">
        <Plus className="w-4 h-4" />Add Medicine
      </button>
    </div>
  );
};

// ─── Live Consultation Timer ──────────────────────────────────────────────────

function ConsultationTimer({ startTime }: { startTime: string }) {
  const elapsed = useElapsedTime(startTime);
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      <Timer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{elapsed}</span>
      <span className="text-xs text-blue-500 dark:text-blue-400">in session</span>
    </div>
  );
}

// ─── Page: Consultation ───────────────────────────────────────────────────────

function ConsultationPage({
  selectedPatient, packetData, activeQueueItem, consultationForm, setConsultationForm,
  newMedicine, setNewMedicine, addMedicine, removeMedicine, handleSaveConsultation, setSelectedRecord,
}: {
  selectedPatient: Patient | null;
  packetData: PacketData | null;
  activeQueueItem: QueueItem | null;
  consultationForm: any;
  setConsultationForm: any;
  newMedicine: Medicine;
  setNewMedicine: React.Dispatch<React.SetStateAction<Medicine>>;
  addMedicine: () => void;
  removeMedicine: (i: number) => void;
  handleSaveConsultation: (printPdf: boolean) => void;
  setSelectedRecord: (r: any) => void;
}) {
  const navigate = useNavigate();
  const [lastVisit, setLastVisit] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPatient) return;
    supabase
      .from('consultations')
      .select('created_at')
      .eq('patient_id', selectedPatient.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setLastVisit(data && data.length > 0
          ? new Date(data[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'First Visit');
      });
  }, [selectedPatient]);

  if (!selectedPatient) return (
    <motion.div key="no-patient" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
      <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
        <Users className="w-10 h-10 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Patient Selected</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">Start a consultation from the queue or use the QR scanner to load a patient.</p>
      <button onClick={() => navigate('/queue')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none">
        <Clock className="w-4 h-4" />Go to Today's Patients
      </button>
    </motion.div>
  );

  const bloodGroup = selectedPatient.blood_group || packetData?.profile_data?.blood_group || '—';

  return (
    <motion.div key="consultation" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          {activeQueueItem?.token_number && (
            <TokenBadge token={activeQueueItem.token_number} />
          )}
          {activeQueueItem?.called_at && <ConsultationTimer startTime={activeQueueItem.called_at} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm group overflow-hidden">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center font-bold text-xl">
                {selectedPatient.name[0]}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{selectedPatient.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID: #{selectedPatient.id.slice(0, 8)}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Age / Gender', value: `${selectedPatient.age}Y / ${selectedPatient.gender?.toUpperCase()}`, icon: Users },
                { label: 'Blood Group', value: bloodGroup, icon: Activity, highlight: bloodGroup !== '—' },
                { label: 'Last Visit', value: lastVisit ?? '…', icon: Calendar },
                ...(activeQueueItem?.chief_complaint ? [{ label: 'Chief Complaint', value: activeQueueItem.chief_complaint, icon: ClipboardList }] : []),
              ].map((item, i) => (
                <div key={i} className="flex items-start justify-between p-3 rounded-xl bg-gray-50/70 dark:bg-slate-800/50 group-hover:bg-gray-50 dark:group-hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{item.label}</span>
                  </div>
                  <span className={cn("text-xs font-bold text-right ml-2", (item as any).highlight ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")}>{item.value}</span>
                </div>
              ))}
            </div>
            {packetData && (
              <button onClick={() => navigate('/record-view')} className="w-full mt-5 py-3.5 bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600 rounded-2xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                <FileSearch className="w-4 h-4" />Expand Full Records
              </button>
            )}
          </div>

          <div className="bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-100 text-white relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <h4 className="text-sm font-bold mb-2">Clinical Protocol</h4>
            <p className="text-xs text-blue-50 leading-relaxed mb-4">Review drug allergies before prescribing. All data is encrypted end-to-end.</p>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
              <CheckCircle2 className="w-3 h-3" />Verified Security
            </div>
          </div>
        </div>

        {/* Main form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 rounded-l-3xl" />
            <div className="flex items-center justify-between mb-7">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Clinical Evaluation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Record symptoms, diagnosis and treatment plan</p>
              </div>
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest">Session Active</span>
            </div>

            <div className="space-y-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Symptoms & Complaints</label>
                  <textarea value={consultationForm.symptoms} onChange={(e) => setConsultationForm((p: any) => ({ ...p, symptoms: e.target.value }))}
                    placeholder="e.g. Severe headache for 3 days, nausea..." className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all min-h-[130px] text-sm text-gray-900 dark:text-white dark:placeholder:text-gray-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Clinical Diagnosis</label>
                  <textarea value={consultationForm.diagnosis} onChange={(e) => setConsultationForm((p: any) => ({ ...p, diagnosis: e.target.value }))}
                    placeholder="e.g. Acute Migraine, Viral Fever..." className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all min-h-[130px] text-sm text-gray-900 dark:text-white dark:placeholder:text-gray-500" />
                </div>
              </div>

              {/* Medicines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Medication Plan (Rx)</label>
                  <span className="text-[10px] font-medium text-gray-400">{consultationForm.medicines.length} added</span>
                </div>
                {consultationForm.medicines.length > 0 && (
                  <div className="space-y-2 mb-1">
                    {consultationForm.medicines.map((med: Medicine, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 group">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                          <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{med.name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{formatMedicineTiming(med)}</p>
                        </div>
                        <button onClick={() => removeMedicine(i)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
                <MedicineEntryForm newMedicine={newMedicine} setNewMedicine={setNewMedicine} addMedicine={addMedicine} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Advice / Notes</label>
                <textarea value={consultationForm.notes} onChange={(e) => setConsultationForm((p: any) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Bed rest, avoid cold drinks, follow up in 1 week..." className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all min-h-[90px] text-sm text-gray-900 dark:text-white dark:placeholder:text-gray-500" />
              </div>

              <div className="pt-5 border-t border-gray-50 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-gray-400 font-medium">Secure Encryption Active</p>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={() => handleSaveConsultation(false)} className="flex-1 sm:flex-none px-6 py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" />Save Only
                  </button>
                  <button onClick={() => handleSaveConsultation(true)} className="flex-1 sm:flex-none px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <Printer className="w-5 h-5" />Save & Print Rx
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page: Record View ────────────────────────────────────────────────────────

function RecordViewPage({ packetData, setSelectedRecord }: { packetData: PacketData | null; setSelectedRecord: (r: any) => void }) {
  const navigate = useNavigate();
  if (!packetData) return (
    <motion.div key="no-packet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
      <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
        <FileSearch className="w-10 h-10 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Health Packet Loaded</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">Scan a patient's dynamic QR code to load their medical records here.</p>
      <button onClick={() => navigate('/consultation')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all">
        <ArrowLeft className="w-4 h-4" />Back to Consultation
      </button>
    </motion.div>
  );
  return (
    <motion.div key="record-view" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
      <PatientRecordView packet={packetData} onClose={() => navigate('/consultation')} onPreview={setSelectedRecord} />
    </motion.div>
  );
}

// ─── Page: Profile ────────────────────────────────────────────────────────────

function ProfilePage() {
  const { doctorProfile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: '', specialty: '', qualification: '', registration_number: '', clinic_name: '', clinic_address: '', phone: '', avatar_url: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicCode, setClinicCode] = useState<string>('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // Deterministic code: DR + first 4 hex chars of doctor UUID (always same, collision-free for clinic scale)
  const generateClinicCode = (id: string) =>
    'DR' + id.replace(/-/g, '').slice(0, 4).toUpperCase();

  const bookingUrl = clinicCode
    ? `https://unicare-patient.vercel.app/book?d=${clinicCode}`
    : '';

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }
      else { setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); }
    } catch {}
  };

  useEffect(() => {
    if (doctorProfile) {
      setForm({
        full_name: doctorProfile.full_name || '',
        specialty: doctorProfile.specialty || '',
        qualification: (doctorProfile as any).qualification || '',
        registration_number: doctorProfile.registration_number || '',
        clinic_name: doctorProfile.clinic_name || '',
        clinic_address: (doctorProfile as any).clinic_address || '',
        phone: (doctorProfile as any).phone || '',
        avatar_url: doctorProfile.avatar_url || '',
      });

      // Generate deterministic clinic code from doctor UUID
      const code = (doctorProfile as any).clinic_code || generateClinicCode(doctorProfile.id);
      setClinicCode(code);

      // Persist code to doctors table if not already set
      if (!(doctorProfile as any).clinic_code) {
        supabase.from('doctors').update({ clinic_code: code }).eq('id', doctorProfile.id);
      }

      // Sync to UniCare's clinic_codes lookup so patients can resolve it
      patientSupabase.from('clinic_codes').upsert({
        code,
        doctor_id: doctorProfile.id,
        doctor_name: doctorProfile.full_name || '',
        specialty: doctorProfile.specialty || '',
        clinic_name: doctorProfile.clinic_name || '',
        clinic_address: (doctorProfile as any).clinic_address || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'code' });
    }
  }, [doctorProfile]);

  const handleSave = async () => {
    if (!doctorProfile) return;
    setSaving(true); setError(null);
    try {
      const { error: e } = await supabase.from('doctors').update(form).eq('id', doctorProfile.id);
      if (e) throw e;

      // Update patient DB with potentially new clinic info
      await patientSupabase.from('clinic_codes').upsert({
        code: clinicCode,
        doctor_id: doctorProfile.id,
        doctor_name: form.full_name || '',
        specialty: form.specialty || '',
        clinic_name: form.clinic_name || '',
        clinic_address: form.clinic_address || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'code' });

      await refreshProfile();
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const fields = [
    { key: 'full_name', label: 'Full Name', placeholder: 'Dr. Aryan Pandey', icon: Users, required: true },
    { key: 'specialty', label: 'Specialty', placeholder: 'General Physician & Diabetologist', icon: Stethoscope },
    { key: 'qualification', label: 'Qualification', placeholder: 'MBBS, MD (General Medicine)', icon: Award },
    { key: 'registration_number', label: 'Registration Number', placeholder: 'DMC/12345/2024', icon: Hash },
    { key: 'clinic_name', label: 'Clinic / Hospital Name', placeholder: 'UniCare Health Clinic', icon: Activity },
    { key: 'clinic_address', label: 'Clinic Address', placeholder: '123 Medical Lane, New Delhi', icon: MapPin },
    { key: 'phone', label: 'Contact Number', placeholder: '+91 98765 43210', icon: Phone },
    { key: 'avatar_url', label: 'Avatar URL (optional)', placeholder: 'https://...', icon: Users },
  ];

  return (
    <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="flex items-center gap-6 relative">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold border border-white/30 overflow-hidden">
            {form.avatar_url ? <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : (form.full_name || 'DR')[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{form.full_name || 'Your Name'}</h2>
            <p className="text-blue-100 text-sm mt-1">{form.specialty || 'Specialty'}</p>
            <p className="text-blue-200 text-xs mt-0.5">{form.clinic_name || 'Clinic Name'}</p>
          </div>
        </div>
      </div>

      {/* ── Clinic Booking Code card ── */}
      {clinicCode && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-blue-100 dark:border-blue-900/50 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 px-6 py-4 border-b border-blue-100 dark:border-blue-900/50 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Clinic Booking Code</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Share this code — patients use it to book appointments with you</p>
            </div>
          </div>

          <div className="p-6 flex flex-col sm:flex-row gap-6 items-center">
            {/* QR Code */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="w-[130px] h-[130px] rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-slate-700 bg-white p-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&margin=2&data=${encodeURIComponent(bookingUrl)}`}
                  alt="Booking QR Code"
                  className="w-full h-full"
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">Scan to book</p>
            </div>

            {/* Code + URL */}
            <div className="flex-1 min-w-0 space-y-4 w-full">
              {/* The code itself — big and prominent */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Clinic Code</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 flex items-center justify-between">
                    <span className="text-2xl font-black tracking-[0.2em] text-blue-600 dark:text-blue-400 font-mono">
                      {clinicCode}
                    </span>
                    <span className="text-xs text-gray-400 ml-3">permanent</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(clinicCode, 'code')}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all',
                      codeCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    )}
                  >
                    {codeCopied ? <CheckCircle2 className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>


              {/* Instruction hint */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  Patients enter <strong>{clinicCode}</strong> in UniCare to book appointments directly with you. This code never changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm p-8 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Profile Information</h3>
          <p className="text-sm text-gray-500 mt-1">Appears on prescription PDFs and consultation records.</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {fields.map(({ key, label, placeholder, icon: Icon, required }) => (
            <div key={key}>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3 h-3" />{label}{required && <span className="text-red-500">*</span>}
              </label>
              <input type="text" value={(form as any)[key]} onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white dark:placeholder:text-gray-500 transition-all" />
            </div>
          ))}
        </div>
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" /><p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
        <button onClick={handleSave} disabled={saving || !form.full_name} className={cn(
          "w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all",
          saved ? "bg-green-600 text-white shadow-lg shadow-green-100" : "bg-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:scale-[1.01] disabled:opacity-50 disabled:scale-100"
        )}>
          {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : saved ? <><CheckCircle2 className="w-5 h-5" />Profile Saved!</> : <><Save className="w-5 h-5" />Save Profile</>}
        </button>
      </div>
    </motion.div>
  );
}

// ─── usePageMeta ──────────────────────────────────────────────────────────────

function usePageMeta() {
  const location = useLocation();
  const { doctorProfile } = useAuth();
  const firstName = doctorProfile?.full_name?.split(' ')[0] || 'Doctor';
  const titles: Record<string, { title: string; subtitle: string }> = {
    '/': { title: 'Dashboard', subtitle: `Good day, Dr. ${firstName}. Here is your clinic overview.` },
    '/patients': { title: 'Patient Directory', subtitle: 'All registered patients with consultation history.' },
    '/appointments': { title: 'Appointments', subtitle: 'Review new booking requests — confirmed ones move to Queue.' },
    '/queue': { title: "Today's Queue", subtitle: 'All waiting patients (walk-ins and confirmed appointments).' },
    '/consultations': { title: 'Consultation History', subtitle: 'Review and reprint past consultation records.' },
    '/consultation': { title: 'New Consultation', subtitle: 'Complete the clinical record for this patient.' },
    '/record-view': { title: 'Record View', subtitle: 'Reviewing shared clinical documentation.' },
    '/profile': { title: 'My Profile', subtitle: 'Manage your professional details and clinic info.' },
  };
  return titles[location.pathname] ?? { title: 'UniCare', subtitle: '' };
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading, isConfigured, doctorProfile } = useAuth();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState<boolean>(getInitialTheme);
  const toggleTheme = () => { const n = !darkMode; setDarkMode(n); applyTheme(n); };
  useEffect(() => { applyTheme(darkMode); }, []);  // eslint-disable-line

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeQueueItem, setActiveQueueItem] = useState<QueueItem | null>(null);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [packetData, setPacketData] = useState<PacketData | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [consultationForm, setConsultationForm] = useState({ symptoms: '', diagnosis: '', notes: '', medicines: [] as Medicine[] });
  const [newMedicine, setNewMedicine] = useState<Medicine>({ name: '', timing: [], food: 'after', days: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Sync lock: prevents concurrent syncs from the realtime chain ────────
  const syncingRef = useRef(false);

  const fetchQueue = useCallback(async () => {
    if (!doctorProfile) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('queue')
      .select('*, patient:patients(*)')
      .eq('doctor_id', doctorProfile.id)
      .gte('created_at', today.toISOString())
      .order('token_number', { ascending: true });
    if (data) {
      const queueData = data as unknown as QueueItem[];
      setQueue(queueData);
      
      // Auto-restore active session state if found
      const inConsult = queueData.find(q => q.status === 'in-consultation');
      if (inConsult) {
        setActiveQueueItem(inConsult);
        if (inConsult.patient) {
          setSelectedPatient(inConsult.patient);
        }
      }
    }
  }, [doctorProfile]);

  const fetchPatients = useCallback(async () => {
    if (!doctorProfile) return;
    const { data } = await supabase.from('patients').select('*').eq('doctor_id', doctorProfile.id).order('name');
    if (data) setPatients(data as Patient[]);
  }, [doctorProfile]);

  const fetchAppointments = useCallback(async () => {
    if (!doctorProfile) return;
    // Fetch all statuses so the Appointments page can render pending + cancelled
    const { data } = await supabase
      .from('appointments')
      .select('*, patient:patients(*)')
      .eq('doctor_id', doctorProfile.id)
      .order('scheduled_at', { ascending: true });
    if (data) setAppointments(data as unknown as Appointment[]);
  }, [doctorProfile]);

  const syncPatientAppointmentsToLocal = useCallback(async () => {
    if (!doctorProfile) return;
    // Prevent concurrent syncs from stacking (realtime can fire this rapidly)
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const { data: extAppts, error } = await patientSupabase
        .from('appointments')
        .select('*, profiles(name)')
        .eq('doctor_id', doctorProfile.id);

      if (error) throw error;
      if (extAppts && extAppts.length > 0) {
        const toUpsert = extAppts.map((a: any) => ({
          patient_unicare_appointment_id: a.id,
          doctor_id: a.doctor_id,
          profile_id: a.profile_id,
          patient_name: a.profiles?.name || a.title || 'Unknown Patient',
          scheduled_at: a.date,
          timezone: a.timezone || 'Asia/Kolkata',
          // Map patient-side status ('upcoming') to doctor-side status ('pending')
          status: a.status === 'upcoming' ? 'pending' : (a.status || 'pending'),
          notes: a.notes || null,
          // BUG FIX: patient app column is 'packet_id', not 'shared_packet_id'
          shared_packet_id: a.packet_id || null,
        }));
        await supabase.from('appointments').upsert(toUpsert, { onConflict: 'patient_unicare_appointment_id' });
      }
    } catch (err) {
      console.error('Failed to sync patient appointments:', err);
    } finally {
      syncingRef.current = false;
    }
  }, [doctorProfile]);

  // Use doctorProfile.id (a stable primitive) as the sole dependency so this
  // effect does NOT re-run every time a callback reference is recreated.
  const doctorId = doctorProfile?.id;

  useEffect(() => {
    if (!doctorId) return;

    fetchQueue();
    fetchPatients();
    
    syncPatientAppointmentsToLocal().then(() => {
      fetchAppointments();
    });

    // Queue realtime — scoped to this doctor
    const queueChannel = supabase
      .channel(`queue-realtime-${doctorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `doctor_id=eq.${doctorId}` }, () => {
        fetchQueue();
      })
      .subscribe();

    // Appointments realtime — scoped to this doctor
    const apptChannel = supabase
      .channel(`appointments-realtime-${doctorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorId}` }, () => {
        fetchAppointments();
      })
      .subscribe();

    // Patient Appointments Realtime — listen for inserts/updates from Patient DB
    // Uses syncingRef lock so rapid-fire realtime events collapse into one sync.
    const patientApptChannel = patientSupabase
      .channel('patient-appointments-realtime-doctor-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorId}` }, async () => {
        // Just re-run the full sync to properly join profile name
        await syncPatientAppointmentsToLocal();
        fetchAppointments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(apptChannel);
      patientSupabase.removeChannel(patientApptChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  // ── Token number helper ────────────────────────────────────────────────────

  const getNextToken = useCallback(async (): Promise<number> => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('queue')
      .select('token_number')
      .eq('doctor_id', doctorProfile!.id)
      .gte('created_at', today.toISOString())
      .order('token_number', { ascending: false })
      .limit(1);
    return data && data.length > 0 ? (data[0].token_number || 0) + 1 : 1;
  }, [doctorProfile]);

  // ── QR Scan ────────────────────────────────────────────────────────────────

  const handleQRScan = async (url: string) => {
    if (!doctorProfile) return;
    setScanLoading(true); setScanError(null);
    try {
      const packetId = url.split('/').pop();
      if (!packetId || packetId.length < 36) throw new Error("Invalid health packet URL");

      const { data: packet, error: packetError } = await patientSupabase.from('shared_packets').select('*').eq('id', packetId).single();
      if (packetError || !packet) throw new Error("Health packet not found");
      if (packet.expires_at && new Date(packet.expires_at) < new Date()) throw new Error("Health packet has expired");

      const { data: profile, error: profileError } = await patientSupabase.from('profiles').select('*').eq('id', packet.profile_id).single();
      if (profileError || !profile) throw new Error("Patient profile not found");

      let medicalHistory: any[] = [];
      if (packet.share_medical_history) {
        const { data: history } = await patientSupabase.from('medical_history').select('*').eq('profile_id', profile.id);
        medicalHistory = history || [];
      }

      const { data: recordLinks } = await patientSupabase.from('shared_packet_records').select('record_id').eq('packet_id', packetId);
      let records: any[] = [];
      if (recordLinks && recordLinks.length > 0) {
        const { data: recordsData } = await patientSupabase.from('records').select('*').in('id', recordLinks.map((l: any) => l.record_id));
        records = recordsData || [];
      }

      const fetchedPacket: PacketData = {
        id: packet.id, title: packet.title || "Health Packet", expires_at: packet.expires_at || "",
        profile_data: {
          name: profile.name, dob: profile.dob, gender: profile.gender || "Not specified",
          blood_group: profile.blood_group || "Unknown", abha_id: profile.abha_id || "",
          phone: profile.phone || "", email: profile.email || "", address: profile.address || ""
        },
        medical_history: medicalHistory.map(h => ({
          question_id: h.question_id,
          question: h.question_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          answer: h.answer
        })),
        records: records.map(r => ({
          id: r.id, title: r.title, date: r.date, provider: r.provider, type: r.type,
          file_name: r.file_name, file_type: r.file_type,
          file_url: `https://vtuujzlscnxiyxokxntk.supabase.co/storage/v1/object/public/medical-records/${r.file_url}`
        }))
      };

      setPacketData(fetchedPacket);

      const patientPhone = fetchedPacket.profile_data.phone;
      const patientName = fetchedPacket.profile_data.name;
      let patient = patients.find(p => (patientPhone && p.phone === patientPhone) || (!patientPhone && p.name === patientName));

      if (!patient) {
        const { data, error } = await supabase.from('patients').insert({
          doctor_id: doctorProfile!.id, name: patientName,
          age: profile.dob ? calculateAge(profile.dob) : 0,
          gender: fetchedPacket.profile_data.gender, phone: patientPhone,
          email: fetchedPacket.profile_data.email, abha_id: fetchedPacket.profile_data.abha_id,
          address: fetchedPacket.profile_data.address, blood_group: fetchedPacket.profile_data.blood_group,
        }).select().single();
        if (error) throw error;
        patient = data as Patient;
        fetchPatients();
      }

      const token = await getNextToken();
      const { data: queueData, error: queueError } = await supabase.from('queue').insert({
        doctor_id: doctorProfile!.id, patient_id: patient!.id, status: 'waiting', token_number: token,
        chief_complaint: ''
      }).select('*, patient:patients(*)').single();
      if (queueError) throw queueError;

      fetchQueue();
      setSelectedPatient(patient!);
      setActiveQueueItem(queueData as unknown as QueueItem);
      navigate('/consultation');
    } catch (err: any) {
      setScanError(err.message || "Invalid link or network error");
    } finally {
      setScanLoading(false);
    }
  };

  // ── Register Patient via UniCare Patient Code (UC-XXXXXXXX) ─────────────
  // Resolves the canonical patient code to a full profile from the patient DB,
  // upserts to the local patients table (enriching data if record exists),
  // then adds to today's queue (idempotent — skips if already waiting today).

  const handleRegisterByPatientCode = async (code: string) => {
    if (!doctorProfile) return;
    setScanLoading(true); setScanError(null);
    try {
      // 1. Resolve full profile from patient DB (throws if inactive / not found)
      const profile = await resolvePatientCode(code);

      // 2. Look up existing patient in this doctor's DB:
      //    Priority: patient_code match > source_profile_id match > phone match
      let patient =
        patients.find(p => (p as any).patient_code === profile.patient_code) ??
        patients.find(p => (p as any).source_profile_id === profile.id) ??
        (profile.phone ? patients.find(p => p.phone === profile.phone) : undefined);

      const enrichedData = {
        name: profile.name,
        age: profile.age,
        gender: profile.gender || 'Not specified',
        phone: profile.phone || null,
        email: profile.email || null,
        abha_id: profile.abha_id || null,
        address: profile.address || null,
        blood_group: profile.blood_group || null,
        dob: profile.dob || null,
      };

      if (!patient) {
        // 3a. Create new patient record
        const { data: newP, error: pErr } = await supabase
          .from('patients')
          .insert({ doctor_id: doctorProfile.id, ...enrichedData })
          .select()
          .single();
        if (pErr) throw new Error(`Failed to create patient record: ${pErr.message}`);
        patient = newP as Patient;
        fetchPatients();
      } else {
        // 3b. Enrich existing patient record with latest profile data
        await supabase
          .from('patients')
          .update(enrichedData)
          .eq('id', patient.id);
        // Optimistically update local reference
        patient = { ...patient, ...enrichedData } as Patient;
      }

      // 4. Idempotency check — skip if already in today's queue (waiting)
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: existingQueue } = await supabase
        .from('queue')
        .select('id, status')
        .eq('doctor_id', doctorProfile.id)
        .eq('patient_id', patient!.id)
        .gte('created_at', today.toISOString())
        .in('status', ['waiting', 'in-consultation'])
        .maybeSingle();

      if (existingQueue) {
        // Patient is already in queue — just navigate
        fetchQueue();
        navigate('/queue');
        return;
      }

      // 5. Add to queue
      const token = await getNextToken();
      const { error: qErr } = await supabase.from('queue').insert({
        doctor_id: doctorProfile.id,
        patient_id: patient!.id,
        status: 'waiting',
        token_number: token,
        chief_complaint: '',
      });
      if (qErr) throw new Error(`Failed to add to queue: ${qErr.message}`);

      fetchQueue();
      navigate('/queue');
    } catch (err: any) {
      setScanError(err.message || 'Could not register patient. Please try again.');
    } finally {
      setScanLoading(false);
    }
  };

  // ── Start Consultation from Queue ──────────────────────────────────────────
  // BUG FIX: Now also resolves activeAppointment from linked appointment (if any),
  // updates patient DB status to 'checked_in', and loads packet data — mirroring
  // the behaviour that previously only existed in the check-in path.

  const handleStartConsultation = async (item: QueueItem) => {
    try {
      // If another patient is in-consultation, block or warn
      const currentInConsult = queue.find(q => q.status === 'in-consultation' && q.id !== item.id);
      if (currentInConsult) {
        setScanError(`Please complete ${currentInConsult.patient?.name}'s consultation first`);
        return;
      }

      await supabase.from('queue').update({ status: 'in-consultation', called_at: new Date().toISOString() }).eq('id', item.id);
      const updatedItem = { ...item, status: 'in-consultation' as const, called_at: new Date().toISOString() };
      setActiveQueueItem(updatedItem);
      setSelectedPatient(item.patient!);

      // ── Resolve linked appointment (if any) ──────────────────────────────
      // Appointments created via confirm flow now store queue_id, so we can
      // look them up here and bind activeAppointment for save writeback.
      const { data: linkedAppt } = await supabase
        .from('appointments')
        .select('*')
        .eq('queue_id', item.id)
        .maybeSingle();

      if (linkedAppt) {
        setActiveAppointment(linkedAppt as unknown as Appointment);

        // Update patient DB status → 'checked_in' so patient sees active session
        if (linkedAppt.patient_unicare_appointment_id) {
          const { error: startWritebackErr } = await patientSupabase
            .from('appointments')
            .update({ status: 'checked_in' })
            .eq('id', linkedAppt.patient_unicare_appointment_id);
          if (startWritebackErr) {
            console.error('Patient DB start writeback failed (RLS/auth):', startWritebackErr);
            setScanError(`Warning: Session started, but patient status sync failed: ${startWritebackErr.message}`);
          }
        }

        // ── Load health packet if one was attached to appointment ───────────
        const packetId = linkedAppt.shared_packet_id;
        if (packetId) {
          try {
            setScanLoading(true);
            const { data: packet } = await patientSupabase.from('shared_packets').select('*').eq('id', packetId).single();
            if (packet && !(packet.expires_at && new Date(packet.expires_at) < new Date())) {
              const { data: profile } = await patientSupabase.from('profiles').select('*').eq('id', packet.profile_id).single();
              if (profile) {
                let medicalHistory: any[] = [];
                if (packet.share_medical_history) {
                  const { data: history } = await patientSupabase.from('medical_history').select('*').eq('profile_id', profile.id);
                  medicalHistory = history || [];
                }
                const { data: recordLinks } = await patientSupabase.from('shared_packet_records').select('record_id').eq('packet_id', packetId);
                let records: any[] = [];
                if (recordLinks && recordLinks.length > 0) {
                  const { data: recordsData } = await patientSupabase.from('records').select('*').in('id', recordLinks.map((l: any) => l.record_id));
                  records = recordsData || [];
                }
                const fetchedPacket: PacketData = {
                  id: packet.id, title: packet.title || 'Health Packet', expires_at: packet.expires_at || '',
                  profile_data: {
                    name: profile.name, dob: profile.dob, gender: profile.gender || 'Not specified',
                    blood_group: profile.blood_group || 'Unknown', abha_id: profile.abha_id || '',
                    phone: profile.phone || '', email: profile.email || '', address: profile.address || '',
                  },
                  medical_history: medicalHistory.map(h => ({
                    question_id: h.question_id,
                    question: h.question_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    answer: h.answer,
                  })),
                  records: records.map(r => ({
                    id: r.id, title: r.title, date: r.date, provider: r.provider, type: r.type,
                    file_name: r.file_name, file_type: r.file_type,
                    file_url: `https://vtuujzlscnxiyxokxntk.supabase.co/storage/v1/object/public/medical-records/${r.file_url}`,
                  })),
                };
                setPacketData(fetchedPacket);
              }
            }
          } catch (pErr) {
            console.warn('Could not load health packet for queue-start:', pErr);
          } finally {
            setScanLoading(false);
          }
        }
      }

      fetchQueue();
      navigate('/consultation');
    } catch (err) {
      console.error('Error starting consultation:', err);
    }
  };

  // ── Add to Queue (Walk-in or Existing) ────────────────────────────────────

  const handleAddToQueue = async (patientId: string, complaint: string, newPatientData?: Omit<Patient, 'id'>) => {
    if (!doctorProfile) return;
    let pid = patientId;
    if (!pid && newPatientData) {
      const { data, error } = await supabase.from('patients').insert({ doctor_id: doctorProfile.id, ...newPatientData }).select().single();
      if (error) throw error;
      pid = data.id;
      fetchPatients();
    }
    const token = await getNextToken();
    await supabase.from('queue').insert({ doctor_id: doctorProfile.id, patient_id: pid, status: 'waiting', token_number: token, chief_complaint: complaint || null });
    fetchQueue();
  };

  // ── Remove from Queue ──────────────────────────────────────────────────────

  const handleRemoveFromQueue = async (id: string) => {
    await supabase.from('queue').delete().eq('id', id);
    fetchQueue();
  };

  // ── Appointment: Confirm → auto-create queue entry ────────────────────────

  const handleConfirmAppointment = async (appt: Appointment) => {
    if (!doctorProfile) return;
    try {
      // 1. Update doctor-side status
      await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appt.id);

      // 2. Write back to patient app — check error so failures are visible
      const { error: confirmWritebackErr } = await patientSupabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appt.patient_unicare_appointment_id);
      if (confirmWritebackErr) {
        console.error('Patient DB confirm writeback failed (RLS/auth):', confirmWritebackErr);
        setScanError(`Warning: Appointment confirmed locally, but patient notification failed: ${confirmWritebackErr.message}`);
      }

      // 3. Resolve / create local patient record
      let patient = appt.patient_id
        ? patients.find(p => p.id === appt.patient_id) ?? null
        : patients.find(p => p.name === appt.patient_name) ?? null;

      if (!patient) {
        const { data: newP, error: pErr } = await supabase
          .from('patients')
          .insert({ doctor_id: doctorProfile.id, name: appt.patient_name, age: 0, gender: 'Not specified' })
          .select()
          .single();
        if (pErr) throw pErr;
        patient = newP as Patient;
        fetchPatients();
      }

      // 4. Auto-create a queue entry (waiting) so confirmed appt appears in queue
      //    Retrieve queue_id and link it back to the appointment so handleStartConsultation
      //    can resolve the appointment context and load packet data.
      const token = await getNextToken();
      const { data: confirmedQEntry, error: qInsertErr } = await supabase
        .from('queue')
        .insert({
          doctor_id: doctorProfile.id,
          patient_id: patient!.id,
          status: 'waiting',
          token_number: token,
          chief_complaint: appt.notes || '',
        })
        .select()
        .single();
      if (qInsertErr) throw qInsertErr;

      // 5. Store queue_id back into appointment so start-from-queue path can find it
      if (confirmedQEntry?.id) {
        await supabase
          .from('appointments')
          .update({ queue_id: confirmedQEntry.id, patient_id: patient!.id })
          .eq('id', appt.id);
      }

      fetchAppointments();
      fetchQueue();
    } catch (err) {
      console.error('Error confirming appointment:', err);
    }
  };

  // ── Appointment: Cancel ────────────────────────────────────────────────────

  const handleCancelAppointment = async (appt: Appointment) => {
    try {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
      const { error: cancelWritebackErr } = await patientSupabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.patient_unicare_appointment_id);
      if (cancelWritebackErr) {
        console.error('Patient DB cancel writeback failed (RLS/auth):', cancelWritebackErr);
        setScanError(`Warning: Appointment cancelled locally, but patient notification failed: ${cancelWritebackErr.message}`);
      }
      fetchAppointments();
    } catch (err) {
      console.error('Error cancelling appointment:', err);
    }
  };

  // ── Appointment: Check In → Queue ──────────────────────────────────────────
  // Creates a queue entry, links it, and opens the consultation form.
  // Also loads the health packet if one was attached to the appointment.

  const handleCheckInAppointment = async (appt: Appointment) => {
    if (!doctorProfile) return;
    try {
      // Block if another consultation is already in progress
      const currentInConsult = queue.find(q => q.status === 'in-consultation');
      if (currentInConsult) {
        setScanError(`Complete ${currentInConsult.patient?.name}'s consultation before checking in a new patient.`);
        return;
      }

      // Resolve or create the local patient record
      let patient = appt.patient_id
        ? patients.find(p => p.id === appt.patient_id) ?? null
        : patients.find(p => p.name === appt.patient_name) ?? null;

      if (!patient) {
        const { data: newP, error: pErr } = await supabase
          .from('patients')
          .insert({ doctor_id: doctorProfile.id, name: appt.patient_name, age: 0, gender: 'Not specified' })
          .select()
          .single();
        if (pErr) throw pErr;
        patient = newP as Patient;
        fetchPatients();
      }

      // ── Load health packet if attached to this appointment ─────────────────
      const packetId = (appt as any).shared_packet_id;
      if (packetId) {
        try {
          setScanLoading(true);
          const { data: packet } = await patientSupabase.from('shared_packets').select('*').eq('id', packetId).single();
          if (packet && !(packet.expires_at && new Date(packet.expires_at) < new Date())) {
            const { data: profile } = await patientSupabase.from('profiles').select('*').eq('id', packet.profile_id).single();
            if (profile) {
              let medicalHistory: any[] = [];
              if (packet.share_medical_history) {
                const { data: history } = await patientSupabase.from('medical_history').select('*').eq('profile_id', profile.id);
                medicalHistory = history || [];
              }
              const { data: recordLinks } = await patientSupabase.from('shared_packet_records').select('record_id').eq('packet_id', packetId);
              let records: any[] = [];
              if (recordLinks && recordLinks.length > 0) {
                const { data: recordsData } = await patientSupabase.from('records').select('*').in('id', recordLinks.map((l: any) => l.record_id));
                records = recordsData || [];
              }
              const fetchedPacket: PacketData = {
                id: packet.id, title: packet.title || 'Health Packet', expires_at: packet.expires_at || '',
                profile_data: {
                  name: profile.name, dob: profile.dob, gender: profile.gender || 'Not specified',
                  blood_group: profile.blood_group || 'Unknown', abha_id: profile.abha_id || '',
                  phone: profile.phone || '', email: profile.email || '', address: profile.address || '',
                },
                medical_history: medicalHistory.map(h => ({
                  question_id: h.question_id,
                  question: h.question_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                  answer: h.answer,
                })),
                records: records.map(r => ({
                  id: r.id, title: r.title, date: r.date, provider: r.provider, type: r.type,
                  file_name: r.file_name, file_type: r.file_type,
                  file_url: `https://vtuujzlscnxiyxokxntk.supabase.co/storage/v1/object/public/medical-records/${r.file_url}`,
                })),
              };
              setPacketData(fetchedPacket);
              // Update patient with profile data if richer info available
              if (profile.blood_group || profile.phone) {
                await supabase.from('patients').update({
                  blood_group: profile.blood_group || undefined,
                  phone: profile.phone || undefined,
                  email: profile.email || undefined,
                }).eq('id', patient!.id);
              }
            }
          }
        } catch (pErr) {
          console.warn('Could not load health packet for appointment:', pErr);
        } finally {
          setScanLoading(false);
        }
      }

      // Create queue entry
      const token = await getNextToken();
      const { data: qEntry, error: qErr } = await supabase
        .from('queue')
        .insert({
          doctor_id: doctorProfile.id,
          patient_id: patient!.id,
          status: 'in-consultation',
          token_number: token,
          chief_complaint: appt.notes || '',
          called_at: new Date().toISOString(),
        })
        .select('*, patient:patients(*)')
        .single();
      if (qErr) throw qErr;

      // Link queue_id back to doctor-side appointment + update patient_id if resolved
      await supabase
        .from('appointments')
        .update({ status: 'checked_in', queue_id: qEntry.id, patient_id: patient!.id })
        .eq('id', appt.id);

      // Writeback to patient app — check error so RLS/auth failures are visible
      const { error: checkInWritebackErr } = await patientSupabase
        .from('appointments')
        .update({ status: 'checked_in', queue_id: qEntry.id })
        .eq('id', appt.patient_unicare_appointment_id);
      if (checkInWritebackErr) {
        console.error('Patient DB check-in writeback failed (RLS/auth):', checkInWritebackErr);
        setScanError(`Warning: Patient checked in locally, but patient status sync failed: ${checkInWritebackErr.message}`);
      }

      const updatedAppt: Appointment = { ...appt, status: 'checked_in', queue_id: qEntry.id, patient_id: patient!.id };
      setActiveAppointment(updatedAppt);
      setActiveQueueItem(qEntry as unknown as QueueItem);
      setSelectedPatient(patient!);
      fetchQueue();
      fetchAppointments();
      navigate('/consultation');
    } catch (err: any) {
      setScanError(err.message || 'Check-in failed');
    }
  };

  // ── Save Consultation ──────────────────────────────────────────────────────

  const handleSaveConsultation = async (printPdf: boolean) => {
    if (!selectedPatient || !doctorProfile) return;
    try {
      const { data, error } = await supabase.from('consultations').insert({
        doctor_id: doctorProfile.id, patient_id: selectedPatient.id,
        symptoms: consultationForm.symptoms, diagnosis: consultationForm.diagnosis,
        notes: consultationForm.notes, medicines: consultationForm.medicines,
        queue_id: activeQueueItem?.id || null,
      }).select().single();
      if (error) throw error;

      if (activeQueueItem) {
        await supabase.from('queue').update({ status: 'completed' }).eq('id', activeQueueItem.id);
      }

      // Build the full prescription payload with all details
      const prescriptionPayload = {
        doctor_id: doctorProfile.id,
        symptoms: consultationForm.symptoms || null,
        diagnosis: consultationForm.diagnosis || null,
        medications: consultationForm.medicines,
        notes: consultationForm.notes || null,
        doctor_name: doctorProfile.full_name || '',
        doctor_specialty: doctorProfile.specialty || '',
        clinic_name: (doctorProfile as any).clinic_name || '',
        clinic_address: (doctorProfile as any).clinic_address || '',
        doctor_phone: (doctorProfile as any).phone || '',
        issued_at: new Date().toISOString(),
      };

      if (activeAppointment) {
        // Mark appointment complete on doctor side
        await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', activeAppointment.id);

        // Writeback appointment status to patient app — check error so failures are visible
        const { error: completeWritebackErr } = await patientSupabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', activeAppointment.patient_unicare_appointment_id);
        if (completeWritebackErr) {
          console.error('Patient DB completion writeback failed (RLS/auth):', completeWritebackErr);
          setScanError(`Warning: Consultation saved, but patient status sync failed: ${completeWritebackErr.message}`);
        }

        // Write full prescription to patient app so patient can view all details
        const { error: prescWritebackErr } = await patientSupabase.from('prescriptions').insert({
          ...prescriptionPayload,
          appointment_id: activeAppointment.patient_unicare_appointment_id,
          profile_id: activeAppointment.profile_id,
        });
        if (prescWritebackErr) {
          console.error('Patient DB prescription writeback failed (RLS/auth):', prescWritebackErr);
        }
      } else if (selectedPatient) {
        // Walk-in or QR scan consultation: try to find the patient's profile in UniCare
        // by matching phone number, and write prescription there too
        const patientPhone = selectedPatient.phone;
        if (patientPhone) {
          const { data: profile } = await patientSupabase
            .from('profiles')
            .select('id')
            .eq('phone', patientPhone)
            .maybeSingle();
          if (profile?.id) {
            const { error: walkInPrescErr } = await patientSupabase.from('prescriptions').insert({
              ...prescriptionPayload,
              profile_id: profile.id,
              appointment_id: null,
            });
            if (walkInPrescErr) {
              console.error('Patient DB walk-in prescription writeback failed (RLS/auth):', walkInPrescErr);
            }
          }
        }
      }

      if (printPdf) {
        const doc = PrescriptionPDF(data as Consultation, selectedPatient, doctorProfile);
        doc.save(`Rx_${selectedPatient.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);
      }

      setConsultationForm({ symptoms: '', diagnosis: '', notes: '', medicines: [] });
      setNewMedicine({ name: '', timing: [], food: 'after', days: 0 });
      setSelectedPatient(null);
      setActiveQueueItem(null);
      setActiveAppointment(null);
      setPacketData(null);
      fetchQueue();
      fetchAppointments();
      navigate('/');
    } catch (err) {
      console.error('Error saving consultation:', err);
    }
  };

  const addMedicine = () => {
    if (newMedicine.name && newMedicine.timing.length > 0) {
      setConsultationForm((p: any) => ({ ...p, medicines: [...p.medicines, newMedicine] }));
      setNewMedicine({ name: '', timing: [], food: 'after', days: 0 });
    }
  };
  const removeMedicine = (i: number) => setConsultationForm((p: any) => ({ ...p, medicines: p.medicines.filter((_: any, idx: number) => idx !== i) }));

  // ── Loading states ─────────────────────────────────────────────────────────

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-xl border border-blue-50 dark:border-slate-800">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6"><AlertCircle className="w-8 h-8 text-red-600" /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Configuration Required</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">UniCare EMR needs your Supabase configuration to function.</p>
          <div className="space-y-3">
            {['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].map(k => (
              <div key={k} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-red-400" /><code className="text-sm font-mono text-gray-700 dark:text-gray-300">{k}</code>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] dark:bg-slate-950 transition-colors duration-300">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar darkMode={darkMode} onToggleTheme={toggleTheme} />
      </div>

      {/* Mobile slide-in sidebar drawer */}
      <div className="md:hidden">
        <Sidebar
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <main className="app-main flex-1 p-4 md:p-8 overflow-y-auto">
        <PageHeader onMenuClick={() => setSidebarOpen(true)} />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={
              <DashboardPage patients={patients} queue={queue} onQRScan={handleQRScan} onScanPatientCode={handleRegisterByPatientCode} onStartConsultation={handleStartConsultation} />
            } />
            <Route path="/patients" element={<PatientsPage patients={patients} onSelectPatient={setSelectedPatient} />} />
            <Route path="/appointments" element={
              <AppointmentsPage
                appointments={appointments}
                onConfirm={handleConfirmAppointment}
                onCancel={handleCancelAppointment}
                onCheckIn={handleCheckInAppointment}
              />
            } />
            <Route path="/queue" element={
              <QueuePage
                queue={queue}
                patients={patients}
                onStartConsultation={handleStartConsultation}
                onRemoveFromQueue={handleRemoveFromQueue}
                onAddToQueue={handleAddToQueue}
                onQRScan={handleQRScan}
                onScanPatientCode={handleRegisterByPatientCode}
              />
            } />
            <Route path="/consultations" element={<ConsultationsPage />} />
            <Route path="/consultation" element={
              <ConsultationPage
                selectedPatient={selectedPatient} packetData={packetData} activeQueueItem={activeQueueItem}
                consultationForm={consultationForm} setConsultationForm={setConsultationForm}
                newMedicine={newMedicine} setNewMedicine={setNewMedicine}
                addMedicine={addMedicine} removeMedicine={removeMedicine}
                handleSaveConsultation={handleSaveConsultation} setSelectedRecord={setSelectedRecord}
              />
            } />
            <Route path="/record-view" element={<RecordViewPage packetData={packetData} setSelectedRecord={setSelectedRecord} />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav darkMode={darkMode} onToggleTheme={toggleTheme} />

      <AnimatePresence>
        {selectedRecord && <MediaPreviewModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {scanLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="font-bold text-gray-900 dark:text-white">Retrieving Secure Health Packet...</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scanError && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 max-w-sm w-[calc(100%-2rem)]">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-bold text-sm">{scanError}</p>
            <button onClick={() => setScanError(null)} className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

function PageHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { title, subtitle } = usePageMeta();
  return (
    <div className="flex items-center justify-between mb-6 md:mb-8 gap-4">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white capitalize">{title}</h2>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400 hidden sm:block">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <button className="p-2.5 md:p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl md:rounded-2xl text-gray-400 dark:text-gray-300 hover:text-gray-600 transition-colors relative">
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
        </button>
        <div className="hidden md:block h-10 w-px bg-gray-200 dark:bg-slate-700" />
        {/* Full button on desktop, icon-only on mobile */}
        <NavLink
          to="/queue"
          className="hidden md:flex px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all items-center gap-2"
        >
          <Plus className="w-5 h-5" />New Consultation
        </NavLink>
        <NavLink
          to="/queue"
          className="md:hidden p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 dark:shadow-none"
          aria-label="New Consultation"
        >
          <Plus className="w-4 h-4" />
        </NavLink>
      </div>
    </div>
  );
}

// ─── AppointmentsPage ─────────────────────────────────────────────────────────
//
// Shows:
//  • Pending section — new requests from UniCare, Confirm / Cancel actions
//  • Cancelled section (collapsible CTA) — declined or cancelled appointments

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:    { label: 'Pending Review',  color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',    dot: 'bg-amber-400' },
  confirmed:  { label: 'Confirmed',       color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       dot: 'bg-blue-500' },
  checked_in: { label: 'In Consultation', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', dot: 'bg-purple-500' },
  completed:  { label: 'Completed',       color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',   dot: 'bg-green-500' },
  cancelled:  { label: 'Cancelled',       color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',          dot: 'bg-red-400' },
};

type ApptTab = 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled';

function AppointmentCard({
  appt, onConfirm, onCancel, onCheckIn,
}: {
  appt: Appointment;
  onConfirm: (a: Appointment) => void;
  onCancel: (a: Appointment) => void;
  onCheckIn: (a: Appointment) => void;
}) {
  const scheduled = new Date(appt.scheduled_at);
  const dateStr = scheduled.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Date pill */}
        <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-blue-700 dark:text-blue-400 leading-none">{scheduled.getDate()}</span>
          <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">
            {scheduled.toLocaleString('en-IN', { month: 'short' })}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 dark:text-white">{appt.patient_name}</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            <ClockIcon className="w-3.5 h-3.5 inline-block mr-1 -mt-px" />
            {dateStr} at {timeStr}
          </p>
          {appt.notes && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 italic">Note: {appt.notes}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0 self-start sm:self-center">
          {appt.status === 'pending' && (
            <>
              <button
                onClick={() => onConfirm(appt)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
                title="Confirm this appointment"
              >
                <CalendarCheck className="w-4 h-4" />Confirm
              </button>
              <button
                onClick={() => onCancel(appt)}
                className="p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded-xl transition-colors"
                title="Decline appointment"
              >
                <CalendarX className="w-4 h-4" />
              </button>
            </>
          )}
          {appt.status === 'checked_in' && (
            <span className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-xl text-xs font-semibold">
              <Activity className="w-3.5 h-3.5" />In Consultation
            </span>
          )}
          {appt.status === 'completed' && (
            <span className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />Prescription Sent
            </span>
          )}
          {appt.status === 'cancelled' && (
            <span className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold">
              <CalendarX className="w-3.5 h-3.5" />Cancelled
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AppointmentsPage({
  appointments,
  onConfirm,
  onCancel,
  onCheckIn,
}: {
  appointments: Appointment[];
  onConfirm: (a: Appointment) => void;
  onCancel: (a: Appointment) => void;
  onCheckIn: (a: Appointment) => void;
}) {
  const [showCancelled, setShowCancelled] = React.useState(false);

  const pending   = appointments.filter(a => a.status === 'pending')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const cancelled = appointments.filter(a => a.status === 'cancelled')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return (
    <motion.div
      key="appointments"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Action banner */}
      {pending.length > 0 ? (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <span className="font-bold">{pending.length} request{pending.length !== 1 ? 's' : ''}</span> awaiting review.
            Confirm to add to queue — or cancel to decline.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-2xl">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 dark:text-green-400">
            All caught up! No pending requests. Confirmed appointments are visible in Queue.
          </p>
        </div>
      )}

      {/* Pending section header */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
        <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-widest">
          Pending Review ({pending.length})
        </h3>
      </div>

      {/* Pending cards */}
      <AnimatePresence mode="popLayout">
        {pending.length === 0 ? (
          <motion.div
            key="empty-pending"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-100 dark:border-slate-800 p-12 text-center"
          >
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-400">No pending requests</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">New bookings from UniCare patients will appear here</p>
          </motion.div>
        ) : (
          pending.map(appt => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onCheckIn={onCheckIn}
            />
          ))
        )}
      </AnimatePresence>

      {/* Cancelled collapsible section */}
      {cancelled.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCancelled(v => !v)}
            className="flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-3"
          >
            {showCancelled ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Cancelled / Declined ({cancelled.length})
          </button>
          <AnimatePresence>
            {showCancelled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {cancelled.map(appt => (
                  <AppointmentCard
                    key={appt.id}
                    appt={appt}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    onCheckIn={onCheckIn}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
