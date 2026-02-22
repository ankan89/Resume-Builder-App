import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, Eye, Download } from 'lucide-react';
import { AuthContext } from '../App';
import jsPDF from 'jspdf';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const templates = [
  { id: 'modern', name: 'Modern', description: 'Clean and professional' },
  { id: 'classic', name: 'Classic', description: 'Traditional and timeless' },
  { id: 'creative', name: 'Creative', description: 'Stand out from the crowd' },
  { id: 'minimal', name: 'Minimal', description: 'Simple and elegant' }
];

const ResumeBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('modern');
  const [sections, setSections] = useState([
    { type: 'personal', content: { name: '', email: '', phone: '', location: '' } },
    { type: 'summary', content: '' },
    { type: 'experience', content: [] },
    { type: 'education', content: [] },
    { type: 'skills', content: '' }
  ]);

  useEffect(() => {
    if (id) {
      fetchResume();
    } else {
      setTitle(`Resume ${new Date().toLocaleDateString()}`);
      setLoading(false);
    }
  }, [id]);

  const fetchResume = async () => {
    try {
      const response = await axios.get(`${API}/resumes/${id}`);
      setResume(response.data);
      setTitle(response.data.title);
      setTemplate(response.data.template);
      if (response.data.sections && response.data.sections.length > 0) {
        setSections(response.data.sections);
      }
    } catch (error) {
      console.error('Failed to fetch resume:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id) {
        await axios.put(`${API}/resumes/${id}`, { title, template, sections });
      } else {
        const response = await axios.post(`${API}/resumes`, { title, template, sections });
        navigate(`/builder/${response.data.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to save resume:', error);
      alert('Failed to save resume');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (index, newContent) => {
    const newSections = [...sections];
    newSections[index].content = newContent;
    setSections(newSections);
  };

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;

    // Add content to PDF
    const personalInfo = sections.find(s => s.type === 'personal')?.content || {};
    
    // Name (large)
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text(personalInfo.name || 'Your Name', margin, y);
    y += 10;

    // Contact info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const contactLine = [personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean).join(' | ');
    pdf.text(contactLine, margin, y);
    y += 15;

    // Summary
    const summary = sections.find(s => s.type === 'summary')?.content;
    if (summary) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Professional Summary', margin, y);
      y += 7;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const summaryLines = pdf.splitTextToSize(summary, pageWidth - 2 * margin);
      pdf.text(summaryLines, margin, y);
      y += summaryLines.length * 5 + 10;
    }

    // Experience
    const experience = sections.find(s => s.type === 'experience')?.content || [];
    if (experience.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Experience', margin, y);
      y += 7;
      
      experience.forEach((exp) => {
        if (y > 270) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(exp.position || 'Position', margin, y);
        y += 6;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text(`${exp.company || 'Company'} | ${exp.duration || 'Duration'}`, margin, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        if (exp.description) {
          const descLines = pdf.splitTextToSize(exp.description, pageWidth - 2 * margin);
          pdf.text(descLines, margin, y);
          y += descLines.length * 5 + 8;
        }
      });
      y += 5;
    }

    // Skills
    const skills = sections.find(s => s.type === 'skills')?.content;
    if (skills) {
      if (y > 250) {
        pdf.addPage();
        y = margin;
      }
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Skills', margin, y);
      y += 7;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const skillsLines = pdf.splitTextToSize(skills, pageWidth - 2 * margin);
      pdf.text(skillsLines, margin, y);
    }

    pdf.save(`${title}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    );
  }

  const personalInfo = sections.find(s => s.type === 'personal')?.content || {};
  const summary = sections.find(s => s.type === 'summary')?.content || '';
  const experience = sections.find(s => s.type === 'experience')?.content || [];
  const education = sections.find(s => s.type === 'education')?.content || [];
  const skills = sections.find(s => s.type === 'skills')?.content || '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            data-testid="back-to-dashboard-btn"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <button
              data-testid="download-pdf-btn"
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              data-testid="save-resume-btn"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 h-10 px-6 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              data-testid="analyze-resume-btn"
              onClick={() => {
                if (id) navigate(`/ats/${id}`);
                else alert('Please save the resume first');
              }}
              className="flex items-center gap-2 h-10 px-6 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <Eye className="w-4 h-4" />
              Analyze
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Editor Panel */}
          <div className="space-y-6">
            {/* Title */}
            <div className="bg-white rounded-2xl p-6 paper-shadow">
              <label className="block text-sm font-medium text-slate-700 mb-2">Resume Title</label>
              <input
                data-testid="resume-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                placeholder="My Resume"
              />
            </div>

            {/* Template Selection */}
            <div className="bg-white rounded-2xl p-6 paper-shadow">
              <label className="block text-sm font-medium text-slate-700 mb-3">Template</label>
              <div className="grid grid-cols-2 gap-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    data-testid={`template-${t.id}`}
                    onClick={() => setTemplate(t.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      template === t.id
                        ? 'border-blue-700 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-sm text-slate-600">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Personal Info */}
            <div className="bg-white rounded-2xl p-6 paper-shadow">
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Outfit' }}>Personal Information</h3>
              <div className="space-y-3">
                <input
                  data-testid="personal-name-input"
                  type="text"
                  value={personalInfo.name || ''}
                  onChange={(e) => updateSection(0, { ...personalInfo, name: e.target.value })}
                  className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  placeholder="Full Name"
                />
                <input
                  data-testid="personal-email-input"
                  type="email"
                  value={personalInfo.email || ''}
                  onChange={(e) => updateSection(0, { ...personalInfo, email: e.target.value })}
                  className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  placeholder="Email"
                />
                <input
                  data-testid="personal-phone-input"
                  type="tel"
                  value={personalInfo.phone || ''}
                  onChange={(e) => updateSection(0, { ...personalInfo, phone: e.target.value })}
                  className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  placeholder="Phone"
                />
                <input
                  data-testid="personal-location-input"
                  type="text"
                  value={personalInfo.location || ''}
                  onChange={(e) => updateSection(0, { ...personalInfo, location: e.target.value })}
                  className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  placeholder="Location"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl p-6 paper-shadow">
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Outfit' }}>Professional Summary</h3>
              <textarea
                data-testid="summary-textarea"
                value={summary}
                onChange={(e) => updateSection(1, e.target.value)}
                className="w-full h-32 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none"
                placeholder="Brief summary of your professional background..."
              />
            </div>

            {/* Skills */}
            <div className="bg-white rounded-2xl p-6 paper-shadow">
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Outfit' }}>Skills</h3>
              <textarea
                data-testid="skills-textarea"
                value={skills}
                onChange={(e) => updateSection(4, e.target.value)}
                className="w-full h-24 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none"
                placeholder="JavaScript, Python, React, Node.js..."
              />
            </div>

            {/* Ad Space */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center">
              <div className="text-xs text-slate-500 mb-1">Advertisement</div>
              <div className="text-slate-400 text-sm">Google AdSense</div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-slate-200 rounded-2xl p-8">
              <div className="resume-paper" style={{ transform: 'scale(0.7)', transformOrigin: 'top center' }}>
                <div className="space-y-6">
                  {/* Header */}
                  {personalInfo.name && (
                    <div className="text-center border-b-2 border-slate-300 pb-4">
                      <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit' }}>
                        {personalInfo.name}
                      </h1>
                      <div className="text-sm text-slate-600 space-x-2">
                        {personalInfo.email && <span>{personalInfo.email}</span>}
                        {personalInfo.phone && <span>| {personalInfo.phone}</span>}
                        {personalInfo.location && <span>| {personalInfo.location}</span>}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {summary && (
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-2 uppercase tracking-wide" style={{ fontFamily: 'Outfit' }}>Summary</h2>
                      <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {skills && (
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-2 uppercase tracking-wide" style={{ fontFamily: 'Outfit' }}>Skills</h2>
                      <p className="text-sm text-slate-700">{skills}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeBuilder;