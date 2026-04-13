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
} from 'lucide-react';
import { cn, calculateAge, formatDateTime } from './lib/utils';
import { Patient, Consultation, QueueItem, PacketData, Medicine, Appointment, AppointmentStatus } from './types';
import { useAuth } from './contexts/AuthContext';
import type { DoctorProfile } from './contexts/AuthContext';
import { supabase, patientSupabase } from './lib/supabase';
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
  if ((doctor as any).phone) doc.text(`📞 ${(doctor as any).phone}`, 20, 33);

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
    { label: 'Appointments', icon: Calendar, path: '/appointments' },
    { label: 'Queue', icon: Clock, path: '/queue' },
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
    { label: 'Appts', icon: Calendar, path: '/appointments' },
    { label: 'Queue', icon: Clock, path: '/queue' },
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

// ─── QR Scanner ──────────────────────────────────────────────────────────────

const QRScanner = ({ onScan }: { onScan: (url: string) => void }) => {
  const [input, setInput] = useState('');
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (input) { onScan(input); setInput(''); } };
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400"><FileSearch className="w-6 h-6" /></div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Health Packet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Paste the patient's secure health packet URL</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste packet URL here..."
          className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400" />
        <button type="submit" disabled={!input} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50">
          Access Health Packet
        </button>
      </form>
    </div>
  );
};

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
              <button key={t} onClick={() => setTab(t)} className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", tab === t ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}>
                {t === 'existing' ? '🔍 Existing Patient' : '➕ New Walk-in'}
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

function DashboardPage({ patients, queue, onQRScan, onStartConsultation }: {
  patients: Patient[];
  queue: QueueItem[];
  onQRScan: (url: string) => void;
  onStartConsultation: (item: QueueItem) => void;
}) {
  const navigate = useNavigate();
  const waiting = queue.filter(q => q.status === 'waiting');
  const completed = queue.filter(q => q.status === 'completed');
  const inConsult = queue.find(q => q.status === 'in-consultation');

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Patients" value={patients.length} icon={Users} color="blue" />
        <StatCard label="Waiting" value={waiting.length} icon={Hourglass} color="orange" />
        <StatCard label="In Session" value={inConsult ? 1 : 0} icon={Activity} color="purple" />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <QRScanner onScan={onQRScan} />

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
    </motion.div>
  );
}

// ─── Page: Patients ───────────────────────────────────────────────────────────

