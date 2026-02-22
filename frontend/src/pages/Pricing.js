import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Check, Crown, Zap } from 'lucide-react';
import { AuthContext } from '../App';
import AdSense from '../components/AdSense';
import AffiliateLinks from '../components/AffiliateLinks';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/payments/checkout`);
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Payment initiation failed:', error);
      alert('Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            data-testid="back-to-dashboard-btn"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
            Choose Your Plan
          </h1>
          <p className="text-lg text-slate-600">
            Unlock unlimited ATS checks and priority support
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-3xl p-8 paper-shadow border border-slate-200">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Outfit' }}>Free</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold" style={{ fontFamily: 'Outfit' }}>$0</span>
                <span className="text-slate-600">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">All professional templates</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">10 ATS checks per month</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">Real-time preview</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">PDF download</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full h-12 px-6 rounded-full border-2 border-slate-200 text-slate-400 font-medium cursor-not-allowed"
            >
              Current Plan
            </button>
          </div>

          {/* Premium Plan */}
          <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <div className="bg-yellow-400 text-blue-900 px-3 py-1 rounded-full text-xs font-bold uppercase">
                Popular
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-6 h-6" />
                <h3 className="text-2xl font-bold" style={{ fontFamily: 'Outfit' }}>Premium</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold" style={{ fontFamily: 'Outfit' }}>$19.99</span>
                <span className="text-blue-200">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-white">Everything in Free</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span className="text-white font-medium">Unlimited ATS checks</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-white">Priority support</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-white">Advanced AI analysis</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-white">No ads</span>
              </li>
            </ul>

            {user?.is_premium ? (
              <button
                disabled
                className="w-full h-12 px-6 rounded-full bg-white/20 text-white font-medium cursor-not-allowed"
              >
                Active Subscription
              </button>
            ) : (
              <button
                data-testid="upgrade-to-premium-btn"
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full h-12 px-6 rounded-full bg-white text-blue-700 font-medium hover:bg-blue-50 transition-all shadow-lg disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Upgrade to Premium'}
              </button>
            )}
          </div>
        </div>

        {/* Ad Space */}
        {!user?.is_premium && (
          <div className="mt-12">
            <AdSense slot="pricing-ad" className="rounded-2xl overflow-hidden" />
          </div>
        )}

        {/* Affiliate Links */}
        <div className="mt-8">
          <AffiliateLinks layout="horizontal" />
        </div>
      </div>
    </div>
  );
};

export default Pricing;