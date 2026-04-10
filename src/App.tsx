import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  History, 
  QrCode, 
  Bell, 
  Plus,
  ChevronRight,
  Activity,
  FileText,
  Calendar,
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
  Hash
} from 'lucide-react';
import { cn, calculateAge, formatDateTime } from './lib/utils';
import { Patient, Consultation, QueueItem, PacketData, Medicine } from './types';
import { useAuth } from './contexts/AuthContext';
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
  const timing = med.timing.join(' + ');
  const food = med.food === 'before' ? 'Before Food' : 'After Food';
  const days = med.days ? `${med.days} day${med.days !== 1 ? 's' : ''}` : '';
  return [timing, food, days].filter(Boolean).join(' • ');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const PatientRecordView = ({ 
  packet, 
  onClose, 
  onPreview 
}: { 
  packet: PacketData, 
  onClose: () => void,
  onPreview: (record: any) => void
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-slate-950/20">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold text-sm tracking-tight">Back to Queue</span>
          </button>
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
            Health Packet Verified
          </div>
        </div>

        {/* Patient Identity */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-start gap-8 transition-colors">
          <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/40 rounded-3xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
            <Users className="w-10 h-10" />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8">
            <div className="col-span-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">{packet.profile_data.name}</h1>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {packet.profile_data.dob ? `${calculateAge(packet.profile_data.dob)} years • ${formatDateTime(packet.profile_data.dob)}` : 'Age unknown'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Gender</p>
              <p className="font-bold text-gray-900 dark:text-white">{packet.profile_data.gender}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Blood Group</p>
              <p className="font-bold text-red-600 dark:text-red-400">{packet.profile_data.blood_group}</p>
            </div>
          </div>
        </div>

        {/* Medical History */}
        {packet.medical_history.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 px-2 transition-colors">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              Medical History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packet.medical_history.map((h, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors group">
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 tracking-widest">{h.question}</p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">{h.answer || 'No response provided'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Records */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 px-2 transition-colors">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
              <FileSearch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Shared Records ({packet.records.length})
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {packet.records.length > 0 ? packet.records.map((r, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:bg-blue-50/30 dark:hover:bg-blue-900/10">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110",
                    r.type === 'lab' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" : 
                    r.type === 'prescription' ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" : "bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-gray-400"
                  )}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white transition-colors">{r.title}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-tight">{r.provider} • {formatDateTime(r.date)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onPreview(r)}
                  className="px-6 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-bold text-xs hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white transition-all flex items-center gap-2 border border-transparent dark:border-slate-700/50"
                >
                  <FileSearch className="w-4 h-4" />
                  View Record
                </button>
              </div>
            )) : (
              <div className="bg-gray-50/50 dark:bg-slate-900/50 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center">
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No clinical records were shared in this packet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MediaPreviewModal = ({ record, onClose }: { record: any, onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-12">
      <div className="bg-white dark:bg-slate-900 w-full h-full rounded-3xl overflow-hidden flex flex-col shadow-2xl transition-colors duration-300">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white transition-colors">{record.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-tight">{record.file_name} • {record.file_type}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors group"
          >
            <ChevronRight className="w-6 h-6 rotate-90 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
          </button>
        </div>
        <div className="flex-1 bg-gray-900 flex items-center justify-center overflow-auto p-4">
          {record.file_type.includes('pdf') ? (
            <iframe 
              src={record.file_url} 
              className="w-full h-full rounded-xl"
              title={record.title}
            />
          ) : (
            <img 
              src={record.file_url} 
              alt={record.title} 
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          )}
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex justify-end gap-4 transition-colors">
          <button 
            onClick={() => window.open(record.file_url, '_blank')}
            className="px-6 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
          >
            <Plus className="w-4 h-4 rotate-45" />
            Open in New Tab
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 dark:bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-black dark:hover:bg-blue-700 transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const Sidebar = ({ darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void }) => {
  const { doctorProfile, signOut } = useAuth();
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { id: 'patients', label: 'Patients', icon: Users, path: '/patients' },
    { id: 'queue', label: 'Queue', icon: Clock, path: '/queue' },
    { id: 'consultations', label: 'Consultations', icon: History, path: '/consultations' },
  ];

  const initials = doctorProfile?.full_name
    ? doctorProfile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <div className="w-64 bg-white dark:bg-slate-900/60 backdrop-blur-xl border-r border-gray-100 dark:border-slate-800 flex flex-col h-screen sticky top-0 transition-all duration-300 z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
          <Stethoscope className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-white leading-tight transition-colors">UniCare</h1>
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tracking-widest uppercase">EMR Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Main Menu</p>
        {menuItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200/50 dark:shadow-none" 
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300")} />
                <span className="font-bold text-sm">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={onToggleTheme}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
            "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:hover:text-white"
          )}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
            darkMode ? "bg-slate-700 text-yellow-400" : "bg-blue-50 text-blue-600"
          )}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </div>
          <span className="font-bold text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="p-4 border-t border-gray-50 dark:border-slate-800 space-y-2">
        {/* Profile link — clickable */}
        <NavLink
          to="/profile"
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group",
            isActive
              ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800"
              : "bg-gray-50 dark:bg-slate-800/50 border-transparent dark:border-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-800"
          )}
        >
          {doctorProfile?.avatar_url ? (
            <img src={doctorProfile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-xs flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doctorProfile?.full_name || 'Doctor'}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
              <UserCog className="w-2.5 h-2.5" />
              Edit Profile
            </p>
          </div>
        </NavLink>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

// ─── Shared StatCard ─────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => {
  const getColors = () => {
    switch(color) {
      case 'blue': return "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400";
      case 'orange': return "bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400";
      case 'green': return "bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-400";
      default: return color;
    }
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl transition-all duration-500 group-hover:scale-110", getColors())}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Today</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1 animate-pulse" />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">{value}</h3>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
};

// ─── QR Scanner ──────────────────────────────────────────────────────────────

const QRScanner = ({ onScan }: { onScan: (url: string) => void }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input) onScan(input);
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400">
          <FileSearch className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Health Packet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter the secure health packet URL shared by the patient</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste packet URL here..."
            className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <button
          type="submit"
          disabled={!input}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          Access Health Packet
        </button>
      </form>
    </div>
  );
};

// ─── PDF Generator ───────────────────────────────────────────────────────────

import type { DoctorProfile } from './contexts/AuthContext';

const PrescriptionPDF = (consultation: Consultation, patient: Patient, doctor: DoctorProfile) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 42, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(doctor.clinic_name || 'UniCare Health', 20, 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (doctor.clinic_address) {
    doc.text(doctor.clinic_address, 20, 27);
  }
  if (doctor.phone) {
    doc.text(`📞 ${doctor.phone}`, 20, 33);
  }
  
  // Doctor info (top right)
  const doctorName = `DR. ${(doctor.full_name || 'Doctor').toUpperCase()}`;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(doctorName, pageWidth - 20, 16, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (doctor.specialty) {
    doc.text(doctor.specialty, pageWidth - 20, 22, { align: 'right' });
  }
  if (doctor.qualification) {
    doc.text(doctor.qualification, pageWidth - 20, 28, { align: 'right' });
  }
  if (doctor.registration_number) {
    doc.text(`Reg No: ${doctor.registration_number}`, pageWidth - 20, 34, { align: 'right' });
  }
  
  // Patient info band
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
  
  // Rx symbol
  doc.setTextColor(37, 99, 235);
  doc.setFontSize(32);
  doc.text('Rx', 20, 98);
  
  // Symptoms
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
  
  // Medicines table
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
    headStyles: { 
      fillColor: [37, 99, 235], 
      textColor: [255, 255, 255], 
      fontSize: 10, 
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: { 
      fontSize: 10, 
      textColor: [31, 41, 55],
      cellPadding: 6
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    margin: { left: 20, right: 20 }
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

// ─── Page: Dashboard ─────────────────────────────────────────────────────────

function DashboardPage({ 
  patients, queue, onQRScan, onSelectPatient 
}: { 
  patients: Patient[], 
  queue: QueueItem[], 
  onQRScan: (url: string) => void,
  onSelectPatient: (p: Patient) => void
}) {
  const navigate = useNavigate();
  return (
    <motion.div 
      key="dashboard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Patients" value={patients.length} icon={Users} color="blue" />
        <StatCard label="In Queue" value={queue.filter(q => q.status !== 'completed').length} icon={Clock} color="orange" />
        <StatCard label="Completed" value={queue.filter(q => q.status === 'completed').length} icon={CheckCircle2} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <QRScanner onScan={onQRScan} />
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Live Queue</h3>
            <button onClick={() => navigate('/queue')} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {queue.filter(q => q.status !== 'completed').slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-gray-100 dark:border-slate-700">
                  {item.patient?.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{item.patient?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.patient?.gender} • {item.patient?.age}Y</p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  item.status === 'waiting' 
                    ? "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400" 
                    : "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                )}>
                  {item.status}
                </div>
                <button 
                  onClick={() => {
                    onSelectPatient(item.patient!);
                    navigate('/consultation');
                  }}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page: Patients ───────────────────────────────────────────────────────────

function PatientsPage({ patients, onSelectPatient }: { patients: Patient[], onSelectPatient: (p: Patient) => void }) {
  const navigate = useNavigate();
  return (
    <motion.div key="patients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-50 dark:border-slate-800">
            <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Patient</th>
            <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Age/Gender</th>
            <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Contact</th>
            <th className="text-right py-4 px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Actions</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="py-4 px-4 font-bold text-gray-900 dark:text-white transition-colors">{patient.name}</td>
              <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">{patient.age}Y / {patient.gender}</td>
              <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">{patient.phone}</td>
              <td className="py-4 px-4 text-right">
                <button onClick={() => { onSelectPatient(patient); navigate('/consultation'); }} className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  <FileText className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}

// ─── Page: Queue ─────────────────────────────────────────────────────────────

function QueuePage({ queue }: { queue: QueueItem[] }) {
  return (
    <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {['waiting', 'in-consultation', 'completed'].map((status) => (
        <div key={status} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="font-bold text-gray-900 dark:text-white capitalize mb-6 flex items-center gap-2">
            {status}
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </h3>
          <div className="space-y-4">
            {queue.filter(q => q.status === status).map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border border-transparent dark:border-slate-700/50">
                <p className="text-sm font-bold text-gray-900 dark:text-white transition-colors">{item.patient?.name}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{item.patient?.gender} • {item.patient?.age}Y</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Page: Consultations ──────────────────────────────────────────────────────

function ConsultationsPage() {
  return (
    <motion.div key="consultations" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors text-center py-20">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Consultation History</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Past consultations will appear here.</p>
      </div>
    </motion.div>
  );
}

// ─── Medicine Entry UI ────────────────────────────────────────────────────────

const TimingChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-200 select-none",
      active
        ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none scale-105"
        : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500"
    )}
  >
    {label}
  </button>
);

const MedicineEntryForm = ({
  newMedicine,
  setNewMedicine,
  addMedicine,
}: {
  newMedicine: Medicine;
  setNewMedicine: React.Dispatch<React.SetStateAction<Medicine>>;
  addMedicine: () => void;
}) => {
  const toggleTiming = (t: 'morning' | 'noon' | 'evening') => {
    setNewMedicine(prev => ({
      ...prev,
      timing: prev.timing.includes(t)
        ? prev.timing.filter(x => x !== t)
        : [...prev.timing, t],
    }));
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/50 space-y-4">
      {/* Medicine name */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Medicine Name</label>
        <input
          type="text"
          placeholder="e.g. Paracetamol 500mg"
          value={newMedicine.name}
          onChange={(e) => setNewMedicine(prev => ({ ...prev, name: e.target.value }))}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white dark:placeholder:text-gray-500 transition-all"
        />
      </div>

      {/* Timing chips */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">When to Take</label>
        <div className="flex gap-2">
          <TimingChip label="🌅 Morning" active={newMedicine.timing.includes('morning')} onClick={() => toggleTiming('morning')} />
          <TimingChip label="☀️ Noon" active={newMedicine.timing.includes('noon')} onClick={() => toggleTiming('noon')} />
          <TimingChip label="🌙 Evening" active={newMedicine.timing.includes('evening')} onClick={() => toggleTiming('evening')} />
        </div>
      </div>

      {/* Food & Days row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Food Timing</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewMedicine(prev => ({ ...prev, food: 'before' }))}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all duration-200",
                newMedicine.food === 'before'
                  ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-100 dark:shadow-none"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:border-green-400"
              )}
            >
              Before Food
            </button>
            <button
              type="button"
              onClick={() => setNewMedicine(prev => ({ ...prev, food: 'after' }))}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all duration-200",
                newMedicine.food === 'after'
                  ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-100 dark:shadow-none"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:border-green-400"
              )}
            >
              After Food
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Duration (Days)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              placeholder="e.g. 5"
              value={newMedicine.days || ''}
              onChange={(e) => setNewMedicine(prev => ({ ...prev, days: parseInt(e.target.value) || 0 }))}
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white dark:placeholder:text-gray-500 transition-all"
            />
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 shrink-0">days</span>
          </div>
        </div>
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={addMedicine}
        disabled={!newMedicine.name || newMedicine.timing.length === 0}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-100 dark:shadow-none"
      >
        <Plus className="w-4 h-4" />
        Add Medicine
      </button>
    </div>
  );
};

// ─── Page: Consultation (New) ─────────────────────────────────────────────────

function ConsultationPage({ 
  selectedPatient,
  packetData,
  consultationForm,
  setConsultationForm,
  newMedicine,
  setNewMedicine,
  addMedicine,
  removeMedicine,
  handleSaveConsultation,
  setSelectedRecord,
}: {
  selectedPatient: Patient | null,
  packetData: PacketData | null,
  consultationForm: any,
  setConsultationForm: any,
  newMedicine: Medicine,
  setNewMedicine: React.Dispatch<React.SetStateAction<Medicine>>,
  addMedicine: () => void,
  removeMedicine: (i: number) => void,
  handleSaveConsultation: (printPdf: boolean) => void,
  setSelectedRecord: (r: any) => void,
}) {
  const navigate = useNavigate();
  const [lastVisit, setLastVisit] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPatient) return;
    // Fetch last visit from DB
    supabase
      .from('consultations')
      .select('created_at')
      .eq('patient_id', selectedPatient.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLastVisit(new Date(data[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
        } else {
          setLastVisit('First Visit');
        }
      });
  }, [selectedPatient]);

  if (!selectedPatient) {
    return <Navigate to="/" replace />;
  }

  const bloodGroup = packetData?.profile_data?.blood_group || '—';

  return (
    <motion.div 
      key="consultation"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          {/* Patient Quick Info */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden group">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center font-bold text-xl uppercase">
                {selectedPatient.name[0]}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{selectedPatient.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID: #{selectedPatient.id.slice(0, 8)}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {[
                { label: 'Age / Gender', value: `${selectedPatient.age}Y / ${selectedPatient.gender.toUpperCase()}`, icon: Users },
                { label: 'Blood Group', value: bloodGroup, icon: Activity },
                { label: 'Last Visit', value: lastVisit ?? '…', icon: Calendar },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 group-hover:bg-gray-50 dark:group-hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">{item.label}</span>
                  </div>
                  <span className={cn("text-xs font-bold", item.label === 'Blood Group' && bloodGroup !== '—' ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")}>{item.value}</span>
                </div>
              ))}
            </div>

            {packetData && (
              <button 
                onClick={() => navigate('/record-view')}
                className="w-full mt-6 py-4 bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <FileSearch className="w-4 h-4" />
                Expand Full Records
              </button>
            )}
          </div>

          {/* Clinical Context */}
          <div className="bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-100 text-white relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <h4 className="text-sm font-bold mb-2">Clinical Protocol</h4>
            <p className="text-xs text-blue-50 leading-relaxed mb-4">
              Review drug allergies before prescribing. All clinical data is encrypted with SHA-256 for patient privacy.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
              <CheckCircle2 className="w-3 h-3" />
              Verified Security
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Clinical Evaluation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Record symptoms, diagnosis and treatment plan</p>
              </div>
              <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Session Active
              </div>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Symptoms & Complaints</label>
                  <textarea 
                    value={consultationForm.symptoms}
                    onChange={(e) => setConsultationForm((prev: any) => ({ ...prev, symptoms: e.target.value }))}
                    placeholder="e.g. Severe headache for 3 days, nausea..."
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all min-h-[120px] text-sm text-gray-900 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Clinical Diagnosis</label>
                  <textarea 
                    value={consultationForm.diagnosis}
                    onChange={(e) => setConsultationForm((prev: any) => ({ ...prev, diagnosis: e.target.value }))}
                    placeholder="e.g. Acute Migraine, Viral Fever..."
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all min-h-[120px] text-sm text-gray-900 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>
              </div>

              {/* Medicine Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Medication Plan (Rx)</label>
                  <span className="text-[10px] font-medium text-gray-400">{consultationForm.medicines.length} item{consultationForm.medicines.length !== 1 ? 's' : ''} added</span>
                </div>

                {/* Added medicines list */}
                {consultationForm.medicines.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mb-2">
                    {consultationForm.medicines.map((med: Medicine, i: number) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 group shadow-sm transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                          <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight truncate">{med.name}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{formatMedicineTiming(med)}</p>
                        </div>
                        <button onClick={() => removeMedicine(i)} className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Entry form */}
                <MedicineEntryForm newMedicine={newMedicine} setNewMedicine={setNewMedicine} addMedicine={addMedicine} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Additional Advice / Notes</label>
                <textarea 
                  value={consultationForm.notes}
                  onChange={(e) => setConsultationForm((prev: any) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Bed rest, avoid cold drinks, follow up in 1 week..."
                  className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all min-h-[100px] text-sm text-gray-900 dark:text-white dark:placeholder:text-gray-500"
                />
              </div>

              {/* Save buttons */}
              <div className="pt-6 border-t border-gray-50 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-gray-400 font-medium">
                  All changes are autosaved | Secure Encryption Active
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => handleSaveConsultation(false)}
                    className="flex-1 sm:flex-none px-6 py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save Only
                  </button>
                  <button 
                    onClick={() => handleSaveConsultation(true)}
                    className="flex-1 sm:flex-none px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Save & Print Rx
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

function RecordViewPage({ packetData, setSelectedRecord }: { packetData: PacketData | null, setSelectedRecord: (r: any) => void }) {
  const navigate = useNavigate();
  if (!packetData) return <Navigate to="/consultation" replace />;
  return (
    <motion.div 
      key="record-view"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <PatientRecordView 
        packet={packetData} 
        onClose={() => navigate('/consultation')}
        onPreview={(r) => setSelectedRecord(r)}
      />
    </motion.div>
  );
}

// ─── Page: Profile ────────────────────────────────────────────────────────────

function ProfilePage() {
  const { doctorProfile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    specialty: '',
    qualification: '',
    registration_number: '',
    clinic_name: '',
    clinic_address: '',
    phone: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form from existing profile whenever profile loads
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
    }
  }, [doctorProfile]);

  const handleSave = async () => {
    if (!doctorProfile) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('doctors')
        .update({
          full_name: form.full_name,
          specialty: form.specialty,
          qualification: form.qualification,
          registration_number: form.registration_number,
          clinic_name: form.clinic_name,
          clinic_address: form.clinic_address,
          phone: form.phone,
          avatar_url: form.avatar_url || null,
        })
        .eq('id', doctorProfile.id);
      if (updateError) throw updateError;
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: 'full_name', label: 'Full Name', placeholder: 'Dr. Aryan Pandey', icon: Users, required: true },
    { key: 'specialty', label: 'Specialty', placeholder: 'General Physician & Diabetologist', icon: Stethoscope },
    { key: 'qualification', label: 'Qualification', placeholder: 'MBBS, MD (General Medicine)', icon: Award },
    { key: 'registration_number', label: 'Registration Number', placeholder: 'DMC/12345/2024', icon: Hash },
    { key: 'clinic_name', label: 'Clinic / Hospital Name', placeholder: 'UniCare Health Clinic', icon: Activity },
    { key: 'clinic_address', label: 'Clinic Address', placeholder: '123 Medical Lane, New Delhi', icon: MapPin },
    { key: 'phone', label: 'Contact Number', placeholder: '+91 98765 43210', icon: Phone },
    { key: 'avatar_url', label: 'Avatar URL (Optional)', placeholder: 'https://...', icon: Users },
  ];

  return (
    <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
        <div className="flex items-center gap-6 relative">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold border border-white/30">
            {form.avatar_url
              ? <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-2xl" />
              : (form.full_name || 'DR')[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{form.full_name || 'Your Name'}</h2>
            <p className="text-blue-100 text-sm mt-1">{form.specialty || 'Specialty'}</p>
            <p className="text-blue-200 text-xs mt-0.5">{form.clinic_name || 'Clinic Name'}</p>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm p-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Profile Information</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This data appears on prescription PDFs and consultation records.</p>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {fields.map(({ key, label, placeholder, icon: Icon, required }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                <Icon className="w-3 h-3" />
                {label}
                {required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={(form as any)[key]}
                onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white dark:placeholder:text-gray-500 transition-all"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !form.full_name}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all",
            saved
              ? "bg-green-600 text-white shadow-lg shadow-green-100 dark:shadow-none"
              : "bg-blue-600 text-white shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100"
          )}
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 className="w-5 h-5" /> Profile Saved!</>
          ) : (
            <><Save className="w-5 h-5" /> Save Profile</>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Page header labels ───────────────────────────────────────────────────────

function usePageMeta() {
  const location = useLocation();
  const { doctorProfile } = useAuth();
  const firstName = doctorProfile?.full_name?.split(' ')[0] || 'Doctor';
  const path = location.pathname;
  const titles: Record<string, { title: string; subtitle: string }> = {
    '/': { title: 'Dashboard', subtitle: `Good day, Dr. ${firstName}. Here is your clinic overview.` },
    '/patients': { title: 'Patients', subtitle: 'Manage permanent patient records.' },
    '/queue': { title: 'Queue', subtitle: 'Track patients waiting for consultation.' },
    '/consultations': { title: 'Consultations', subtitle: 'Review past consultation history.' },
    '/consultation': { title: 'New Consultation', subtitle: 'Complete the clinical record.' },
    '/record-view': { title: 'Record View', subtitle: 'Reviewing shared clinical documentation.' },
    '/profile': { title: 'My Profile', subtitle: 'Manage your professional details and clinic info.' },
  };
  return titles[path] ?? { title: 'UniCare', subtitle: '' };
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading, isConfigured, doctorProfile } = useAuth();
  const navigate = useNavigate();

  // ── Dark mode ──────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState<boolean>(getInitialTheme);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    applyTheme(next);
  };

  useEffect(() => {
    applyTheme(darkMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── App state ──────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [packetData, setPacketData] = useState<PacketData | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const [consultationForm, setConsultationForm] = useState({
    symptoms: '',
    diagnosis: '',
    notes: '',
    medicines: [] as Medicine[]
  });
  const [newMedicine, setNewMedicine] = useState<Medicine>({ name: '', timing: [], food: 'after', days: 0 });

  useEffect(() => {
    if (doctorProfile) {
      fetchQueue();
      fetchPatients();
    }
  }, [doctorProfile]);

  const fetchQueue = async () => {
    if (!doctorProfile) return;
    try {
      const { data, error } = await supabase
        .from('queue')
        .select(`*, patient:patients(*)`)
        .eq('doctor_id', doctorProfile.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setQueue(data as unknown as QueueItem[]);
    } catch (err) {
      console.error('Error fetching queue:', err);
    }
  };

  const fetchPatients = async () => {
    if (!doctorProfile) return;
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('doctor_id', doctorProfile.id)
        .order('name', { ascending: true });
      if (error) throw error;
      setPatients(data as Patient[]);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const handleQRScan = async (url: string) => {
    setScanLoading(true);
    setScanError(null);
    try {
      const packetId = url.split('/').pop();
      if (!packetId || packetId.length < 36) throw new Error("Invalid health packet URL");

      const { data: packet, error: packetError } = await patientSupabase
        .from('shared_packets').select('*').eq('id', packetId).single();
      if (packetError || !packet) throw new Error("Health packet not found or inaccessible");
      if (packet.expires_at && new Date(packet.expires_at) < new Date()) throw new Error("Health packet has expired");

      const { data: profile, error: profileError } = await patientSupabase
        .from('profiles').select('*').eq('id', packet.profile_id).single();
      if (profileError || !profile) throw new Error("Patient profile not found");

      let medicalHistory: any[] = [];
      if (packet.share_medical_history) {
        const { data: history } = await patientSupabase.from('medical_history').select('*').eq('profile_id', profile.id);
        medicalHistory = history || [];
      }

      const { data: recordLinks } = await patientSupabase.from('shared_packet_records').select('record_id').eq('packet_id', packetId);
      let records: any[] = [];
      if (recordLinks && recordLinks.length > 0) {
        const recordIds = recordLinks.map((l: any) => l.record_id);
        const { data: recordsData } = await patientSupabase.from('records').select('*').in('id', recordIds);
        records = recordsData || [];
      }

      const fetchedPacket: PacketData = {
        id: packet.id,
        title: packet.title || "Health Packet",
        expires_at: packet.expires_at || "",
        profile_data: {
          name: profile.name,
          dob: profile.dob,
          gender: profile.gender || "Not specified",
          blood_group: profile.blood_group || "Unknown",
          abha_id: profile.abha_id || "",
          phone: profile.phone || "",
          email: profile.email || "",
          address: profile.address || ""
        },
        medical_history: medicalHistory.map(h => ({
          question_id: h.question_id,
          question: h.question_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          answer: h.answer
        })),
        records: records.map(r => ({
          id: r.id,
          title: r.title,
          date: r.date,
          provider: r.provider,
          type: r.type,
          file_name: r.file_name,
          file_type: r.file_type,
          file_url: `https://vtuujzlscnxiyxokxntk.supabase.co/storage/v1/object/public/medical-records/${r.file_url}`
        }))
      };

      setPacketData(fetchedPacket);
      
      const patientPhone = fetchedPacket.profile_data.phone;
      const patientName = fetchedPacket.profile_data.name;
      let patient = patients.find(p => (patientPhone && p.phone === patientPhone) || (!patientPhone && p.name === patientName));
      
      if (!patient) {
        const { data, error } = await supabase.from('patients').insert({
          doctor_id: doctorProfile!.id,
          name: patientName,
          age: profile.dob ? calculateAge(profile.dob) : 0,
          gender: fetchedPacket.profile_data.gender,
          phone: patientPhone,
          email: fetchedPacket.profile_data.email,
          abha_id: fetchedPacket.profile_data.abha_id,
          address: fetchedPacket.profile_data.address
        }).select().single();
        if (error) throw error;
        patient = data as Patient;
        fetchPatients();
      }

      const { error: queueError } = await supabase.from('queue').insert({
        doctor_id: doctorProfile!.id,
        patient_id: patient!.id,
        status: 'waiting'
      });
      if (queueError) throw queueError;
      
      fetchQueue();
      setSelectedPatient(patient!);
      navigate('/consultation');
    } catch (err: any) {
      setScanError(err.message || "Invalid link or network error");
    } finally {
      setScanLoading(false);
    }
  };

  const handleSaveConsultation = async (printPdf: boolean) => {
    if (!selectedPatient || !doctorProfile) return;
    try {
      const { data, error } = await supabase.from('consultations').insert({
        doctor_id: doctorProfile.id,
        patient_id: selectedPatient.id,
        symptoms: consultationForm.symptoms,
        diagnosis: consultationForm.diagnosis,
        notes: consultationForm.notes,
        medicines: consultationForm.medicines
      }).select().single();
      if (error) throw error;
      
      await supabase.from('queue').update({ status: 'completed' })
        .eq('doctor_id', doctorProfile.id)
        .eq('patient_id', selectedPatient.id)
        .neq('status', 'completed');

      if (printPdf) {
        const doc = PrescriptionPDF(data as Consultation, selectedPatient, doctorProfile);
        doc.save(`Rx_${selectedPatient.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);
      }
      
      setConsultationForm({ symptoms: '', diagnosis: '', notes: '', medicines: [] });
      setNewMedicine({ name: '', timing: [], food: 'after', days: 0 });
      setSelectedPatient(null);
      setPacketData(null);
      navigate('/');
      fetchQueue();
    } catch (err) {
      console.error('Error saving consultation:', err);
    }
  };

  const addMedicine = () => {
    if (newMedicine.name && newMedicine.timing.length > 0) {
      setConsultationForm(prev => ({ ...prev, medicines: [...prev.medicines, newMedicine] }));
      setNewMedicine({ name: '', timing: [], food: 'after', days: 0 });
    }
  };

  const removeMedicine = (index: number) => {
    setConsultationForm(prev => ({ ...prev, medicines: prev.medicines.filter((_, i) => i !== index) }));
  };

  // ── Loading / unconfigured / unauthenticated screens ──────────────────────

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-xl shadow-blue-100/50 border border-blue-50 dark:border-slate-800"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Configuration Required</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            UniCare EMR needs your Supabase configuration to function.
          </p>
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300">VITE_SUPABASE_URL</code>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300">VITE_SUPABASE_ANON_KEY</code>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // ── Authenticated layout ───────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] dark:bg-slate-950 transition-colors duration-300">
      <Sidebar darkMode={darkMode} onToggleTheme={toggleTheme} />
      
      <main className="flex-1 p-8 overflow-y-auto">
        <PageHeader />

        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={
              <DashboardPage 
                patients={patients} 
                queue={queue} 
                onQRScan={handleQRScan}
                onSelectPatient={(p) => setSelectedPatient(p)}
              />
            } />
            <Route path="/patients" element={
              <PatientsPage patients={patients} onSelectPatient={(p) => setSelectedPatient(p)} />
            } />
            <Route path="/queue" element={<QueuePage queue={queue} />} />
            <Route path="/consultations" element={<ConsultationsPage />} />
            <Route path="/consultation" element={
              <ConsultationPage
                selectedPatient={selectedPatient}
                packetData={packetData}
                consultationForm={consultationForm}
                setConsultationForm={setConsultationForm}
                newMedicine={newMedicine}
                setNewMedicine={setNewMedicine}
                addMedicine={addMedicine}
                removeMedicine={removeMedicine}
                handleSaveConsultation={handleSaveConsultation}
                setSelectedRecord={setSelectedRecord}
              />
            } />
            <Route path="/record-view" element={
              <RecordViewPage packetData={packetData} setSelectedRecord={setSelectedRecord} />
            } />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedRecord && (
          <MediaPreviewModal 
            record={selectedRecord} 
            onClose={() => setSelectedRecord(null)} 
          />
        )}
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
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50">
            <AlertCircle className="w-5 h-5" />
            <p className="font-bold">{scanError}</p>
            <button onClick={() => setScanError(null)} className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-colors"><Plus className="w-4 h-4 rotate-45" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

function PageHeader() {
  const { title, subtitle } = usePageMeta();
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize transition-colors">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl text-gray-400 dark:text-gray-300 hover:text-gray-600 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
        </button>
        <div className="h-10 w-[1px] bg-gray-200 dark:bg-slate-700 mx-2" />
        <NavLink
          to="/consultation"
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Consultation
        </NavLink>
      </div>
    </div>
  );
}
