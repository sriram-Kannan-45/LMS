import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Loader2, Save } from 'lucide-react'
import { codingAssessmentApi } from '../../api/api'
import { useToast } from '../../components/Toast'

const DIFFICULTIES = ['easy', 'medium', 'hard']
const LANGUAGES = ['javascript', 'python', 'java', 'c++']

const emptyProblem = () => ({
  title: '',
  statement: '',
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  starterCode: '',
  marks: 10,
  difficulty: 'medium',
  timeLimitSec: 5,
  memoryLimitMb: 256,
  testCases: [emptyTestCase()],
})

const emptyTestCase = () => ({
  input: '',
  expectedOutput: '',
  isHidden: false,
})

const initialForm = () => ({
  title: '',
  description: '',
  durationMinutes: 60,
  passingScore: 50,
  difficulty: 'medium',
  language: 'javascript',
  isProctored: true,
  maxViolations: 3,
  problems: [emptyProblem()],
})

export default function CodingAssessmentBuilder() {
  const { trainingId } = useParams()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()

  const [form, setForm] = useState(initialForm())
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateProblem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      problems: prev.problems.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }))
  }

  const updateTestCase = (problemIndex, testCaseIndex, field, value) => {
    setForm((prev) => ({
      ...prev,
      problems: prev.problems.map((p, i) =>
        i === problemIndex
          ? {
              ...p,
              testCases: p.testCases.map((tc, j) =>
                j === testCaseIndex ? { ...tc, [field]: value } : tc
              ),
            }
          : p
      ),
    }))
  }

  const addProblem = () => {
    setForm((prev) => ({
      ...prev,
      problems: [...prev.problems, emptyProblem()],
    }))
  }

  const removeProblem = (index) => {
    setForm((prev) => ({
      ...prev,
      problems: prev.problems.filter((_, i) => i !== index),
    }))
  }

  const addTestCase = (problemIndex) => {
    setForm((prev) => ({
      ...prev,
      problems: prev.problems.map((p, i) =>
        i === problemIndex
          ? { ...p, testCases: [...p.testCases, emptyTestCase()] }
          : p
      ),
    }))
  }

  const removeTestCase = (problemIndex, testCaseIndex) => {
    setForm((prev) => ({
      ...prev,
      problems: prev.problems.map((p, i) =>
        i === problemIndex
          ? { ...p, testCases: p.testCases.filter((_, j) => j !== testCaseIndex) }
          : p
      ),
    }))
  }

  const validate = () => {
    if (!form.title.trim()) return 'Assessment title is required.'
    if (form.problems.length === 0) return 'Add at least one problem.'
    for (const [i, p] of form.problems.entries()) {
      if (!p.title.trim()) return `Problem ${i + 1} title is required.`
      if (!p.statement.trim()) return `Problem ${i + 1} statement is required.`
      if (p.testCases.length === 0) return `Problem ${i + 1} needs at least one test case.`
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      showError(err)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        trainingId,
        ...form,
        problems: form.problems,
      }
      const res = await codingAssessmentApi.create(payload)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Create failed: HTTP ${res.status}`)
      }
      success('Assessment created successfully')
      navigate('/trainer')
    } catch (err) {
      showError(err.message || 'Failed to create assessment')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const textareaClass = `${inputClass} min-h-[80px] resize-y`
  const selectClass = `${inputClass} cursor-pointer`
  const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Coding Assessment</h1>
            <p className="text-sm text-gray-500">Build a new assessment with problems and test cases.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/trainer')}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Basic Details</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelClass}>Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className={inputClass}
                  placeholder="Assessment title"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelClass}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className={textareaClass}
                  placeholder="Brief description"
                  rows={3}
                />
              </div>

              <div>
                <label className={labelClass}>Duration (minutes) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) => updateField('durationMinutes', Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Passing Score (%) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={form.passingScore}
                  onChange={(e) => updateField('passingScore', Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => updateField('difficulty', e.target.value)}
                  className={selectClass}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Programming Language</label>
                <select
                  value={form.language}
                  onChange={(e) => updateField('language', e.target.value)}
                  className={selectClass}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l[0].toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Max Violations</label>
                <input
                  type="number"
                  min={0}
                  value={form.maxViolations}
                  onChange={(e) => updateField('maxViolations', Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.isProctored}
                    onChange={(e) => updateField('isProctored', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Is Proctored</span>
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Problems</h2>
              <button
                type="button"
                onClick={addProblem}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={16} /> Add Problem
              </button>
            </div>

            {form.problems.map((problem, pIdx) => (
              <div key={pIdx} className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Problem {pIdx + 1}</h3>
                  {form.problems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProblem(pIdx)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Problem Title *</label>
                    <input
                      type="text"
                      required
                      value={problem.title}
                      onChange={(e) => updateProblem(pIdx, 'title', e.target.value)}
                      className={inputClass}
                      placeholder="Problem title"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Statement</label>
                    <textarea
                      value={problem.statement}
                      onChange={(e) => updateProblem(pIdx, 'statement', e.target.value)}
                      className={textareaClass}
                      placeholder="Problem statement (markdown supported)"
                      rows={5}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Input Format</label>
                    <textarea
                      value={problem.inputFormat}
                      onChange={(e) => updateProblem(pIdx, 'inputFormat', e.target.value)}
                      className={textareaClass}
                      placeholder="Describe the input format"
                      rows={2}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Output Format</label>
                    <textarea
                      value={problem.outputFormat}
                      onChange={(e) => updateProblem(pIdx, 'outputFormat', e.target.value)}
                      className={textareaClass}
                      placeholder="Describe the output format"
                      rows={2}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Constraints</label>
                    <textarea
                      value={problem.constraints}
                      onChange={(e) => updateProblem(pIdx, 'constraints', e.target.value)}
                      className={textareaClass}
                      placeholder="Constraints and limits"
                      rows={2}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelClass}>Starter Code</label>
                    <textarea
                      value={problem.starterCode}
                      onChange={(e) => updateProblem(pIdx, 'starterCode', e.target.value)}
                      className={`${inputClass} min-h-[120px] resize-y font-mono text-xs`}
                      placeholder="Starter code shown to participants"
                      rows={5}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Difficulty</label>
                    <select
                      value={problem.difficulty}
                      onChange={(e) => updateProblem(pIdx, 'difficulty', e.target.value)}
                      className={selectClass}
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d[0].toUpperCase() + d.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Marks</label>
                    <input
                      type="number"
                      min={0}
                      value={problem.marks}
                      onChange={(e) => updateProblem(pIdx, 'marks', Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Time Limit (sec)</label>
                    <input
                      type="number"
                      min={1}
                      value={problem.timeLimitSec}
                      onChange={(e) => updateProblem(pIdx, 'timeLimitSec', Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Memory Limit (MB)</label>
                    <input
                      type="number"
                      min={1}
                      value={problem.memoryLimitMb}
                      onChange={(e) => updateProblem(pIdx, 'memoryLimitMb', Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">Test Cases</h4>
                    <button
                      type="button"
                      onClick={() => addTestCase(pIdx)}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <Plus size={14} /> Add Test Case
                    </button>
                  </div>

                  <div className="space-y-3">
                    {problem.testCases.map((tc, tcIdx) => (
                      <div key={tcIdx} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Test Case {tcIdx + 1}
                          </span>
                          {problem.testCases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTestCase(pIdx, tcIdx)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelClass}>Input</label>
                            <textarea
                              value={tc.input}
                              onChange={(e) => updateTestCase(pIdx, tcIdx, 'input', e.target.value)}
                              className={`${inputClass} min-h-[60px] resize-y font-mono text-xs`}
                              placeholder="Input"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Expected Output</label>
                            <textarea
                              value={tc.expectedOutput}
                              onChange={(e) => updateTestCase(pIdx, tcIdx, 'expectedOutput', e.target.value)}
                              className={`${inputClass} min-h-[60px] resize-y font-mono text-xs`}
                              placeholder="Expected output"
                              rows={2}
                            />
                          </div>
                        </div>
                        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={tc.isHidden}
                            onChange={(e) => updateTestCase(pIdx, tcIdx, 'isHidden', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Hidden test case
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Save size={16} /> Create Assessment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
