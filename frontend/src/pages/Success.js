import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Crown, Loader } from 'lucide-react';
import { AuthContext } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Success = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useContext(AuthContext);
  const [status, setStatus] = useState('checking');
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 5;

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  const pollPaymentStatus = async (sessionId, attempt = 0) => {
    if (attempt >= maxAttempts) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(`${API}/payments/status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        await refreshUser();
      } else if (response.data.status === 'expired') {
        setStatus('error');
      } else {
        setAttempts(attempt + 1);
        setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), 2000);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {status === 'checking' && (
          <div className="bg-white rounded-3xl p-12 text-center paper-shadow">
            <Loader className="w-16 h-16 text-blue-700 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Outfit' }}>
              Processing Payment
            </h2>
            <p className="text-slate-600">
              Please wait while we confirm your payment...
            </p>
            <p className="text-sm text-slate-500 mt-4">
              Attempt {attempts + 1} of {maxAttempts}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white rounded-3xl p-12 text-center paper-shadow">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Outfit' }}>
              Welcome to Premium!
            </h2>
            <p className="text-slate-600 mb-8">
              Your payment was successful. You now have unlimited ATS checks and premium features.
            </p>
            <div className="bg-blue-50 rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="w-6 h-6 text-blue-700" />
                <span className="font-bold text-blue-900" style={{ fontFamily: 'Outfit' }}>Premium Features Unlocked</span>
              </div>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Unlimited ATS checks</li>
                <li>✓ Priority support</li>
                <li>✓ No advertisements</li>
              </ul>
            </div>
            <button
              data-testid="go-to-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              className="btn-primary w-full"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-3xl p-12 text-center paper-shadow">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">❌</span>
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Outfit' }}>
              Payment Failed
            </h2>
            <p className="text-slate-600 mb-8">
              There was an issue processing your payment. Please try again.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="btn-primary w-full"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'timeout' && (
          <div className="bg-white rounded-3xl p-12 text-center paper-shadow">
            <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⏱️</span>
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Outfit' }}>
              Taking Longer Than Expected
            </h2>
            <p className="text-slate-600 mb-8">
              We're still processing your payment. Please check your email for confirmation or contact support.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary w-full"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Success;