import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Zap, Check, Loader2, FileText, Target, Plus, Trash2, ChevronDown, RefreshCw } from 'lucide-react';
import { AuthContext } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MAX_PROFILES = 5;

const TEMPLATES = [
  { value: 'modern', label: 'Modern' },
  { value: 'classic', label: 'Classic' },
  { value: 'creative', label: 'Creative' },
  { value: 'minimal', label: 'Minimal' },
];

const emptyExperience = () => ({
  id: Date.now() + Math.random(),
  position: '',
  company: '',
  duration: '',
  description: '',
});

const emptyEducation = () => ({
  id: Date.now() + Math.random(),
  degree: '',
  institution: '',
  year: '',
  details: '',
});

export default function BatchGenerate() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 state
  const [personalInfo, setPersonalInfo] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    location: '',
  });
  const [summaryBase, setSummaryBase] = useState('');
  const [experiences, setExperiences] = useState([emptyExperience()]);
  const [educations, setEducations] = useState([emptyEducation()]);
  const [skillsBase, setSkillsBase] = useState('');

  // Step 2 state
  const [jobProfiles, setJobProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState([]);
  const [template, setTemplate] = useState('modern');

  // Step 3 state
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);
  const [profileStatuses, setProfileStatuses] = useState({});
  const [results, setResults] = useState([]);
  const [generationStats, setGenerationStats] = useState(null);
  const [generationError, setGenerationError] = useState('');

  // Fetch profiles when moving to step 2
  useEffect(() => {
    if (step === 2) {
      fetchJobProfiles();
    }
  }, [step]);

  const fetchJobProfiles = async () => {
    setProfilesLoading(true);
    setProfilesError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/resumes/job-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobProfiles(res.data || []);
    } catch (err) {
      setProfilesError('Failed to load job profiles. Please try again.');
    } finally {
      setProfilesLoading(false);
    }
  };

  // ── Step 1 handlers ──────────────────────────────────────────────────────────

  const handlePersonalInfoChange = (field, value) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));
  };

  // Experience
  const addExperience = () => setExperiences((prev) => [...prev, emptyExperience()]);
  const removeExperience = (id) =>
    setExperiences((prev) => prev.filter((e) => e.id !== id));
  const updateExperience = (id, field, value) =>
    setExperiences((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );

  // Education
  const addEducation = () => setEducations((prev) => [...prev, emptyEducation()]);
  const removeEducation = (id) =>
    setEducations((prev) => prev.filter((e) => e.id !== id));
  const updateEducation = (id, field, value) =>
    setEducations((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );

  // ── Step 2 handlers ──────────────────────────────────────────────────────────

  const toggleProfile = (profileId) => {
    setSelectedProfiles((prev) => {
      if (prev.includes(profileId)) {
        return prev.filter((id) => id !== profileId);
      }
      if (prev.length >= MAX_PROFILES) return prev;
      return [...prev, profileId];
    });
  };

  // ── Step 3 generation ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerationStarted(true);
    setGenerationLoading(true);
    setGenerationError('');
    setGenerationStats(null);
    setResults([]);

    // Initialise spinner statuses for each selected profile
    const initialStatuses = {};
    selectedProfiles.forEach((id) => {
      initialStatuses[id] = 'loading';
    });
    setProfileStatuses(initialStatuses);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        personal_info: {
          name: personalInfo.name,
          email: personalInfo.email,
          phone: personalInfo.phone,
          location: personalInfo.location,
        },
        summary_base: summaryBase,
        experience: experiences.map(({ position, company, duration, description }) => ({
          position,
          company,
          duration,
          description,
        })),
        education: educations.map(({ degree, institution, year, details }) => ({
          degree,
          institution,
          year,
          details,
        })),
        skills_base: skillsBase,
        job_profiles: selectedProfiles,
        template,
      };

      const res = await axios.post(`${API}/resumes/batch-generate`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { resumes = [], generation_stats } = res.data;

      // Mark each profile as success or failed based on stats
      const failedSet = new Set(generation_stats?.failed_profiles || []);
      const updatedStatuses = { ...initialStatuses };

      resumes.forEach((resume) => {
        const profileId = resume.job_profile;
        if (profileId) updatedStatuses[profileId] = 'success';
      });

      // Mark failed ones
      failedSet.forEach((profileId) => {
        updatedStatuses[profileId] = 'failed';
      });

      // Any that are still loading and not in resumes or failed should be failed
      selectedProfiles.forEach((id) => {
        if (updatedStatuses[id] === 'loading') updatedStatuses[id] = 'failed';
      });

      setProfileStatuses(updatedStatuses);
      setResults(resumes);
      setGenerationStats(generation_stats);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Batch generation failed. Please try again.';
      setGenerationError(msg);

      // Mark all as failed
      const failedStatuses = {};
      selectedProfiles.forEach((id) => {
        failedStatuses[id] = 'failed';
      });
      setProfileStatuses(failedStatuses);
    } finally {
      setGenerationLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    const failedIds = Object.entries(profileStatuses)
      .filter(([, status]) => status === 'failed')
      .map(([id]) => id);

    if (failedIds.length === 0) return;

    // Mark failed profiles as loading
    setProfileStatuses((prev) => {
      const updated = { ...prev };
      failedIds.forEach((id) => { updated[id] = 'loading'; });
      return updated;
    });
    setGenerationLoading(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        personal_info: {
          name: personalInfo.name,
          email: personalInfo.email,
          phone: personalInfo.phone,
          location: personalInfo.location,
        },
        summary_base: summaryBase,
        experience: experiences.map(({ position, company, duration, description }) => ({
          position,
          company,
          duration,
          description,
        })),
        education: educations.map(({ degree, institution, year, details }) => ({
          degree,
          institution,
          year,
          details,
        })),
        skills_base: skillsBase,
        job_profiles: failedIds,
        template,
      };

      const res = await axios.post(`${API}/resumes/batch-generate`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { resumes = [], generation_stats } = res.data;

      const failedSet = new Set(generation_stats?.failed_profiles || []);
      setProfileStatuses((prev) => {
        const updated = { ...prev };
        resumes.forEach((resume) => {
          if (resume.job_profile) updated[resume.job_profile] = 'success';
        });
        failedSet.forEach((id) => { updated[id] = 'failed'; });
        failedIds.forEach((id) => {
          if (updated[id] === 'loading') updated[id] = 'failed';
        });
        return updated;
      });
      setResults((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newResumes = resumes.filter((r) => !existingIds.has(r.id));
        return [...prev, ...newResumes];
      });
      setGenerationStats(generation_stats);
    } catch (err) {
      setProfileStatuses((prev) => {
        const updated = { ...prev };
        failedIds.forEach((id) => { updated[id] = 'failed'; });
        return updated;
      });
    } finally {
      setGenerationLoading(false);
    }
  };

  // Trigger generation when entering step 3 for the first time
  useEffect(() => {
    if (step === 3 && !generationStarted) {
      handleGenerate();
    }
  }, [step]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const goToStep2 = () => setStep(2);
  const goToStep1 = () => setStep(1);
  const goToStep3 = () => setStep(3);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getProfileById = (id) => jobProfiles.find((p) => p.id === id || p._id === id);

  const getProfileStatusIcon = (profileId) => {
    const status = profileStatuses[profileId];
    if (status === 'loading') return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    if (status === 'success') return <Check className="w-5 h-5 text-emerald-500" />;
    if (status === 'failed') return <span className="text-red-500 text-xs font-semibold">Failed</span>;
    return null;
  };

  // ── Shared input classes ─────────────────────────────────────────────────────

  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

  // ── Step progress indicator ──────────────────────────────────────────────────

  const steps = [
    { num: 1, label: 'Base Information' },
    { num: 2, label: 'Job Profiles' },
    { num: 3, label: 'Generate' },
  ];

  return (
    <div className="min-h-screen bg-slate-50" data-testid="batch-generate-page">
      {/* Top nav */}
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-blue-700 text-sm font-medium transition"
            data-testid="back-to-dashboard-link"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-semibold text-sm">Batch Generate</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold text-slate-800 mb-2"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            Batch Resume Generator
          </h1>
          <p className="text-slate-500 text-sm">
            Generate multiple tailored resumes in one click.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-10" data-testid="step-indicator">
          {steps.map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    step === s.num
                      ? 'bg-blue-700 text-white shadow-md'
                      : step > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white border-2 border-slate-200 text-slate-400'
                  }`}
                >
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium ${
                    step === s.num ? 'text-blue-700' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-20 h-0.5 mx-1 mb-5 transition ${
                    step > s.num ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1 ─────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div data-testid="step-1">
            {/* Personal Info */}
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-5">
              <h2
                className="text-lg font-bold text-slate-800 mb-4"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Personal Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Jane Doe"
                    value={personalInfo.name}
                    onChange={(e) => handlePersonalInfoChange('name', e.target.value)}
                    data-testid="input-name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="jane@example.com"
                    value={personalInfo.email}
                    onChange={(e) => handlePersonalInfoChange('email', e.target.value)}
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="+1 555 000 0000"
                    value={personalInfo.phone}
                    onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <label className={labelCls}>Location</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="New York, NY"
                    value={personalInfo.location}
                    onChange={(e) => handlePersonalInfoChange('location', e.target.value)}
                    data-testid="input-location"
                  />
                </div>
              </div>
            </div>

            {/* Professional Summary */}
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-5">
              <h2
                className="text-lg font-bold text-slate-800 mb-4"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Professional Summary
              </h2>
              <textarea
                className={`${inputCls} min-h-[100px] resize-y`}
                placeholder="Write a brief professional summary..."
                value={summaryBase}
                onChange={(e) => setSummaryBase(e.target.value)}
                data-testid="input-summary"
              />
            </div>

            {/* Experience */}
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-bold text-slate-800"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Experience
                </h2>
                <button
                  onClick={addExperience}
                  className="flex items-center gap-1.5 text-blue-700 hover:text-blue-800 text-sm font-semibold transition"
                  data-testid="add-experience-btn"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              <div className="space-y-5" data-testid="experience-list">
                {experiences.map((exp, idx) => (
                  <div
                    key={exp.id}
                    className="border border-slate-100 rounded-xl p-4 relative"
                    data-testid={`experience-entry-${idx}`}
                  >
                    {experiences.length > 1 && (
                      <button
                        onClick={() => removeExperience(exp.id)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-red-400 transition"
                        data-testid={`remove-experience-${idx}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className={labelCls}>Position</label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="Software Engineer"
                          value={exp.position}
                          onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Company</label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="Acme Corp"
                          value={exp.company}
                          onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Duration</label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="Jan 2022 – Present"
                          value={exp.duration}
                          onChange={(e) => updateExperience(exp.id, 'duration', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <textarea
                        className={`${inputCls} min-h-[80px] resize-y`}
                        placeholder="Key responsibilities and achievements..."
                        value={exp.description}
                        onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-bold text-slate-800"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Education
                </h2>
                <button
                  onClick={addEducation}
                  className="flex items-center gap-1.5 text-blue-700 hover:text-blue-800 text-sm font-semibold transition"
                  data-testid="add-education-btn"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              <div className="space-y-5" data-testid="education-list">
                {educations.map((edu, idx) => (
                  <div
                    key={edu.id}
                    className="border border-slate-100 rounded-xl p-4 relative"
                    data-testid={`education-entry-${idx}`}
                  >
                    {educations.length > 1 && (
                      <button
                        onClick={() => removeEducation(edu.id)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-red-400 transition"
                        data-testid={`remove-education-${idx}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className={labelCls}>Degree</label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="B.S. Computer Science"
                          value={edu.degree}
                          onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Institution</label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="State University"
                          value={edu.institution}
                          onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Year</label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="2020"
                          value={edu.year}
                          onChange={(e) => updateEducation(edu.id, 'year', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Details</label>
                      <textarea
                        className={`${inputCls} min-h-[60px] resize-y`}
                        placeholder="GPA, honours, relevant coursework..."
                        value={edu.details}
                        onChange={(e) => updateEducation(edu.id, 'details', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-7">
              <h2
                className="text-lg font-bold text-slate-800 mb-4"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Skills
              </h2>
              <textarea
                className={`${inputCls} min-h-[80px] resize-y`}
                placeholder="Python, React, SQL, Project Management..."
                value={skillsBase}
                onChange={(e) => setSkillsBase(e.target.value)}
                data-testid="input-skills"
              />
            </div>

            {/* Step 1 action */}
            <div className="flex justify-end">
              <button
                onClick={goToStep2}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-xl transition shadow"
                data-testid="step1-next-btn"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div data-testid="step-2">
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-5">
              <div className="flex items-center justify-between mb-1">
                <h2
                  className="text-lg font-bold text-slate-800"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Select Job Profiles
                </h2>
                <span
                  className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full"
                  data-testid="profile-counter"
                >
                  {selectedProfiles.length} of {MAX_PROFILES} selected
                </span>
              </div>
              <p className="text-slate-400 text-xs mb-5">
                Choose up to {MAX_PROFILES} job profiles to generate resumes for.
              </p>

              {profilesLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="profiles-loading">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="border-2 border-slate-100 rounded-xl p-4 animate-pulse">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="w-5 h-5 rounded border-2 border-slate-200 flex-shrink-0"></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <div className="h-5 bg-slate-100 rounded-full w-16"></div>
                        <div className="h-5 bg-slate-100 rounded-full w-20"></div>
                        <div className="h-5 bg-slate-100 rounded-full w-14"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {profilesError && !profilesLoading && (
                <div
                  className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4"
                  data-testid="profiles-error"
                >
                  {profilesError}
                  <button
                    className="ml-3 underline font-semibold hover:text-red-800"
                    onClick={fetchJobProfiles}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!profilesLoading && !profilesError && jobProfiles.length === 0 && (
                <div
                  className="text-center py-12 text-slate-400 text-sm"
                  data-testid="profiles-empty"
                >
                  No job profiles found. Create some job profiles first.
                </div>
              )}

              {!profilesLoading && jobProfiles.length > 0 && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-testid="profiles-grid"
                >
                  {jobProfiles.map((profile) => {
                    const profileId = profile.id || profile._id;
                    const isSelected = selectedProfiles.includes(profileId);
                    const isDisabled = !isSelected && selectedProfiles.length >= MAX_PROFILES;

                    return (
                      <button
                        key={profileId}
                        onClick={() => !isDisabled && toggleProfile(profileId)}
                        disabled={isDisabled}
                        className={`text-left border-2 rounded-xl p-4 transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 shadow-sm'
                            : isDisabled
                            ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer'
                        }`}
                        data-testid={`profile-card-${profileId}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-800 text-sm leading-snug">
                            {profile.title || profile.name || 'Untitled Profile'}
                          </span>
                          <div
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>

                        {/* Keyword tags */}
                        {profile.keywords && profile.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {profile.keywords.slice(0, 5).map((kw, i) => (
                              <span
                                key={i}
                                className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium"
                              >
                                {kw}
                              </span>
                            ))}
                            {profile.keywords.length > 5 && (
                              <span className="text-xs text-slate-400 px-1 py-0.5">
                                +{profile.keywords.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Template Selector */}
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-7">
              <h2
                className="text-lg font-bold text-slate-800 mb-4"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Resume Template
              </h2>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none pr-9`}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  data-testid="template-select"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Step 2 actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={goToStep1}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                data-testid="step2-back-btn"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={goToStep3}
                disabled={selectedProfiles.length === 0}
                className={`flex items-center gap-2 font-semibold px-6 py-2.5 rounded-xl transition shadow ${
                  selectedProfiles.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-700 hover:bg-blue-800 text-white'
                }`}
                data-testid="step2-generate-btn"
              >
                <Zap className="w-4 h-4" />
                Generate {selectedProfiles.length > 0 ? `(${selectedProfiles.length})` : ''}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ─────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div data-testid="step-3">
            {/* Generation status header */}
            <div className="bg-white rounded-2xl paper-shadow p-6 mb-5">
              <div className="flex items-center gap-3 mb-5">
                {generationLoading ? (
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                ) : generationError ? (
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-red-100 text-red-500 text-xs font-bold">!</span>
                ) : (
                  <Check className="w-6 h-6 text-emerald-500" />
                )}
                <div>
                  <h2
                    className="text-lg font-bold text-slate-800"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    {generationLoading
                      ? 'Generating your resumes...'
                      : generationError
                      ? 'Generation encountered issues'
                      : 'Generation complete!'}
                  </h2>
                  {generationStats && !generationLoading && (
                    <p
                      className="text-sm text-slate-500 mt-0.5"
                      data-testid="generation-stats"
                    >
                      {generationStats.successful}/{generationStats.total_requested} generated
                      successfully
                      {generationStats.providers_used &&
                        generationStats.providers_used.length > 0 && (
                          <span className="ml-2 text-slate-400">
                            via {generationStats.providers_used.join(', ')}
                          </span>
                        )}
                    </p>
                  )}
                </div>
              </div>

              {generationError && (
                <div
                  className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4"
                  data-testid="generation-error"
                >
                  {generationError}
                </div>
              )}

              {/* Per-profile status cards */}
              <div className="space-y-3" data-testid="profile-status-list">
                {selectedProfiles.map((profileId) => {
                  const profile = getProfileById(profileId);
                  const profileTitle =
                    profile?.title || profile?.name || profileId;
                  const status = profileStatuses[profileId];

                  // Find matching result resume
                  const matchedResume = results.find(
                    (r) =>
                      r.job_profile === profileId ||
                      r.job_profile === profile?._id ||
                      r.job_profile === profile?.id
                  );

                  return (
                    <div
                      key={profileId}
                      className={`flex items-center justify-between border rounded-xl px-4 py-3 ${
                        status === 'success'
                          ? 'border-emerald-200 bg-emerald-50'
                          : status === 'failed'
                          ? 'border-red-200 bg-red-50'
                          : 'border-slate-100 bg-slate-50'
                      }`}
                      data-testid={`profile-status-${profileId}`}
                    >
                      <div className="flex items-center gap-3">
                        {getProfileStatusIcon(profileId)}
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {profileTitle}
                          </p>
                          {matchedResume?.title && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {matchedResume.title}
                            </p>
                          )}
                          {status === 'failed' && (
                            <p className="text-xs text-red-500 mt-0.5">
                              Generation failed for this profile.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons on success */}
                      {status === 'success' && matchedResume && (
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => navigate(`/builder/${matchedResume.id}`)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition"
                            data-testid={`edit-btn-${matchedResume.id}`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => navigate(`/ats/${matchedResume.id}`)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg transition"
                            data-testid={`analyze-btn-${matchedResume.id}`}
                          >
                            <Target className="w-3.5 h-3.5" />
                            Analyze
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Results summary (shown when done) */}
            {!generationLoading && results.length > 0 && (
              <div className="bg-white rounded-2xl paper-shadow p-6 mb-7" data-testid="results-summary">
                <h3
                  className="text-base font-bold text-slate-800 mb-4"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  Generated Resumes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.map((resume) => (
                    <div
                      key={resume.id}
                      className="border border-slate-100 rounded-xl p-4 flex items-center justify-between gap-2"
                      data-testid={`result-card-${resume.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {resume.title || 'Resume'}
                          </p>
                          {resume.job_profile && (
                            <p className="text-xs text-slate-400 truncate">
                              {getProfileById(resume.job_profile)?.title ||
                                resume.job_profile}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => navigate(`/builder/${resume.id}`)}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition"
                          data-testid={`result-edit-${resume.id}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => navigate(`/ats/${resume.id}`)}
                          className="text-xs font-semibold text-purple-700 hover:text-purple-800 transition"
                          data-testid={`result-analyze-${resume.id}`}
                        >
                          Analyze
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 action */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                data-testid="back-to-dashboard-btn"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              {!generationLoading && Object.values(profileStatuses).some(s => s === 'failed') && (
                <button
                  onClick={handleRetryFailed}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-xl transition shadow"
                  data-testid="retry-failed-btn"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Failed ({Object.values(profileStatuses).filter(s => s === 'failed').length})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
