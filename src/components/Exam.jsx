import { useCallback, useEffect, useRef, useState } from 'react';
import { findCert } from '../lib/certs.js';
import { saveSession } from '../lib/session.js';
import { clock } from '../lib/format.js';

function Timer({ endsAt, onExpire }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const fired = useRef(false);

  useEffect(() => {
    // Always derive the remaining time from the absolute end time, so background-tab
    // throttling or a sleeping laptop can't make the clock drift.
    const tick = () => {
      const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !fired.current) {
        fired.current = true;
        expireRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const cls = left <= 300 ? 'critical' : left <= 900 ? 'low' : '';
  return (
    <div className={`timer ${cls}`} role="timer" aria-label="Time remaining">
      {clock(left)}
    </div>
  );
}

export default function Exam({ session, onFinish }) {
  const { questions } = session;
  const cert = findCert(session.certId);

  const [answers, setAnswers] = useState(session.answers);
  const [flags, setFlags] = useState(session.flags);
  const [current, setCurrent] = useState(Math.min(session.current, questions.length - 1));
  const [mode, setMode] = useState('question'); // question | review
  const [filter, setFilter] = useState('all');
  const [confirming, setConfirming] = useState(false);

  // Per-question time tracking lives in refs: it isn't displayed, so no re-renders needed.
  const timeRef = useRef({ ...session.timeSpent });
  const visitRef = useRef(Date.now()); // null while on the review screen
  const currentRef = useRef(current);
  currentRef.current = current;
  const doneRef = useRef(false);

  const flush = useCallback(() => {
    if (visitRef.current == null) return;
    const now = Date.now();
    const id = questions[currentRef.current].id;
    timeRef.current[id] = (timeRef.current[id] || 0) + (now - visitRef.current);
    visitRef.current = now;
  }, [questions]);

  // Mirror progress to localStorage so a refresh can resume.
  useEffect(() => {
    saveSession({ ...session, answers, flags, current, timeSpent: timeRef.current });
  }, [session, answers, flags, current]);

  const finish = (reason) => {
    if (doneRef.current) return;
    doneRef.current = true;
    flush();
    onFinish({ ...session, answers, flags, current, timeSpent: { ...timeRef.current } }, reason);
  };

  const goTo = (i) => {
    flush();
    visitRef.current = Date.now();
    setCurrent(i);
    setMode('question');
  };

  const openReview = () => {
    flush();
    visitRef.current = null;
    setMode('review');
  };

  const q = questions[current];
  const selected = answers[q.id] || [];
  const need = q.correct.length;
  const atLimit = q.multi && selected.length >= need;

  const choose = (key) => {
    setAnswers((prev) => {
      const cur = prev[q.id] || [];
      if (!q.multi) return { ...prev, [q.id]: [key] };
      if (cur.includes(key)) return { ...prev, [q.id]: cur.filter((k) => k !== key) };
      if (cur.length >= need) return prev;
      return { ...prev, [q.id]: [...cur, key] };
    });
  };

  const clearAnswer = () => setAnswers((prev) => ({ ...prev, [q.id]: [] }));
  const toggleFlag = () => setFlags((prev) => ({ ...prev, [q.id]: !prev[q.id] }));

  const isAnswered = (x) => (answers[x.id] || []).length > 0;
  const unanswered = questions.filter((x) => !isAnswered(x)).length;
  const flagged = questions.filter((x) => flags[x.id]).length;

  const rows = questions
    .map((x, i) => ({ x, i }))
    .filter(({ x }) =>
      filter === 'unanswered' ? !isAnswered(x) : filter === 'flagged' ? flags[x.id] : true,
    );

  return (
    <div className="exam">
      <header className="exam-bar">
        <div className="exam-title">
          {cert.name}
          <small>
            Question {current + 1} of {questions.length}
          </small>
        </div>
        <div className="grow" />
        <Timer endsAt={session.endsAt} onExpire={() => finish('timeout')} />
        <button className="btn" onClick={openReview}>Review all</button>
        <button className="btn btn-end" onClick={() => setConfirming(true)}>End exam</button>
      </header>

      <div className="exam-body">
        {mode === 'question' ? (
          <main>
            <div className="q-head">
              <span className="q-no">Question {q.position}</span>
              <button className="btn flag-btn" aria-pressed={Boolean(flags[q.id])} onClick={toggleFlag}>
                {flags[q.id] ? 'Flagged for review' : 'Flag for review'}
              </button>
            </div>

            <p className="q-text">{q.text}</p>
            {q.multi && (
              <p className="q-hint">
                Choose {need}. ({selected.length} of {need} selected)
              </p>
            )}

            <div className="opts" role={q.multi ? 'group' : 'radiogroup'} aria-label="Answer options">
              {q.options.map((o) => {
                const sel = selected.includes(o.key);
                const locked = atLimit && !sel;
                return (
                  <label key={o.key} className={`opt${sel ? ' sel' : ''}${locked ? ' locked' : ''}`}>
                    <input
                      type={q.multi ? 'checkbox' : 'radio'}
                      name={q.id}
                      checked={sel}
                      disabled={locked}
                      onChange={() => choose(o.key)}
                    />
                    <span className={`bubble${q.multi ? ' square' : ''}`}>{o.key}</span>
                    <span className="opt-text">{o.text}</span>
                  </label>
                );
              })}
            </div>

            <div className="q-nav">
              <button className="btn" disabled={current === 0} onClick={() => goTo(current - 1)}>Previous</button>
              {current < questions.length - 1 ? (
                <button className="btn btn-primary" onClick={() => goTo(current + 1)}>Next</button>
              ) : (
                <button className="btn btn-primary" onClick={openReview}>Review answers</button>
              )}
              <div className="grow" />
              {selected.length > 0 && (
                <button className="btn btn-ghost" onClick={clearAnswer}>Clear answer</button>
              )}
            </div>
          </main>
        ) : (
          <main>
            <h2>Review your answers</h2>
            <p className="muted" style={{ margin: '6px 0 14px' }}>
              {unanswered} unanswered, {flagged} flagged. Select a question to go back to it.
            </p>
            <div className="tabs" style={{ marginBottom: 12 }}>
              {[
                ['all', `All (${questions.length})`],
                ['unanswered', `Unanswered (${unanswered})`],
                ['flagged', `Flagged (${flagged})`],
              ].map(([k, label]) => (
                <button key={k} className="tab" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
            <table className="review-table">
              <thead>
                <tr><th>No.</th><th>Question</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map(({ x, i }) => (
                  <tr key={x.id} className="clickable" onClick={() => goTo(i)}>
                    <td>{x.position}</td>
                    <td>{x.text.length > 90 ? `${x.text.slice(0, 90)}…` : x.text}</td>
                    <td>
                      {isAnswered(x) ? 'Answered' : <b>Unanswered</b>}
                      {flags[x.id] ? ' · Flagged' : ''}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan="3" className="muted">Nothing here.</td></tr>
                )}
              </tbody>
            </table>
            <div className="q-nav">
              <button className="btn" onClick={() => goTo(current)}>Back to question {current + 1}</button>
              <button className="btn btn-primary" onClick={() => setConfirming(true)}>End exam</button>
            </div>
          </main>
        )}

        <aside className="palette" aria-label="Question navigator">
          <h3>Answer sheet</h3>
          <div className="sheet">
            {questions.map((x, i) => (
              <button
                key={x.id}
                className={`cell${isAnswered(x) ? ' done' : ''}${flags[x.id] ? ' flag' : ''}${mode === 'question' && i === current ? ' cur' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Question ${x.position}${isAnswered(x) ? ', answered' : ', unanswered'}${flags[x.id] ? ', flagged' : ''}`}
              >
                {x.position}
              </button>
            ))}
          </div>
          <div className="legend">
            <span><i className="done" />Answered</span>
            <span><i />Not answered</span>
            <span><i className="flag" />Flagged for review</span>
          </div>
        </aside>
      </div>

      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title">
          <div className="modal">
            <h2 id="end-title">End the exam?</h2>
            <ul>
              <li>{unanswered} question{unanswered === 1 ? '' : 's'} unanswered</li>
              <li>{flagged} flagged for review</li>
            </ul>
            <p className="muted small" style={{ marginTop: 10 }}>You can't return to the exam once it has ended.</p>
            <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirming(false)}>Keep working</button>
              <button className="btn btn-primary" onClick={() => finish('submitted')}>End exam and see results</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
