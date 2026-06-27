import PropTypes from 'prop-types';
import Editor from '@monaco-editor/react';

const CodeEditor = ({
  value = '',
  language = 'javascript',
  onChange,
  readOnly = false,
  height = '60vh',
}) => {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme="vs-dark"
      onChange={onChange}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        readOnly,
      }}
    />
  );
};

CodeEditor.propTypes = {
  value: PropTypes.string,
  language: PropTypes.string,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool,
  height: PropTypes.string,
};

export default CodeEditor;
