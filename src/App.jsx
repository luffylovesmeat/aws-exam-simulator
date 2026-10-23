import { useState } from 'react';
import Setup from './components/Setup.jsx';
import Exam from './components/Exam.jsx';
import Results from './components/Results.jsx';
import History from './components/History.jsx';
import { clearSession, loadSession } from './lib/session.js';
import { buildAttempt } from './lib/exam.js';
import { findCert } from './lib/certs.js';
import { saveAttempt } from './lib/api.js';

export default function App() {
  const [view, setView] = useState('setup'); // setup | exam | results | history
  const [session, setSession] = useState(() => loadSession()); // exam in progress, if any
  const [result, setResult] = useState(null); // { attempt, status: 'saving' | 'saved' | 'error', error }
  const [prefill, setPrefill] = useState(null); // { certId, seed, csvHash, csvName } for "retake with same seed"

  const startExam = (s) => {
    setSession(s);
    setView('exam');
  };

  const finishExam = (finalSession, reason) => {
    const attempt = buildAttempt(finalSession, reason, findCert(finalSession.certId));
    clearSession();
    setSession(null);
    setResult({ attempt, status: 'saving' });
    setView('results');
    saveAttempt(attempt)
      .then(() => setResult({ attempt, status: 'saved' }))
      .catch((err) => setResult({ attempt, status: 'error', error: err.message }));
  };

  const retake = (attempt) => {
    setPrefill({
      certId: attempt.certId,
      seed: attempt.seed,
      csvHash: attempt.csvHash,
      csvName: attempt.csvName,
    });
    setView('setup');
  };

  const discard = () => {
    clearSession();
    setSession(null);
  };

  const goSetup = () => {
    setPrefill(null);
    setView('setup');
  };

  if (view === 'exam' && session) {
    return <Exam session={session} onFinish={finishExam} />;
  }

  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={goSetup}>
          AWS Exam Simulator <small>practice sets, seeded and scored</small>
        </button>
        <nav className="topnav">
          <button className="btn btn-ghost" onClick={goSetup}>New exam</button>
          <button className="btn btn-ghost" onClick={() => setView('history')}>History</button>
        </nav>
      </header>

      {view === 'setup' && (
        <Setup
          key={prefill ? `${prefill.certId}:${prefill.seed}` : 'fresh'}
          session={session}
          prefill={prefill}
          onStart={startExam}
          onResume={() => setView('exam')}
          onDiscard={discard}
        />
      )}
      {view === 'results' && result && (
        <Results
          attempt={result.attempt}
          status={result.status}
          error={result.error}
          onNew={goSetup}
          onRetake={() => retake(result.attempt)}
          onHistory={() => setView('history')}
        />
      )}
      {view === 'history' && <History onRetake={retake} />}
    </>
  );
}