function PatientsPage({ patients, onSelectPatient }: { patients: Patient[]; onSelectPatient: (p: Patient) => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone && p.phone.includes(search))
  );
  return (
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
                  <button onClick={() => { onSelectPatient(patient); navigate('/consultation'); }}
                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-bold text-xs hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 ml-auto">
                    <FileText className="w-3.5 h-3.5" />Consult
                  </button>
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
            <button
              onClick={() => { onSelectPatient(patient); navigate('/consultation'); }}
              className="flex-shrink-0 p-2.5 rounded-xl bg-blue-600 text-white shadow-md"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Page: Queue ──────────────────────────────────────────────────────────────

function QueuePage({ queue, patients, onStartConsultation, onRemoveFromQueue, onAddToQueue }: {
  queue: QueueItem[];
  patients: Patient[];
  onStartConsultation: (item: QueueItem) => void;
  onRemoveFromQueue: (id: string) => void;
  onAddToQueue: (patientId: string, complaint: string, newPatient?: Omit<Patient, 'id'>) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const waiting = queue.filter(q => q.status === 'waiting').sort((a, b) => a.token_number - b.token_number);
  const inConsult = queue.find(q => q.status === 'in-consultation');
  const completed = queue.filter(q => q.status === 'completed').sort((a, b) => b.token_number - a.token_number);

  const avgWait = waiting.length > 0
    ? Math.round(waiting.reduce((acc, item) => acc + (Date.now() - new Date(item.created_at).getTime()) / 60000, 0) / waiting.length)
    : 0;

  return (
    <motion.div key="queue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Queue header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              {queue.length} total
            </span>
            <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-3 py-1 rounded-full">
              {waiting.length} waiting
            </span>
            {inConsult && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                1 in consultation
              </span>
            )}
            <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">
              {completed.length} done
            </span>
            {avgWait > 0 && (
              <span className="text-xs font-medium text-gray-400">· Avg wait: {avgWait} min</span>
            )}
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all text-sm flex-shrink-0">
          <UserPlus className="w-4 h-4" />Add Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waiting column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-widest">Waiting ({waiting.length})</h3>
          </div>
          <AnimatePresence>
            {waiting.map((item) => {
              const handleStart = () => { onStartConsultation(item); navigate('/consultation'); };
              const handleRemove = () => onRemoveFromQueue(item.id);
              return <WaitingCard key={item.id} item={item} onStart={handleStart} onRemove={handleRemove} />;
            })}
          </AnimatePresence>
          {waiting.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-100 dark:border-slate-800 p-12 text-center">
              <Hourglass className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-400">No patients waiting</p>
              <button onClick={() => setShowModal(true)} className="mt-4 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mx-auto">
                <Plus className="w-3.5 h-3.5" />Add a walk-in patient
              </button>
            </div>
          )}
        </div>

        {/* Right column: In Consultation + Stats */}
        <div className="space-y-4">
          {/* In consultation */}
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

          {/* Quick stats */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today's Summary</h4>
            {[
              { label: 'Patients Seen', value: completed.length, icon: CheckCircle2, color: 'text-green-600' },
              { label: 'Still Waiting', value: waiting.length, icon: Clock, color: 'text-orange-500' },
              { label: 'Avg Wait Time', value: avgWait > 0 ? `${avgWait} min` : '—', icon: Timer, color: 'text-blue-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Icon className={cn("w-4 h-4", color)} />
                  <span className="text-sm">{label}</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white text-sm">{value}</span>
              </div>
            ))}
          </div>

          {/* Completed (collapsible) */}
          {completed.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <button onClick={() => setShowCompleted(v => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="font-bold text-gray-900 dark:text-white text-sm">Completed ({completed.length})</span>
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
          <TimingChip label="🌅 Morning" active={newMedicine.timing.includes('morning')} onClick={() => toggleTiming('morning')} />
          <TimingChip label="☀️ Noon" active={newMedicine.timing.includes('noon')} onClick={() => toggleTiming('noon')} />
          <TimingChip label="🌙 Evening" active={newMedicine.timing.includes('evening')} onClick={() => toggleTiming('evening')} />
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

  if (!selectedPatient) return <Navigate to="/" replace />;

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
  if (!packetData) return <Navigate to="/consultation" replace />;
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
    ? `https://unicare.vercel.app/book?d=${clinicCode}`
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
              <p className="text-xs text-gray-500 dark:text-slate-400">Share this code or link — patients use it to book appointments with you</p>
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

              {/* Booking URL */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Booking Link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate font-mono">{bookingUrl}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(bookingUrl, 'url')}
                    className={cn(
                      'flex-shrink-0 p-2.5 rounded-xl text-sm font-bold transition-all',
                      urlCopied
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700'
                        : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300'
                    )}
                    title="Copy link"
                  >
                    {urlCopied ? <CheckCircle2 className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
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
    '/patients': { title: 'Patients', subtitle: 'Manage permanent patient records.' },
    '/appointments': { title: 'Appointments', subtitle: 'Manage scheduled appointments and check patients in.' },
    '/queue': { title: "Today's Queue", subtitle: 'Manage patient flow and call next in line.' },
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
      setQueue(data as unknown as QueueItem[]);
      // Keep activeQueueItem in sync
      const inConsult = (data as unknown as QueueItem[]).find(q => q.status === 'in-consultation');
      if (inConsult) setActiveQueueItem(inConsult);
    }
  }, [doctorProfile]);

  const fetchPatients = useCallback(async () => {
    if (!doctorProfile) return;
    const { data } = await supabase.from('patients').select('*').eq('doctor_id', doctorProfile.id).order('name');
    if (data) setPatients(data as Patient[]);
  }, [doctorProfile]);

  const fetchAppointments = useCallback(async () => {
    if (!doctorProfile) return;
    const { data } = await supabase
      .from('appointments')
      .select('*, patient:patients(*)')
      .eq('doctor_id', doctorProfile.id)
      .not('status', 'in', '("cancelled","completed")')
      .order('scheduled_at', { ascending: true });
    if (data) setAppointments(data as unknown as Appointment[]);
  }, [doctorProfile]);

  const syncPatientAppointmentsToLocal = useCallback(async () => {
    if (!doctorProfile) return;
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
          timezone: a.timezone,
          status: a.status,
          notes: a.notes,
        }));
        await supabase.from('appointments').upsert(toUpsert, { onConflict: 'patient_unicare_appointment_id' });
      }
    } catch (err) {
      console.error('Failed to sync patient appointments:', err);
    }
  }, [doctorProfile]);

  useEffect(() => {
    if (!doctorProfile) return;
    fetchQueue();
    fetchPatients();
    
    syncPatientAppointmentsToLocal().then(() => {
      fetchAppointments();
    });

    // Queue realtime — scoped to this doctor
    const queueChannel = supabase
      .channel('queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `doctor_id=eq.${doctorProfile.id}` }, () => {
        fetchQueue();
      })
      .subscribe();

    // Appointments realtime — scoped to this doctor
    const apptChannel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorProfile.id}` }, () => {
        fetchAppointments();
      })
      .subscribe();

    // Patient Appointments Realtime — listen for inserts/updates from Patient DB
    const patientApptChannel = patientSupabase
      .channel('patient-appointments-realtime-doctor-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorProfile.id}` }, async () => {
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
  }, [doctorProfile, fetchQueue, fetchPatients, fetchAppointments, syncPatientAppointmentsToLocal]);

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

  // ── Start Consultation from Queue ──────────────────────────────────────────

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

  // ── Appointment: Confirm ───────────────────────────────────────────────────

  const handleConfirmAppointment = async (appt: Appointment) => {
    try {
      // Update doctor-side mirror
      await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appt.id);
      // Write back to patient app (anon key + RLS policy validates packet)
      await patientSupabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appt.patient_unicare_appointment_id);
      fetchAppointments();
    } catch (err) {
      console.error('Error confirming appointment:', err);
    }
  };

  // ── Appointment: Cancel ────────────────────────────────────────────────────

  const handleCancelAppointment = async (appt: Appointment) => {
    try {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
      await patientSupabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.patient_unicare_appointment_id);
      fetchAppointments();
    } catch (err) {
      console.error('Error cancelling appointment:', err);
    }
  };

  // ── Appointment: Check In → Queue ──────────────────────────────────────────
  // Creates a queue entry, links it, and opens the consultation form.

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

      // Create queue entry
      const token = await getNextToken();
      const { data: qEntry, error: qErr } = await supabase
        .from('queue')
        .insert({
          doctor_id: doctorProfile.id,
          patient_id: patient.id,
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
        .update({ status: 'checked_in', queue_id: qEntry.id, patient_id: patient.id })
        .eq('id', appt.id);

      // Writeback to patient app
      await patientSupabase
        .from('appointments')
        .update({ status: 'checked_in', queue_id: qEntry.id })
        .eq('id', appt.patient_unicare_appointment_id);

      const updatedAppt: Appointment = { ...appt, status: 'checked_in', queue_id: qEntry.id, patient_id: patient.id };
      setActiveAppointment(updatedAppt);
      setActiveQueueItem(qEntry as unknown as QueueItem);
      setSelectedPatient(patient);
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

      // If this consultation came from an appointment, mark it complete
      // and write a prescription record back to the patient app
      if (activeAppointment) {
        await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', activeAppointment.id);

        // Writeback appointment status to patient app
        await patientSupabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', activeAppointment.patient_unicare_appointment_id);

        // Write prescription to patient app so patient can view it
        await patientSupabase.from('prescriptions').insert({
          appointment_id: activeAppointment.patient_unicare_appointment_id,
          profile_id: activeAppointment.profile_id,
          doctor_id: doctorProfile.id,
          diagnosis: consultationForm.diagnosis || null,
          medications: consultationForm.medicines,
          notes: consultationForm.notes || null,
        });
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
              <DashboardPage patients={patients} queue={queue} onQRScan={handleQRScan} onStartConsultation={handleStartConsultation} />
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
              <QueuePage queue={queue} patients={patients} onStartConsultation={handleStartConsultation} onRemoveFromQueue={handleRemoveFromQueue} onAddToQueue={handleAddToQueue} />
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

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:    { label: 'Pending',    color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',    dot: 'bg-amber-400' },
  confirmed:  { label: 'Confirmed',  color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       dot: 'bg-blue-500' },
  checked_in: { label: 'Checked In', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', dot: 'bg-purple-500' },
  completed:  { label: 'Completed',  color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',   dot: 'bg-green-500' },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',          dot: 'bg-red-400' },
};

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
      className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
    >
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
          <p className="font-bold text-gray-900 dark:text-white truncate">{appt.patient_name}</p>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          <ClockIcon className="w-3.5 h-3.5 inline-block mr-1 -mt-px" />
          {dateStr} · {timeStr}
        </p>
        {appt.notes && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 truncate">{appt.notes}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-shrink-0">
        {appt.status === 'pending' && (
          <>
            <button
              onClick={() => onConfirm(appt)}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
              title="Confirm appointment"
            >
              <CalendarCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => onCancel(appt)}
              className="p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded-xl transition-colors"
              title="Cancel appointment"
            >
              <CalendarX className="w-4 h-4" />
            </button>
          </>
        )}
        {appt.status === 'confirmed' && (
          <>
            <button
              onClick={() => onCheckIn(appt)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />Check In
            </button>
            <button
              onClick={() => onCancel(appt)}
              className="p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded-xl transition-colors"
              title="Cancel appointment"
            >
              <CalendarX className="w-4 h-4" />
            </button>
          </>
        )}
        {appt.status === 'checked_in' && (
          <span className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-xl text-xs font-semibold">
            <Hourglass className="w-3.5 h-3.5" />In Consultation
          </span>
        )}
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
  const [activeTab, setActiveTab] = React.useState<'pending' | 'confirmed' | 'checked_in'>('pending');

  const pending   = appointments.filter(a => a.status === 'pending');
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const checkedIn = appointments.filter(a => a.status === 'checked_in');

  const tabs: { key: 'pending' | 'confirmed' | 'checked_in'; label: string; count: number; icon: React.ElementType }[] = [
    { key: 'pending',    label: 'Pending',    count: pending.length,   icon: Hourglass },
    { key: 'confirmed',  label: 'Confirmed',  count: confirmed.length, icon: CalendarCheck },
    { key: 'checked_in', label: 'Checked In', count: checkedIn.length, icon: CheckCircle2 },
  ];

  const visible = activeTab === 'pending' ? pending : activeTab === 'confirmed' ? confirmed : checkedIn;

  return (
    <motion.div
      key="appointments"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Summary stat cards (clickable tabs) */}
      <div className="grid grid-cols-3 gap-3">
        {tabs.map(tab => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'cursor-pointer rounded-2xl p-4 border transition-all select-none',
              activeTab === tab.key
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none'
                : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-900 dark:text-white hover:border-blue-300 dark:hover:border-blue-800',
            )}
          >
            <tab.icon className="w-4 h-4 mb-2 opacity-75" />
            <p className="text-2xl font-bold">{tab.count}</p>
            <p className={cn('text-xs font-medium mt-0.5', activeTab === tab.key ? 'text-blue-100' : 'text-gray-500 dark:text-slate-400')}>
              {tab.label}
            </p>
          </div>
        ))}
      </div>

      {/* Cards list */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-300 dark:text-slate-600" />
              </div>
              <p className="font-semibold text-gray-400 dark:text-slate-500">
                No {activeTab === 'pending' ? 'pending' : activeTab === 'confirmed' ? 'confirmed' : 'checked-in'} appointments
              </p>
              <p className="text-sm text-gray-300 dark:text-slate-600 mt-1">
                {activeTab === 'pending'
                  ? 'New bookings from UniCare will appear here.'
                  : activeTab === 'confirmed'
                  ? 'Confirm pending appointments to see them here.'
                  : 'Checked-in patients appear once you click Check In.'}
              </p>
            </div>
          ) : (
            visible.map(appt => (
              <React.Fragment key={appt.id}>
                <AppointmentCard
                  appt={appt}
                  onConfirm={onConfirm}
                  onCancel={onCancel}
                  onCheckIn={onCheckIn}
                />
              </React.Fragment>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
