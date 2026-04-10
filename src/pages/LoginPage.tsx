import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Stethoscope, Shield, Zap, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const features = [
  { icon: Shield, label: 'HIPAA-Compliant', desc: 'All patient data is encrypted and secure' },
  { icon: Zap,    label: 'Instant Access',  desc: 'Smart QR-based patient data retrieval' },
  { icon: Lock,   label: 'Private & Safe',  desc: 'Your data never leaves your clinic' },
];

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* ── Animated gradient orbs ── */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* ── Grid overlay ── */}
      <div className="grid-overlay" />

      <div className="login-layout">
        {/* ── LEFT PANEL ── */}
        <motion.div
          className="left-panel"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {/* Logo */}
          <div className="brand">
            <div className="brand-icon">
              <Stethoscope size={28} />
            </div>
            <div>
              <h1 className="brand-name">UniCare</h1>
              <p className="brand-sub">EMR Portal</p>
            </div>
          </div>

          {/* Hero copy */}
          <div className="hero-copy">
            <motion.h2
              className="hero-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              The Modern<br />
              <span className="hero-highlight">Doctor's Workspace</span>
            </motion.h2>
            <motion.p
              className="hero-desc"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
            >
              Manage patients, consultations & prescriptions with a single, elegant interface built for Indian clinics.
            </motion.p>
          </div>

          {/* Feature pills */}
          <motion.div
            className="feature-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="feature-item">
                <div className="feature-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="feature-label">{label}</p>
                  <p className="feature-desc">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── RIGHT PANEL (card) ── */}
        <motion.div
          className="right-panel"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="login-card">
            {/* Card header */}
            <div className="card-header">
              <div className="card-icon">
                <Stethoscope size={22} />
              </div>
              <h3 className="card-title">Welcome Back, Doctor</h3>
              <p className="card-subtitle">Sign in to access your EMR dashboard</p>
            </div>

            {/* Divider */}
            <div className="divider">
              <span>Continue with</span>
            </div>

            {/* Google button */}
            <motion.button
              id="google-signin-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="google-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <svg className="google-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span>{loading ? 'Redirecting...' : 'Sign in with Google'}</span>
            </motion.button>

            {/* Error */}
            {error && (
              <motion.div
                className="error-box"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}

            {/* Footer note */}
            <p className="card-note">
              By signing in, you agree to UniCare's{' '}
              <a href="#" className="card-link">Terms of Service</a> and{' '}
              <a href="#" className="card-link">Privacy Policy</a>.
            </p>
          </div>

          {/* Trust badges */}
          <div className="trust-badges">
            <span className="badge">🔒 256-bit SSL</span>
            <span className="badge">✅ DPDP Compliant</span>
            <span className="badge">🏥 Clinic-Grade Security</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
