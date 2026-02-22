import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Zap, TrendingUp, AlertCircle, CheckCircle, Crown } from 'lucide-react';
import { AuthContext } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ATSAnalysis = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useContext(AuthContext);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(resumeId || '');
  const [jobDescription, setJobDescription] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const response = await axios.get(`${API}/resumes`);
      setResumes(response.data);
      if (resumeId) {
        setSelectedResumeId(resumeId);
      } else if (response.data.length > 0) {
        setSelectedResumeId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch resumes:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedResumeId) {
      setError('Please select a resume');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }

    // Check limits
    if (!user?.is_premium && user?.ats_checks_used >= user?.ats_checks_limit) {
      setError('You\'ve reached your free ATS check limit. Upgrade to Premium for unlimited checks!');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await axios.post(`${API}/ats/analyze`, {
        resume_id: selectedResumeId,
        job_description: jobDescription
      });
      setAnalysis(response.data);
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checksRemaining = user?.is_premium ? '∞' : (user?.ats_checks_limit - user?.ats_checks_used) || 0;

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
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600">
              <span className="font-medium">Checks Remaining:</span> {checksRemaining}
            </div>
            {!user?.is_premium && (
              <button
                data-testid="upgrade-to-premium-btn"
                onClick={() => navigate('/pricing')}
                className="flex items-center gap-2 h-10 px-4 rounded-full bg-gradient-to-r from-blue-700 to-blue-800 text-white font-medium hover:from-blue-800 hover:to-blue-900 transition-all"
              >
                <Crown className="w-4 h-4" />
                Upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Outfit' }}>
            ATS Score Analysis
          </h1>
          <p className="text-lg text-slate-600">
            Get AI-powered feedback on how well your resume matches job descriptions.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 paper-shadow">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Select Resume
              </label>
              <select
                data-testid="select-resume-dropdown"
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
              >
                <option value="">Choose a resume...</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl p-6 paper-shadow">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Job Description
              </label>
              <textarea
                data-testid="job-description-textarea"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full h-64 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none"
                placeholder="Paste the full job description here...\n\nInclude:\n- Required qualifications\n- Responsibilities\n- Skills and experience\n- Company culture"
              />
            </div>

            {error && (
              <div data-testid="analysis-error" className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              data-testid="analyze-button"
              onClick={handleAnalyze}
              disabled={loading || !selectedResumeId || !jobDescription.trim()}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              {loading ? 'Analyzing...' : 'Analyze Resume'}
            </button>

            {/* Ad Space */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center">
              <div className="text-xs text-slate-500 mb-1">Advertisement</div>
              <div className="text-slate-400 text-sm">Google AdSense</div>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            {loading && (
              <div className="bg-white rounded-2xl p-12 paper-shadow text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-700 mx-auto mb-4"></div>
                <p className="text-slate-600">Analyzing your resume with AI...</p>
              </div>
            )}

            {analysis && !loading && (
              <div className="space-y-6">
                {/* Score Card */}
                <div className="bg-white rounded-2xl p-8 paper-shadow text-center">
                  <div className="mb-4">
                    <div
                      className={`text-7xl font-bold ${
                        analysis.score >= 80 ? 'text-green-600' :
                        analysis.score >= 60 ? 'text-orange-500' :
                        'text-red-600'
                      }`}
                      style={{ fontFamily: 'Outfit' }}
                      data-testid="ats-score-display"
                    >
                      {analysis.score}
                    </div>
                    <div className="text-slate-600 text-lg">ATS Compatibility Score</div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        analysis.score >= 80 ? 'bg-gradient-to-r from-green-400 to-emerald-600' :
                        analysis.score >= 60 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                        'bg-gradient-to-r from-orange-400 to-red-600'
                      }`}
                      style={{ width: `${analysis.score}%` }}
                    ></div>
                  </div>
                </div>

                {/* Feedback */}
                <div className="bg-white rounded-2xl p-6 paper-shadow">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                    <TrendingUp className="w-6 h-6 text-blue-700" />
                    Overall Feedback
                  </h3>
                  <p className="text-slate-700 leading-relaxed" data-testid="ats-feedback">{analysis.feedback}</p>
                </div>

                {/* Strengths */}
                {analysis.strengths && analysis.strengths.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 paper-shadow">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {analysis.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0"></div>
                          <span className="text-slate-700">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improvements */}
                {analysis.improvements && analysis.improvements.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 paper-shadow">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                      <AlertCircle className="w-6 h-6 text-orange-500" />
                      Suggestions for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {analysis.improvements.map((improvement, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
                          <span className="text-slate-700">{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/builder/${selectedResumeId}`)}
                  className="w-full h-12 px-6 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800 transition-all"
                >
                  Edit Resume
                </button>
              </div>
            )}

            {!analysis && !loading && (
              <div className="bg-white rounded-2xl p-12 paper-shadow text-center">
                <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-900 mb-2">No Analysis Yet</h3>
                <p className="text-slate-600">
                  Select a resume, paste a job description, and click 'Analyze Resume' to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ATSAnalysis;