import React, { useState, useEffect } from 'react';
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
  LogOut
} from 'lucide-react';
import { cn, calculateAge, formatDateTime } from './lib/utils';
import { Patient, Consultation, QueueItem, PacketData, Medicine } from './types';
import { useAuth } from './contexts/AuthContext';
import { supabase, patientSupabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Queue</span>
          </button>
          <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-widest">
            Health Packet Verified
          </div>
        </div>

        {/* Patient Identity */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex items-start gap-8">
          <div className="w-24 h-24 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600">
            <Users className="w-10 h-10" />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8">
            <div className="col-span-2">
              <h1 className="text-3xl font-bold text-gray-900">{packet.profile_data.name}</h1>
              <p className="text-gray-500 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {packet.profile_data.dob ? `${calculateAge(packet.profile_data.dob)} years • ${formatDateTime(packet.profile_data.dob)}` : 'Age unknown'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Gender</p>
              <p className="font-semibold text-gray-900">{packet.profile_data.gender}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Blood Group</p>
              <p className="font-semibold text-gray-900 text-red-600">{packet.profile_data.blood_group}</p>
            </div>
          </div>
        </div>

        {/* Medical History */}
        {packet.medical_history.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Medical History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packet.medical_history.map((h, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">{h.question}</p>
                  <p className="text-gray-900">{h.answer || 'No response provided'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Records */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Shared Records ({packet.records.length})
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {packet.records.length > 0 ? packet.records.map((r, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    r.type === 'lab' ? "bg-amber-50 text-amber-600" : 
                    r.type === 'prescription' ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-600"
                  )}>
                    <FileSearch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{r.title}</h3>
                    <p className="text-sm text-gray-500">{r.provider} • {formatDateTime(r.date)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onPreview(r)}
                  className="px-4 py-2 rounded-xl bg-gray-50 text-gray-600 font-bold text-sm hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                >
                  <FileSearch className="w-4 h-4" />
                  View Record
                </button>
              </div>
            )) : (
              <div className="bg-gray-100/50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center text-gray-500">
                No clinical records were shared in this packet.
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
      <div className="bg-white w-full h-full rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{record.title}</h3>
              <p className="text-xs text-gray-500">{record.file_name} • {record.file_type}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6 rotate-90" />
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
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-4">
          <button 
            onClick={() => window.open(record.file_url, '_blank')}
            className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
          >
            Open in New Tab
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const { doctorProfile, signOut } = useAuth();
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'queue', label: 'Queue', icon: Clock },
    { id: 'consultations', label: 'Consultations', icon: History },
  ];

  const initials = doctorProfile?.full_name
    ? doctorProfile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <Stethoscope className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">UniCare</h1>
          <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase">EMR Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Main Menu</p>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              activeTab === item.id 
                ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-gray-400 group-hover:text-gray-600")} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-gray-50 space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
          {doctorProfile?.avatar_url ? (
            <img src={doctorProfile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{doctorProfile?.full_name || 'Doctor'}</p>
            <p className="text-[10px] text-gray-500 truncate">{doctorProfile?.specialty || 'General Physician'}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => (
  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today</span>
    </div>
    <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
    <p className="text-sm text-gray-500 mt-1">{label}</p>
  </div>
);

const QRScanner = ({ onScan }: { onScan: (url: string) => void }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input) onScan(input);
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
          <FileSearch className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import Health Packet</h2>
          <p className="text-sm text-gray-500">Enter the secure health packet URL shared by the patient</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste packet URL here..."
            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 placeholder:text-gray-400"
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

const PrescriptionPDF = (consultation: Consultation, patient: Patient) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(0, 102, 255);
  doc.text('UniCare EMR', 20, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Dr. Aryan Pandey | General Physician', 20, 28);
  doc.text('Reg No: 123456789', 20, 33);
  
  doc.setDrawColor(230);
  doc.line(20, 40, 190, 40);
  
  // Patient Info
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Patient: ${patient.name}`, 20, 50);
  doc.text(`Age/Gender: ${patient.age}Y / ${patient.gender}`, 20, 57);
  doc.text(`Date: ${new Date(consultation.created_at).toLocaleDateString()}`, 140, 50);
  
  // Clinical Notes
  doc.setFontSize(14);
  doc.text('Clinical Findings', 20, 75);
  doc.setFontSize(10);
  doc.text(`Symptoms: ${consultation.symptoms}`, 20, 85);
  doc.text(`Diagnosis: ${consultation.diagnosis}`, 20, 92);
  
  // Prescription
  doc.setFontSize(14);
  doc.text('Prescription', 20, 110);
  
  autoTable(doc, {
    startY: 115,
    head: [['Medicine', 'Dosage', 'Duration']],
    body: consultation.medicines.map(m => [m.name, m.dosage, m.duration]),
    theme: 'striped',
    headStyles: { fillColor: [0, 102, 255] }
  });
  
  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(10);
  doc.text('Notes:', 20, finalY);
  doc.text(consultation.notes, 20, finalY + 7);
  
  doc.text('Digitally Signed by Dr. Aryan Pandey', 120, finalY + 40);
  
  return doc;
};

export default function App() {
  const { user, loading, isConfigured, doctorProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [packetData, setPacketData] = useState<PacketData | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [showSharedData, setShowSharedData] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Consultation Form State
  const [consultationForm, setConsultationForm] = useState({
    symptoms: '',
    diagnosis: '',
    notes: '',
    medicines: [] as Medicine[]
  });
  const [newMedicine, setNewMedicine] = useState({ name: '', dosage: '', duration: '' });

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
        .select(`
          *,
          patient:patients(*)
        `)
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
      // 1. Parse packet ID from URL
      // Example: https://unicare.space/share/packet/cbe5bc29-2e5f-41eb-8e7a-135fb3cbace3
      const packetId = url.split('/').pop();
      if (!packetId || packetId.length < 36) {
        throw new Error("Invalid health packet URL");
      }

      // 2. Fetch packet basics
      const { data: packet, error: packetError } = await patientSupabase
        .from('shared_packets')
        .select('*')
        .eq('id', packetId)
        .single();

      if (packetError || !packet) throw new Error("Health packet not found or inaccessible");

      // Check expiry
      if (packet.expires_at && new Date(packet.expires_at) < new Date()) {
        throw new Error("Health packet has expired");
      }

      // 3. Fetch Profile
      const { data: profile, error: profileError } = await patientSupabase
        .from('profiles')
        .select('*')
        .eq('id', packet.profile_id)
        .single();

      if (profileError || !profile) throw new Error("Patient profile not found");

      // 4. Fetch Medical History (if shared)
      let medicalHistory: any[] = [];
      if (packet.share_medical_history) {
        const { data: history } = await patientSupabase
          .from('medical_history')
          .select('*')
          .eq('profile_id', profile.id);
        medicalHistory = history || [];
      }

      // 5. Fetch Records
      const { data: recordLinks } = await patientSupabase
        .from('shared_packet_records')
        .select('record_id')
        .eq('packet_id', packetId);
      
      let records: any[] = [];
      if (recordLinks && recordLinks.length > 0) {
        const recordIds = recordLinks.map((l: any) => l.record_id);
        const { data: recordsData } = await patientSupabase
          .from('records')
          .select('*')
          .in('id', recordIds);
        records = recordsData || [];
      }

      // 6. Map to local PacketData structure
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
      
      // Look for patient in doctor's project by phone or name (fallback)
      const patientPhone = fetchedPacket.profile_data.phone;
      const patientName = fetchedPacket.profile_data.name;
      
      let patient = patients.find(p => 
        (patientPhone && p.phone === patientPhone) || 
        (!patientPhone && p.name === patientName)
      );
      
      if (!patient) {
        const { data, error } = await supabase
          .from('patients')
          .insert({
            doctor_id: doctorProfile!.id,
            name: patientName,
            age: profile.dob ? calculateAge(profile.dob) : 0,
            gender: fetchedPacket.profile_data.gender,
            phone: patientPhone,
            email: fetchedPacket.profile_data.email,
            abha_id: fetchedPacket.profile_data.abha_id,
            address: fetchedPacket.profile_data.address
          })
          .select()
          .single();
        
        if (error) throw error;
        patient = data as Patient;
        fetchPatients();
      }

      const { error: queueError } = await supabase
        .from('queue')
        .insert({
          doctor_id: doctorProfile!.id,
          patient_id: patient!.id,
          status: 'waiting'
        });

      if (queueError) throw queueError;
      
      fetchQueue();
      setSelectedPatient(patient!);
      setActiveTab('consultation');
    } catch (err: any) {
      setScanError(err.message || "Invalid link or network error");
    } finally {
      setScanLoading(false);
    }
  };

  const handleSaveConsultation = async () => {
    if (!selectedPatient || !doctorProfile) return;
    
    try {
      // 1. Save Consultation
      const { data, error } = await supabase
        .from('consultations')
        .insert({
          doctor_id: doctorProfile.id,
          patient_id: selectedPatient.id,
          symptoms: consultationForm.symptoms,
          diagnosis: consultationForm.diagnosis,
          notes: consultationForm.notes,
          medicines: consultationForm.medicines
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // 2. Update Queue Status for this patient
      await supabase
        .from('queue')
        .update({ status: 'completed' })
        .eq('doctor_id', doctorProfile.id)
        .eq('patient_id', selectedPatient.id)
        .neq('status', 'completed');

      // 3. Generate and save PDF
      const doc = PrescriptionPDF(data as Consultation, selectedPatient);
      doc.save(`Prescription_${selectedPatient.name}_${new Date().toLocaleDateString()}.pdf`);
      
      // 4. Reset State
      setConsultationForm({ symptoms: '', diagnosis: '', notes: '', medicines: [] });
      setSelectedPatient(null);
      setPacketData(null);
      setShowSharedData(false);
      setActiveTab('dashboard');
      
      fetchQueue();
    } catch (err) {
      console.error('Error saving consultation:', err);
    }
  };

  const addMedicine = () => {
    if (newMedicine.name) {
      setConsultationForm(prev => ({
        ...prev,
        medicines: [...prev.medicines, newMedicine]
      }));
      setNewMedicine({ name: '', dosage: '', duration: '' });
    }
  };

  const removeMedicine = (index: number) => {
    setConsultationForm(prev => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="loading-screen bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4, borderColor: '#e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-xl shadow-blue-100/50 border border-blue-50"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Configuration Required</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            UniCare EMR needs your Supabase configuration to function. Please ensure you've added the following environment variables to your deployment or <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600 font-mono text-sm">.env</code> file:
          </p>
          
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <code className="text-sm font-mono text-gray-700">VITE_SUPABASE_URL</code>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <code className="text-sm font-mono text-gray-700">VITE_SUPABASE_ANON_KEY</code>
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
            <Bell className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed font-medium">
              After adding these variables to Vercel, don't forget to <b>redeploy</b> your application for the changes to take effect.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 capitalize">
              {activeTab.replace('-', ' ')}
            </h2>
            <p className="text-sm text-gray-500">
              {activeTab === 'dashboard' ? 'Good morning, Dr. Aryan. Here is your clinic overview.' : 
               activeTab === 'patients' ? 'Manage permanent patient records.' :
               activeTab === 'queue' ? 'Track patients waiting for consultation.' : 
               activeTab === 'record-view' ? 'Reviewing shared clinical documentation.' : 'Complete the clinical record.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-gray-600 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-10 w-[1px] bg-gray-200 mx-2" />
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Consultation
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total Patients" value={patients.length} icon={Users} color="bg-blue-50 text-blue-600" />
                <StatCard label="In Queue" value={queue.filter(q => q.status !== 'completed').length} icon={Clock} color="bg-orange-50 text-orange-600" />
                <StatCard label="Completed" value={queue.filter(q => q.status === 'completed').length} icon={CheckCircle2} color="bg-green-50 text-green-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <QRScanner onScan={handleQRScan} />
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Live Queue</h3>
                    <button onClick={() => setActiveTab('queue')} className="text-sm font-bold text-blue-600 hover:underline">View All</button>
                  </div>
                  <div className="space-y-4">
                    {queue.filter(q => q.status !== 'completed').slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 group hover:bg-blue-50 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-blue-600 font-bold border border-gray-100">
                          {item.patient?.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900">{item.patient?.name}</p>
                          <p className="text-xs text-gray-500">{item.patient?.gender} • {item.patient?.age}Y</p>
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          item.status === 'waiting' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {item.status}
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedPatient(item.patient!);
                            setActiveTab('consultation');
                          }}
                          className="p-2 text-gray-400 group-hover:text-blue-600 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'consultation' && selectedPatient && (
            <motion.div 
              key="consultation"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <button 
                onClick={() => {
                  setSelectedPatient(null);
                  setActiveTab('dashboard');
                }}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 font-bold text-2xl mb-4 border border-blue-100">
                        {selectedPatient.name.charAt(0)}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedPatient.name}</h3>
                      <p className="text-sm text-gray-500">{selectedPatient.gender} • {selectedPatient.age} Years</p>
                    </div>
                    <div className="space-y-4 pt-6 border-t border-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase">Phone</span>
                        <span className="text-sm font-medium text-gray-900">{selectedPatient.phone}</span>
                      </div>
                    </div>
                    {packetData && (
                      <div className="mt-8 pt-8 space-y-4 border-t border-gray-50">
                        <button 
                          onClick={() => setActiveTab('record-view')}
                          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                        >
                          <FileSearch className="w-5 h-5" />
                          Expand Full Records
                        </button>
                        <button 
                          onClick={() => setShowSharedData(!showSharedData)}
                          className="w-full py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold border border-gray-100 hover:bg-gray-100 transition-all"
                        >
                          {showSharedData ? 'Hide Inline Preview' : 'Preview Shared Data'}
                        </button>
                      </div>
                    )}
                  </div>

                  {showSharedData && packetData && (
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                      <div>
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Quick History</h4>
                        <div className="space-y-4">
                          {packetData.medical_history.slice(0, 3).map((item, i) => (
                            <div key={i} className="p-4 bg-gray-50 rounded-2xl">
                              <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">{item.question}</p>
                              <p className="text-sm text-gray-900 font-medium">{item.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-6">Clinical Record</h3>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <textarea 
                          value={consultationForm.symptoms}
                          onChange={(e) => setConsultationForm(prev => ({ ...prev, symptoms: e.target.value }))}
                          placeholder="Symptoms..."
                          className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                        />
                        <textarea 
                          value={consultationForm.diagnosis}
                          onChange={(e) => setConsultationForm(prev => ({ ...prev, diagnosis: e.target.value }))}
                          placeholder="Diagnosis..."
                          className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                        />
                      </div>
                      <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <input 
                            type="text" 
                            placeholder="Medicine"
                            value={newMedicine.name}
                            onChange={(e) => setNewMedicine(prev => ({ ...prev, name: e.target.value }))}
                            className="md:col-span-2 px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm"
                          />
                          <input 
                            type="text" 
                            placeholder="Dosage"
                            value={newMedicine.dosage}
                            onChange={(e) => setNewMedicine(prev => ({ ...prev, dosage: e.target.value }))}
                            className="px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm"
                          />
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Days"
                              value={newMedicine.duration}
                              onChange={(e) => setNewMedicine(prev => ({ ...prev, duration: e.target.value }))}
                              className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm"
                            />
                            <button onClick={addMedicine} className="p-3 bg-blue-600 text-white rounded-xl"><Plus className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {consultationForm.medicines.map((med, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100">
                              <Pill className="w-4 h-4 text-blue-600" />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900">{med.name}</p>
                                <p className="text-[10px] text-gray-500">{med.dosage} • {med.duration}</p>
                              </div>
                              <button onClick={() => removeMedicine(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <textarea 
                        value={consultationForm.notes}
                        onChange={(e) => setConsultationForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional Notes..."
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                      />
                      <div className="pt-6 flex gap-4">
                        <button 
                          onClick={handleSaveConsultation}
                          className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Complete Consultation & Print
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'patients' && (
            <motion.div key="patients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Patient</th>
                    <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Age/Gender</th>
                    <th className="text-left py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Contact</th>
                    <th className="text-right py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 font-bold text-gray-900">{patient.name}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{patient.age}Y / {patient.gender}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{patient.phone}</td>
                      <td className="py-4 px-4 text-right">
                        <button onClick={() => { setSelectedPatient(patient); setActiveTab('consultation'); }} className="p-2 text-gray-400 hover:text-blue-600"><FileText className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {activeTab === 'queue' && (
            <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['waiting', 'in-consultation', 'completed'].map((status) => (
                <div key={status} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 capitalize mb-6">{status}</h3>
                  <div className="space-y-4">
                    {queue.filter(q => q.status === status).map((item) => (
                      <div key={item.id} className="p-4 rounded-2xl bg-gray-50">
                        <p className="text-sm font-bold text-gray-900">{item.patient?.name}</p>
                        <p className="text-[10px] text-gray-500">{item.patient?.gender} • {item.patient?.age}Y</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'record-view' && packetData && (
            <motion.div 
              key="record-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <PatientRecordView 
                packet={packetData} 
                onClose={() => setActiveTab('consultation')}
                onPreview={(r) => setSelectedRecord(r)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {scanLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="font-bold text-gray-900">Retrieving Secure Health Packet...</p>
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
