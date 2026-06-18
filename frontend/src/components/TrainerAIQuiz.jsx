import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API, API_BASE } from '../api/api';
import { getAuthHeaders } from '../api/request';
import AnimatedDropdown from './AnimatedDropdown';
import Leaderboard from './Leaderboard';
import './TrainerAIQuiz.css';

const FILE_TYPE_ICONS = { pdf: '📕', docx: '📘', doc: '📘', txt: '📄' };
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const TrainerAIQuiz = ({ user }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [trainings, setTrainings] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [file, setFile] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [selectedQuizForLeaderboard, setSelectedQuizForLeaderboard] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef();
  const uploadInProgress = useRef(false);

  // ── Data Fetching ─────────────────────────────
  const fetchTrainings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/trainer/trainings`, { headers: getAuthHeaders(user) });
      const data = await res.json();
      setTrainings(data.trainings || []);
    } catch (err) { console.error('Failed to fetch trainings:', err); }
  }, [user]);

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ai-quiz/trainer/quizzes`, { headers: getAuthHeaders(user) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch quizzes');
      setQuizzes(data.quizzes || []);
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
    }
  }, [user]);

  useEffect(() => { fetchTrainings(); fetchQuizzes(); }, [fetchTrainings, fetchQuizzes]);

  // ── File Validation ───────────────────────────
  const validateFile = (selected) => {
    const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml'];
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff'];
    const fileExt = '.' + selected.name.split('.').pop().toLowerCase();

    if (imageTypes.includes(selected.type) || imageExts.includes(fileExt)) {
      setError('Images are NOT supported. Please upload PDF, DOCX, PPTX, or TXT files only.');
      return false;
    }
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain'];
    if (!validTypes.includes(selected.type) && !selected.name.match(/\.(pdf|docx|pptx|txt)$/i)) {
      setError('Unsupported file type. Please upload PDF, DOCX, PPTX, or TXT files only.');
      return false;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('File size must be less than 25 MB.');
      return false;
    }
    return true;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && validateFile(selected)) { setFile(selected); setError(''); }
    else if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Drag & Drop ───────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && validateFile(dropped)) { setFile(dropped); setError(''); }
  };

  // ── Upload & Generate ─────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a file to upload'); return; }
    if (uploadInProgress.current) return;

    uploadInProgress.current = true;
    setLoading(true);
    setGenerating(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('trainingId', selectedTraining || '');
    formData.append('numQuestions', numQuestions);
    formData.append('difficulty', difficulty);

    try {
      const res = await fetch(`${API_BASE}/ai-quiz/trainer/upload-document`, {
        method: 'POST',
        headers: getAuthHeaders(user),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Upload failed');

      setSuccess(data.message || 'Quiz generated successfully! Switch to "My Quizzes" to view it.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchQuizzes();
      // Auto-switch to My Quizzes tab after a short delay
      setTimeout(() => setActiveTab('my-quizzes'), 1500);
    } catch (err) {
      console.error('Upload error:', err);
      if (err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED') || err.message.includes('Network Error')) {
        setError('Cannot connect to the server. Please ensure the backend is running.');
      } else if (err.message.includes('AI service')) {
        setError('AI service is currently unavailable. Please ensure the Python AI service is running.');
      } else if (err.message.includes('image') || err.message.includes('not supported') || err.message.includes('Images')) {
        setError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setGenerating(false);
      uploadInProgress.current = false;
    }
  };

  // ── Quiz Management ───────────────────────────
  const handleEditQuiz = (quiz) => { setEditingQuiz(quiz); setGeneratedQuestions(quiz.questions || []); };
  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...generatedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setGeneratedQuestions(updated);
  };
  const handleSaveQuiz = async () => {
    if (!editingQuiz) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai-quiz/trainer/quiz/${editingQuiz.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingQuiz.title, timeLimit: editingQuiz.timeLimit, status: editingQuiz.status })
      });
      if (!res.ok) throw new Error('Failed to update');
      setSuccess('Quiz updated successfully!');
      setEditingQuiz(null);
      fetchQuizzes();
    } catch (err) { setError('Failed to update quiz: ' + err.message); }
    finally { setLoading(false); }
  };

  const handlePublish = async (quiz) => {
    try {
      const res = await fetch(`${API_BASE}/ai-quiz/trainer/quiz/${quiz.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' })
      });
      if (!res.ok) throw new Error('Failed to publish');
      fetchQuizzes();
      setSuccess('Quiz published successfully!');
    } catch (err) { setError('Failed to publish quiz'); }
  };

  // ── Leaderboard ───────────────────────────────
  const fetchLeaderboard = async (quizId) => {
    if (!quizId) return;
    try {
      const res = await fetch(`${API_BASE}/ai-quiz/leaderboard/${quizId}`, { headers: getAuthHeaders(user) });
      const data = await res.json();
      setLeaderboardData(data.leaderboard || []);
    } catch (err) { console.error('Failed to fetch leaderboard:', err); }
  };

  useEffect(() => {
    if (activeTab === 'leaderboard' && quizzes.length > 0 && !selectedQuizForLeaderboard) {
      setSelectedQuizForLeaderboard(quizzes[0]?.id || '');
    }
  }, [activeTab, quizzes, selectedQuizForLeaderboard]);

  useEffect(() => {
    if (selectedQuizForLeaderboard) fetchLeaderboard(selectedQuizForLeaderboard);
  }, [selectedQuizForLeaderboard]);

  // ── Helpers ───────────────────────────────────
  const fileExt = file ? file.name.split('.').pop().toLowerCase() : '';
  const trainingOptions = trainings.map(t => ({ label: t.title, value: t.id }));
  const difficultyOptions = [
    { label: 'Easy', value: 'EASY' }, { label: 'Medium', value: 'MEDIUM' },
    { label: 'Hard', value: 'HARD' }, { label: 'Mixed', value: 'MIXED' }
  ];

  // ── Alert Component ───────────────────────────
  const AlertBox = ({ type, text, onClose }) => (
    <motion.div className={`alert-box ${type}`}
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.3 }}>
      <span className="alert-icon">{type === 'error' ? '⚠️' : '✅'}</span>
      <div className="alert-body">
        <span className="alert-title">{type === 'error' ? 'Something went wrong' : 'Success'}</span>
        <span className="alert-text">{text}</span>
      </div>
      <button className="alert-close" onClick={onClose}>✕</button>
    </motion.div>
  );

  // ── Skeleton Loader ───────────────────────────
  const SkeletonLoader = () => (
    <div className="quiz-skeleton">
      <div className="skeleton-bar h-lg w-60" />
      <div className="skeleton-bar w-full" /><div className="skeleton-bar w-75" />
      <div className="skeleton-bar w-full" /><div className="skeleton-bar w-50" />
      <div className="skeleton-bar w-full" /><div className="skeleton-bar w-75" />
    </div>
  );

  return (
    <div className="trainer-ai-quiz">
      <div className="quiz-header">
        <h2>🤖 AI Quiz Generator</h2>
        <p className="subtitle">Upload training materials and let AI generate quizzes automatically</p>
      </div>

      {/* ── Tabs ─────────────────────────────── */}
      <div className="quiz-tabs">
        {[
          { key: 'upload', icon: '📄', label: 'Upload & Generate' },
          { key: 'my-quizzes', icon: '📚', label: 'My Quizzes' },
          { key: 'leaderboard', icon: '🏆', label: 'Leaderboard' }
        ].map(tab => (
          <button key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Alerts ───────────────────────────── */}
      <AnimatePresence>
        {error && <AlertBox type="error" text={error} onClose={() => setError('')} />}
        {success && <AlertBox type="success" text={success} onClose={() => setSuccess('')} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

          {/* ── UPLOAD TAB ─────────────────── */}
          {activeTab === 'upload' && (
            <div className="upload-section">
              {generating ? (
                <div className="generating-overlay">
                  <div className="generating-spinner" />
                  <div className="generating-text">Generating Your Quiz…</div>
                  <div className="generating-sub">AI is analyzing your document and creating questions. This may take 30–60 seconds.</div>
                  <SkeletonLoader />
                </div>
              ) : (
                <form onSubmit={handleUpload} className="upload-form">
                  <div className="form-group">
                    <label>Upload Training Document</label>
                    <div className="upload-warning">⚠️ Only PDF, DOCX, PPTX, and TXT files are supported. Images are NOT supported.</div>
                    <div
                      className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}>
                      <input ref={fileInputRef} type="file"
                        accept=".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                        onChange={handleFileChange} style={{ display: 'none' }} />
                      {file ? (
                        <div className="file-preview">
                          <div className="file-type-icon">{FILE_TYPE_ICONS[fileExt] || '📄'}</div>
                          <div className="file-details">
                            <div className="file-name">{file.name}</div>
                            <div className="file-meta">{(file.size / 1024).toFixed(1)} KB · {fileExt.toUpperCase()}</div>
                          </div>
                          <button type="button" className="file-remove" onClick={(e) => {
                            e.stopPropagation(); setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}>✕</button>
                        </div>
                      ) : (
                        <div className="upload-placeholder">
                          <span className="upload-icon">☁️</span>
                          <p>Drag & drop your file here, or click to browse</p>
                          <p className="upload-hint">PDF, DOCX, PPTX, or TXT · Max 25 MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Assign to Training (Optional)</label>
                      {trainings.length > 0 ? (
                        <AnimatedDropdown
                          options={[{ label: 'No Training', value: '' }, ...trainingOptions]}
                          value={selectedTraining} onChange={setSelectedTraining}
                          placeholder="Select training..." />
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '0.5rem' }}>
                          No trainings available.{' '}
                          <button type="button" onClick={fetchTrainings}
                            style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer' }}>Refresh</button>
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Number of Questions</label>
                      <AnimatedDropdown
                        options={[5, 10, 15, 20].map(n => ({ label: `${n} Questions`, value: n }))}
                        value={numQuestions} onChange={setNumQuestions} placeholder="Select..." />
                    </div>
                    <div className="form-group">
                      <label>Difficulty</label>
                      <AnimatedDropdown
                        options={difficultyOptions} value={difficulty}
                        onChange={setDifficulty} placeholder="Select..." />
                    </div>
                  </div>

                  <button type="submit" className="generate-btn" disabled={loading || !file}>
                    {loading ? (<><span className="spinner" /> Generating…</>) : '🤖 Generate Quiz with AI'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── MY QUIZZES TAB ─────────────── */}
          {activeTab === 'my-quizzes' && (
            <div className="quizzes-section">
              {quizzes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <p>No quizzes generated yet. Upload a document to get started!</p>
                </div>
              ) : (
                <div className="quizzes-list">
                  {quizzes.map(quiz => (
                    <motion.div key={quiz.id} className="quiz-card"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="quiz-card-header">
                        <h3>{quiz.title || 'Untitled Quiz'}</h3>
                        <span className={`status-badge ${quiz.status?.toLowerCase()}`}>{quiz.status}</span>
                      </div>
                      <div className="quiz-meta">
                        <span>📄 {quiz.document?.fileUrl ? 'Document attached' : 'No document'}</span>
                        <span>❓ {quiz.questions?.length || 0} questions</span>
                        <span>🎯 {quiz.difficulty || 'MEDIUM'}</span>
                      </div>
                      <div className="quiz-actions">
                        <button className="edit-btn" onClick={() => handleEditQuiz(quiz)}>✏️ Edit</button>
                        <button className="view-btn" onClick={() => { setSelectedQuizForLeaderboard(quiz.id); setActiveTab('leaderboard'); }}>🏆 Leaderboard</button>
                        {quiz.status !== 'PUBLISHED' && (
                          <button className="publish-btn" onClick={() => handlePublish(quiz)}>📢 Publish</button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LEADERBOARD TAB ────────────── */}
          {activeTab === 'leaderboard' && (
            <div className="leaderboard-section">
              {quizzes.length > 0 ? (
                <>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>Select Quiz</label>
                    <AnimatedDropdown
                      options={quizzes.map(q => ({ label: q.title || 'Untitled Quiz', value: q.id }))}
                      value={selectedQuizForLeaderboard}
                      onChange={(val) => { setSelectedQuizForLeaderboard(val); fetchLeaderboard(val); }}
                      placeholder="Select a quiz..." />
                  </div>
                  <Leaderboard data={leaderboardData}
                    title={quizzes.find(q => q.id == selectedQuizForLeaderboard)?.title || 'Quiz Leaderboard'} />
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🏆</div>
                  <p>No quizzes available. Generate a quiz first!</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Edit Quiz Modal ─────────────────── */}
      <AnimatePresence>
        {editingQuiz && (
          <motion.div className="modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setEditingQuiz(null)}>
            <motion.div className="modal-content edit-quiz-modal"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <h2>Edit Quiz Questions</h2>
              <div className="questions-editor">
                {generatedQuestions.map((q, idx) => (
                  <div key={idx} className="question-editor">
                    <div className="question-header">
                      <span className="q-type-badge">{q.questionType}</span>
                      <span className="q-number">Q{idx + 1}</span>
                    </div>
                    <textarea className="question-text-input" value={q.questionText}
                      onChange={(e) => handleUpdateQuestion(idx, 'questionText', e.target.value)}
                      placeholder="Question text..." />
                    {q.questionType === 'MCQ' && (
                      <div className="options-editor">
                        {(q.options || []).map((opt, oidx) => (
                          <div key={oidx} className="option-row">
                            <input type="radio" name={`correct-${idx}`}
                              checked={q.correctAnswer === String(oidx)}
                              onChange={() => handleUpdateQuestion(idx, 'correctAnswer', String(oidx))} />
                            <input type="text" value={opt} className="option-input"
                              onChange={(e) => {
                                const newOpts = [...(q.options || [])];
                                newOpts[oidx] = e.target.value;
                                handleUpdateQuestion(idx, 'options', newOpts);
                              }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <input type="text" className="model-answer-input"
                      value={q.correctAnswer || ''}
                      onChange={(e) => handleUpdateQuestion(idx, 'correctAnswer', e.target.value)}
                      placeholder="Correct answer / Model answer" />
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setEditingQuiz(null)}>Cancel</button>
                <button className="save-btn" onClick={handleSaveQuiz} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrainerAIQuiz;
