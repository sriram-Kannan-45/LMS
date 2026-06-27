import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code2,
  Loader2,
  Trophy,
  XCircle,
} from 'lucide-react';
import { codingAssessmentApi, codingAttemptApi } from '../../api/api';
import {
  calculateMaxScore,
  formatDateTime,
  getProblemSubmissionsMap,
  getTestCaseSummary,
  isPassed,
  normalizeAssessment,
  normalizeAttempt,
} from './CodingAssessmentResultPage.utils';

export default function CodingAssessmentResultPage() {
  const { trainingId, assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!assessmentId) {
      setErrorMsg('Invalid assessment identifier.');
      setLoading(false);
      return;
    }

    let aborted = false;
    async function fetchResult() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const assessmentRes = await codingAssessmentApi.get(assessmentId);
        const assessmentData = await assessmentRes.json();
        if (!assessmentRes.ok) {
          throw new Error(
            assessmentData?.error || assessmentData?.message || 'Failed to load assessment.'
          );
        }

        const startRes = await codingAttemptApi.start(assessmentId);
        const startData = await startRes.json();
        if (!startRes.ok) {
          throw new Error(
            startData?.error || startData?.message || 'Failed to load your attempt.'
          );
        }

        const attemptRes = await codingAttemptApi.get(startData.attemptId);
        const attemptData = await attemptRes.json();
        if (!attemptRes.ok) {
          throw new Error(
            attemptData?.error || attemptData?.message || 'Failed to load attempt details.'
          );
        }

        if (aborted) return;

        setAssessment(normalizeAssessment(assessmentData));
        setAttempt(normalizeAttempt(attemptData));
      } catch (err) {
        if (!aborted) {
          setErrorMsg(err?.message || 'Server error while loading results.');
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    }

    fetchResult();
    return () => {
      aborted = true;
    };
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-slate-600">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 text-sm font-semibold">Loading results...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4">
        <div className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h2 className="mb-2 text-lg font-bold text-slate-900">Unable to Load Results</h2>
          <p className="mb-6 text-sm text-slate-600">{errorMsg}</p>
          <button
            type="button"
            onClick={() => navigate('/participant')}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isResultPublished = assessment?.resultStatus === 'PUBLISHED';
  const maxScore = calculateMaxScore(assessment?.questions);
  const totalScore = typeof attempt?.totalScore === 'number' ? attempt.totalScore : 0;
  const passed = isPassed(totalScore, assessment?.passingScore);
  const submissionMap = getProblemSubmissionsMap(attempt?.submissions);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <button
        type="button"
        onClick={() => navigate('/participant')}
        className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Trainings
      </button>

      {!isResultPublished ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Clock className="mx-auto mb-4 h-14 w-14 text-amber-500" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Results not yet published</h2>
          <p className="mx-auto max-w-md text-sm text-slate-600">
            Your attempt has been submitted successfully. The trainer has not published the results
            yet. You will be notified once they are available.
          </p>
          {attempt?.status && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
              <CheckCircle2 className="h-4 w-4" />
              Attempt status: {attempt.status}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-700 p-8 text-center text-white shadow-lg">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-yellow-300" />
            <h2 className="text-lg font-semibold opacity-90">Your Coding Result</h2>
            <div className="mt-3 text-5xl font-extrabold">{totalScore}</div>
            <div className="mt-1 text-sm font-medium opacity-90">
              out of {maxScore} marks
            </div>
            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${
                passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {passed ? 'Passed' : 'Did not pass'}
            </div>
            <p className="mt-2 text-xs opacity-80">
              Passing score: {assessment?.passingScore ?? 0}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ResultStat label="Total Score" value={`${totalScore} / ${maxScore}`} />
            <ResultStat
              label="Status"
              value={passed ? 'Pass' : 'Fail'}
              valueClassName={passed ? 'text-green-600' : 'text-red-600'}
            />
            <ResultStat
              label="Problems"
              value={`${assessment?.questions?.length ?? 0}`}
            />
            <ResultStat
              label="Submitted At"
              value={formatDateTime(attempt?.submittedAt)}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Problem Breakdown
            </h3>
            {(assessment?.questions || []).map((question, index) => {
              const submission = submissionMap[question.id];
              const { passed: testsPassed, total: testsTotal } = getTestCaseSummary(submission);
              const allPassed = testsTotal > 0 && testsPassed === testsTotal;
              const score = submission?.score ?? 0;

              return (
                <div
                  key={question.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-base font-bold text-slate-900">
                          {index + 1}. {question.title || 'Untitled Problem'}
                        </h4>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            allPassed
                              ? 'bg-green-100 text-green-700'
                              : testsPassed > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {score} / {question.marks ?? 0} marks
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        Tests passed:{' '}
                        <span className="font-semibold text-slate-900">
                          {testsPassed} / {testsTotal}
                        </span>
                      </p>
                    </div>
                  </div>

                  {submission?.results && submission.results.length > 0 && (
                    <div className="p-4">
                      <h5 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Test-case results
                      </h5>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {submission.results.map((result, tcIndex) => (
                          <div
                            key={result.id || tcIndex}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                              result.status === 'PASSED'
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            <span className="font-medium">Test {tcIndex + 1}</span>
                            <span className="flex items-center gap-1 text-xs font-bold">
                              {result.status === 'PASSED' ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3.5 w-3.5" /> Failed
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {(assessment?.questions || []).length === 0 && (
              <p className="text-center text-sm text-slate-500">No problems found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, valueClassName = '' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-extrabold text-slate-900 ${valueClassName}`}>{value}</div>
    </div>
  );
}
