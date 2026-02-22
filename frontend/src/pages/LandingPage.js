import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Zap, Target, TrendingUp, Star } from 'lucide-react';
import { AuthContext } from '../App';
import AuthModal from '../components/AuthModal';
import AffiliateLinks from '../components/AffiliateLinks';

const LandingPage = () => {
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  if (user) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="gradient-hero min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="px-6 md:px-12 lg:px-24 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-700" />
            <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit' }}>CareerArchitect</span>
          </div>
          <button
            data-testid="nav-login-btn"
            onClick={() => setShowAuth(true)}
            className="h-10 px-6 rounded-full border border-slate-200 text-slate-900 hover:bg-slate-50 transition-all font-medium"
          >
            Sign In
          </button>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex items-center px-6 md:px-12 lg:px-24 py-20">
          <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6" style={{ fontFamily: 'Outfit' }}>
                BEAT THE BOT.
              </h1>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-8 max-w-xl">
                Build ATS-optimized resumes that get past automated systems and land you interviews. Get instant feedback powered by AI.
              </p>
              <div className="flex gap-4">
                <button
                  data-testid="hero-get-started-btn"
                  onClick={() => setShowAuth(true)}
                  className="btn-primary shadow-lg shadow-blue-700/20"
                >
                  Get Started Free
                </button>
                <button className="h-12 px-8 rounded-full bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-all font-medium">
                  View Templates
                </button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white"></div>
                    <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-white"></div>
                    <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white"></div>
                  </div>
                  <span>Trusted by 10,000+ job seekers</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <img
                src="https://images.unsplash.com/photo-1759156771079-6fef5b8d66c9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjB3b3JraW5nJTIwbGFwdG9wJTIwbW9kZXJuJTIwb2ZmaWNlJTIwbWluaW1hbGlzdCUyMGpvYiUyMGludGVydmlldyUyMHN1Y2Nlc3MlMjByZXN1bWUlMjBkb2N1bWVudCUyMGZsYXRsYXl8ZW58MHx8fHwxNzcxNzQ3MDE4fDA&ixlib=rb-4.1.0&q=85"
                alt="Professional workspace"
                className="rounded-3xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 md:py-32 px-6 md:px-12 lg:px-24 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Why CareerArchitect?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to create a resume that passes ATS systems and impresses hiring managers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-8 rounded-2xl bg-white border border-slate-100 paper-shadow hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-700" />
              </div>
              <h3 className="text-2xl font-medium mb-3" style={{ fontFamily: 'Outfit' }}>Multiple Templates</h3>
              <p className="text-slate-600 leading-relaxed">
                Choose from professionally designed templates optimized for ATS systems.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border border-slate-100 paper-shadow hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-medium mb-3" style={{ fontFamily: 'Outfit' }}>AI-Powered ATS Scoring</h3>
              <p className="text-slate-600 leading-relaxed">
                Get instant feedback on how well your resume matches job descriptions.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border border-slate-100 paper-shadow hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-2xl font-medium mb-3" style={{ fontFamily: 'Outfit' }}>Real-Time Preview</h3>
              <p className="text-slate-600 leading-relaxed">
                See your changes instantly with our live preview editor.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20 md:py-32 px-6 md:px-12 lg:px-24 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              How It Works
            </h2>
          </div>

          <div className="space-y-12">
            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div>
                <h3 className="text-2xl font-medium mb-2" style={{ fontFamily: 'Outfit' }}>Choose a Template</h3>
                <p className="text-slate-600 leading-relaxed">
                  Select from our collection of ATS-friendly templates designed by career experts.
                </p>
              </div>
            </div>

            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div>
                <h3 className="text-2xl font-medium mb-2" style={{ fontFamily: 'Outfit' }}>Build Your Resume</h3>
                <p className="text-slate-600 leading-relaxed">
                  Fill in your information with our intuitive editor and see changes in real-time.
                </p>
              </div>
            </div>

            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div>
                <h3 className="text-2xl font-medium mb-2" style={{ fontFamily: 'Outfit' }}>Get ATS Score</h3>
                <p className="text-slate-600 leading-relaxed">
                  Paste a job description and get instant AI-powered feedback on your resume's compatibility.
                </p>
              </div>
            </div>

            <div className="flex gap-8 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-lg">
                4
              </div>
              <div>
                <h3 className="text-2xl font-medium mb-2" style={{ fontFamily: 'Outfit' }}>Download & Apply</h3>
                <p className="text-slate-600 leading-relaxed">
                  Download your optimized resume as PDF and start applying with confidence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 md:py-32 px-6 md:px-12 lg:px-24 bg-blue-700 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ fontFamily: 'Outfit' }}>
            Ready to Land Your Dream Job?
          </h2>
          <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed">
            Join thousands of job seekers who've improved their resumes and landed more interviews.
          </p>
          <button
            data-testid="cta-get-started-btn"
            onClick={() => setShowAuth(true)}
            className="h-12 px-8 rounded-full bg-white text-blue-700 font-medium hover:bg-blue-50 transition-all shadow-lg"
          >
            Start Building for Free
          </button>
          <p className="mt-4 text-sm text-blue-200">No credit card required • 10 free ATS checks</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <FileText className="w-6 h-6 text-blue-400" />
            <span className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>CareerArchitect</span>
          </div>
          <div className="mb-8">
            <AffiliateLinks layout="horizontal" />
          </div>
          <p className="text-sm text-center">© 2026 CareerArchitect. All rights reserved.</p>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
};

export default LandingPage;