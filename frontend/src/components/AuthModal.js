import React, { useState, useContext } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { AuthContext } from '../App';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const AuthModal = ({ onClose }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'register') {
        if (!fullName) {
          setError('Please enter your full name');
          setLoading(false);
          return;
        }
        await register(email, password, fullName);
        onClose();
      } else if (mode === 'reset') {
        await axios.post(`${API}/api/auth/reset-password`, { email, new_password: password });
        setSuccess('Password reset! You can now sign in.');
        setTimeout(() => {
          setMode('login');
          setSuccess('');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Get Started' : 'Reset Password';
  const submitLabel = mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Reset Password';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold" style={{ fontFamily: 'Outfit' }}>
            {title}
          </h2>
          <button
            data-testid="close-auth-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'reset' && (
          <p className="text-sm text-slate-500 mb-4">
            Enter your email and a new password to reset your account.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name
              </label>
              <input
                data-testid="auth-fullname-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                placeholder="John Doe"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              data-testid="auth-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {mode === 'reset' ? 'New Password' : 'Password'}
            </label>
            <input
              data-testid="auth-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div data-testid="auth-error" className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm">
              {success}
            </div>
          )}

          <button
            data-testid="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : submitLabel}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {mode === 'login' && (
            <button
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Forgot your password?
            </button>
          )}
          <div>
            <button
              data-testid="auth-toggle-btn"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
                setSuccess('');
              }}
              className="text-blue-700 hover:text-blue-800 font-medium"
            >
              {mode === 'register'
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs text-center text-slate-500">
          {mode === 'login' ? 'Welcome back! Sign in to continue.'
            : mode === 'register' ? 'Sign up for free. No credit card required.'
            : 'Enter your email and new password to reset.'}
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
