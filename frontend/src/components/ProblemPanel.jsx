import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';

const ProblemPanel = ({ problem }) => {
  if (!problem) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        No problem selected.
      </div>
    );
  }

  const {
    title,
    statement,
    problemDescription,
    inputFormat,
    outputFormat,
    constraints,
    testCases = [],
  } = problem;

  const description = statement || problemDescription || '';
  const visibleTestCases = testCases.filter((tc) => !tc.isHidden);

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{title}</h1>

      <div className="prose prose-slate mb-6 max-w-none">
        <ReactMarkdown>{description}</ReactMarkdown>
      </div>

      {inputFormat && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Input Format</h2>
          <div className="prose prose-slate max-w-none rounded-lg bg-slate-50 p-4">
            <ReactMarkdown>{inputFormat}</ReactMarkdown>
          </div>
        </section>
      )}

      {outputFormat && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Output Format</h2>
          <div className="prose prose-slate max-w-none rounded-lg bg-slate-50 p-4">
            <ReactMarkdown>{outputFormat}</ReactMarkdown>
          </div>
        </section>
      )}

      {constraints && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Constraints</h2>
          <div className="prose prose-slate max-w-none rounded-lg bg-slate-50 p-4">
            <ReactMarkdown>{constraints}</ReactMarkdown>
          </div>
        </section>
      )}

      {visibleTestCases.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Sample Test Cases</h2>
          <div className="space-y-4">
            {visibleTestCases.map((tc, index) => (
              <div
                key={tc.id || index}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="mb-2 text-sm font-semibold text-slate-700">
                  Sample {index + 1}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Input
                    </span>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-sm text-slate-800">
                      {tc.input}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Expected Output
                    </span>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-sm text-slate-800">
                      {tc.expectedOutput}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

ProblemPanel.propTypes = {
  problem: PropTypes.shape({
    title: PropTypes.string,
    statement: PropTypes.string,
    problemDescription: PropTypes.string,
    inputFormat: PropTypes.string,
    outputFormat: PropTypes.string,
    constraints: PropTypes.string,
    testCases: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        input: PropTypes.string,
        expectedOutput: PropTypes.string,
        isHidden: PropTypes.bool,
      })
    ),
  }),
};

export default ProblemPanel;
