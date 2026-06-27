import { useState, useCallback } from 'react';
import { codeExecutionApi } from '../api/api';
import { useToast } from '../components/Toast';

export default function useCodeExecution() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const { error: showError } = useToast();

  const run = useCallback(async ({ code, language, problemId }) => {
    setLoading(true);
    try {
      const res = await codeExecutionApi.run({ code, language, problemId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
      setResults({ type: 'run', ...data });
      return data;
    } catch (err) {
      showError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const submit = useCallback(async ({ code, language, problemId, attemptId }) => {
    setLoading(true);
    try {
      const res = await codeExecutionApi.submit({ code, language, problemId, attemptId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setResults({ type: 'submit', ...data });
      return data;
    } catch (err) {
      showError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const clearResults = useCallback(() => setResults(null), []);

  return { run, submit, results, loading, clearResults };
}
