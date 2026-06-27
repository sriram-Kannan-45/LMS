import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { API_BASE } from '../api/api';
import { useToast } from './Toast';
import CodeEditor from './CodeEditor';

const auth = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const statusBadgeClasses = {
  PASSED: 'bg-green-100 text-green-700 border-green-200',
  FAILED: 'bg-red-100 text-red-700 border-red-200',
  TLE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CE: 'bg-orange-100 text-orange-700 border-orange-200',
  RE: 'bg-orange-100 text-orange-700 border-orange-200',
  MLE: 'bg-purple-100 text-purple-700 border-purple-200',
};

function TestResultItem({ result }) {
  const status = result.status || 'FAILED';
  const input = result.testCase?.input || result.input || '';
  const expected = result.testCase?.expectedOutput || result.expectedOutput || '';
  const got = result.actualOutput || '';

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-2 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">
          Test {result.testCase?.orderIndex != null ? `#${result.testCase.orderIndex + 1}` : ''}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            statusBadgeClasses[status] || 'bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          {status}
        </span>
      </div>
      {input && (
        <div className="mb-2">
          <div className="text-xs font-medium text-gray-500 mb-1">Input</div>
          <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-wrap font-mono">{input}</pre>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {expected && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Expected</div>
            <pre className="text-xs bg-green-50 text-green-800 p-2 rounded border border-green-100 whitespace-pre-wrap font-mono">{expected}</pre>
          </div>
        )}
        {got && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Got</div>
            <pre className={`text-xs p-2 rounded border whitespace-pre-wrap font-mono ${status === 'PASSED' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'}`}>{got}</pre>
          </div>
        )}
      </div>
      {result.errorMessage && (
        <div className="mt-2">
          <div className="text-xs font-medium text-red-500 mb-1">Error</div>
          <pre className="text-xs bg-red-50 text-red-800 p-2 rounded border border-red-100 whitespace-pre-wrap font-mono">{result.errorMessage}</pre>
        </div>
      )}
    </div>
  );
}

TestResultItem.propTypes = {
  result: PropTypes.shape({
    status: PropTypes.string,
    actualOutput: PropTypes.string,
    errorMessage: PropTypes.string,
    input: PropTypes.string,
    expectedOutput: PropTypes.string,
    testCase: PropTypes.shape({
      input: PropTypes.string,
      expectedOutput: PropTypes.string,
      orderIndex: PropTypes.number,
    }),
  }).isRequired,
};

export default function CodeSubmissionTabs({ attemptId }) {
  const { error: showError } = useToast();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/coding-submissions/${attemptId}`, { headers: auth() });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || 'Failed to load submissions');
        const list = d.submissions || [];
        setSubmissions(list);
        setActiveTab(0);
      } catch (e) {
        showError(e.message);
      } finally {
        setLoading(false);
      }
    };
    if (attemptId) load();
  }, [attemptId, showError]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="spinner mx-auto mb-2" />
        <p className="text-sm">Loading submissions...</p>
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm">No final submissions found for this attempt.</p>
      </div>
    );
  }

  const activeSubmission = submissions[activeTab] || submissions[0];
  const results = activeSubmission.results || [];
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const total = results.length || activeSubmission.totalCount || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: 320 }}>
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {submissions.map((sub, idx) => (
          <button
            key={sub.id || idx}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === idx
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {sub.question?.title || `Problem ${idx + 1}`}
          </button>
        ))}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Language</span>
            <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
              {activeSubmission.language || 'javascript'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Score</span>
            <span className="text-sm font-bold text-purple-700">{activeSubmission.score ?? 0}</span>
            <span className="text-sm text-gray-500">Tests</span>
            <span className={`text-sm font-bold ${passed === total && total > 0 ? 'text-green-600' : 'text-gray-800'}`}>
              {passed}/{total}
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
          <CodeEditor
            value={activeSubmission.sourceCode || activeSubmission.code || ''}
            language={activeSubmission.language || 'javascript'}
            readOnly
            height="320px"
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-2">Test Results</h4>
          {results.length > 0 ? (
            results.map((result, idx) => <TestResultItem key={result.id || idx} result={result} />)
          ) : (
            <p className="text-sm text-gray-400">No detailed test results available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

CodeSubmissionTabs.propTypes = {
  attemptId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
