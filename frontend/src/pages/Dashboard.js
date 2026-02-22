import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileText, Plus, Target, LogOut, Crown, TrendingUp } from 'lucide-react';
import { AuthContext } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [resumes, setResumes] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resumesRes, analysesRes] = await Promise.all([
        axios.get(`${API}/resumes`),
        axios.get(`${API}/ats/analyses`)
      ]);
      setResumes(resumesRes.data);
      setAnalyses(analysesRes.data);
      await refreshUser();
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewResume = async () => {
    try {
      const response = await axios.post(`${API}/resumes`, {
        title: `Resume ${resumes.length + 1}`,
        template: 'modern',
        sections: []
      });
      navigate(`/builder/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create resume:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    );
  }

  const checksRemaining = user?.is_premium ? '∞' : (user?.ats_checks_limit - user?.ats_checks_used) || 0;
  const averageScore = analyses.length > 0 
    ? Math.round(analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-700" />
            <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit' }}>CareerArchitect</span>
          </div>
          <div className="flex items-center gap-4">
            {!user?.is_premium && (
              <button
                data-testid="nav-upgrade-btn"
                onClick={() => navigate('/pricing')}
                className="flex items-center gap-2 h-10 px-4 rounded-full bg-gradient-to-r from-blue-700 to-blue-800 text-white font-medium hover:from-blue-800 hover:to-blue-900 transition-all"
              >
                <Crown className="w-4 h-4" />
                Upgrade to Pro
              </button>
            )}
            <button
              data-testid="nav-logout-btn"
              onClick={logout}
              className="flex items-center gap-2 h-10 px-4 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Outfit' }}>
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-lg text-slate-600">Let's continue building your perfect resume.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl paper-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 uppercase tracking-wider">Resumes</span>
              <FileText className="w-5 h-5 text-blue-700" />
            </div>
            <div className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{resumes.length}</div>
          </div>

          <div className="bg-white p-6 rounded-2xl paper-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 uppercase tracking-wider">ATS Checks Left</span>
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{checksRemaining}</div>
          </div>

          <div className="bg-white p-6 rounded-2xl paper-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 uppercase tracking-wider">Avg ATS Score</span>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{averageScore}</div>
          </div>
        </div>

        {/* Ad Space (Google AdSense Placeholder) */}
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-8 mb-12 text-center">
          <div className="text-sm text-slate-500 mb-2">Advertisement</div>
          <div className="text-slate-400">Google AdSense Placement</div>
        </div>

        {/* Resumes Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold" style={{ fontFamily: 'Outfit' }}>My Resumes</h2>
            <button
              data-testid="create-resume-btn"
              onClick={createNewResume}
              className="flex items-center gap-2 h-12 px-6 rounded-full bg-blue-700 text-white font-medium hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20"
            >
              <Plus className="w-5 h-5" />
              New Resume
            </button>
          </div>

          {resumes.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center paper-shadow">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-slate-900 mb-2">No resumes yet</h3>
              <p className="text-slate-600 mb-6">Create your first resume to get started</p>
              <button
                data-testid="empty-state-create-btn"
                onClick={createNewResume}
                className="btn-primary"
              >
                Create Resume
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  data-testid={`resume-card-${resume.id}`}
                  className="bg-white rounded-2xl p-6 paper-shadow hover:-translate-y-1 transition-transform cursor-pointer"
                  onClick={() => navigate(`/builder/${resume.id}`)}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{resume.title}</h3>
                      <p className="text-sm text-slate-500 capitalize">{resume.template} template</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-testid={`edit-resume-${resume.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/builder/${resume.id}`);
                      }}
                      className="flex-1 h-9 px-4 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      data-testid={`analyze-resume-${resume.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/ats/${resume.id}`);
                      }}
                      className="flex-1 h-9 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all"
                    >
                      Analyze
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent ATS Analyses */}
        {analyses.length > 0 && (
          <div>
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Outfit' }}>Recent ATS Analyses</h2>
            <div className="space-y-4">
              {analyses.slice(0, 5).map((analysis) => (
                <div key={analysis.id} className="bg-white rounded-2xl p-6 paper-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`text-3xl font-bold ${
                          analysis.score >= 80 ? 'text-green-600' :
                          analysis.score >= 60 ? 'text-orange-500' :
                          'text-red-600'
                        }`} style={{ fontFamily: 'Outfit' }}>
                          {analysis.score}
                        </div>
                        <div>
                          <div className="text-sm text-slate-500">
                            {new Date(analysis.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm line-clamp-2">{analysis.feedback}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/ats/${analysis.resume_id}`)}
                      className="h-10 px-6 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;