import { Fragment, useEffect, useMemo, useState } from 'react';
import { deleteAttempt, listAttempts } from '../lib/api.js';
import { dateTime, duration } from '../lib/format.js';
import AttemptReview from './Review.jsx';
import { DomainBars } from './Results.jsx';

export default function History({ onRetake }) {
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    listAttempts()
      .then((list) => setAttempts([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch((e) => setError(e.message));
  }, []);

  const stats = useMemo(() => {
    if (!attempts?.length) return null;
    const scores = attempts.map((a) => a.scaledScore);
    return {
      count: attempts.length,
      best: Math.max(...scores),
      avg: Math.round(scores.reduce((s, n) => s + n, 0) / scores.length),
      passRate: Math.round((100 * attempts.filter((a) => a.passed).length) / attempts.length),
    };
  }, [attempts]);

  // Questions missed most often across attempts (same file = same csvHash + question id).
  const missed = useMemo(() => {
    const map = new Map();
    for (const at of attempts || []) {
      for (const a of at.answers) {
        const key = `${at.csvHash}:${a.id}`;
        const m = map.get(key) || { text: a.text, seen: 0, wrong: 0 };
        m.seen += 1;
        if (!a.isCorrect) m.wrong += 1;
        map.set(key, m);
      }
    }
    return [...map.values()]
      .filter((m) => m.wrong > 0)
      .sort((x, y) => y.wrong / y.seen - x.wrong / x.seen || y.seen - x.seen)
      .slice(0, 8);
  }, [attempts]);

  async function remove(a) {
    if (!window.confirm(`Delete the attempt from ${dateTime(a.createdAt)} (seed ${a.seed})? This can't be undone.`)) return;
    try {
      await deleteAttempt(a.id);
      setAttempts((list) => list.filter((x) => x.id !== a.id));
      if (open === a.id) setOpen(null);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="page stack">
      <div className="row">
        <h1 className="grow">History</h1>
        {attempts?.length > 0 && (
          <a className="btn" href="/api/export">Download database (JSON)</a>
        )}
      </div>

      {error && <div className="notice notice-bad">{error}</div>}
      {!attempts && !error && <p className="muted">Loading…</p>}

      {attempts && attempts.length === 0 && (
        <div className="card empty">
          <h2>No attempts yet</h2>
          <p className="muted">Finish an exam and it will show up here with its seed and every answer.</p>
        </div>
      )}

      {stats && (
        <div className="stat-grid" style={{ marginTop: 0 }}>
          <div className="fact"><b>{stats.count}</b><span>attempts</span></div>
          <div className="fact"><b>{stats.best}</b><span>best score</span></div>
          <div className="fact"><b>{stats.avg}</b><span>average score</span></div>
          <div className="fact"><b>{stats.passRate}%</b><span>pass rate</span></div>
        </div>
      )}

      {attempts && attempts.length > 0 && (
        <section className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="hist-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exam</th>
                <th className="hide-sm">Seed</th>
                <th>Score</th>
                <th className="hide-sm">Correct</th>
                <th className="hide-sm">Time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <Fragment key={a.id}>
                  <tr>
                    <td>{dateTime(a.createdAt)}</td>
                    <td>{a.certCode}</td>
                    <td className="mono hide-sm">{a.seed}</td>
                    <td className="num">
                      <b>{a.scaledScore}</b>{' '}
                      <span className={`chip ${a.passed ? 'ok' : 'bad'}`}>{a.passed ? 'Pass' : 'Not yet'}</span>
                    </td>
                    <td className="num hide-sm">{a.scoredCorrect}/{a.scoredCount}</td>
                    <td className="num hide-sm">{duration(a.timeUsedSec)}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button className="btn" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                          {open === a.id ? 'Hide' : 'Details'}
                        </button>
                        <button className="btn" onClick={() => onRetake(a)}>Replay seed</button>
                        <button className="btn btn-danger" onClick={() => remove(a)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                  {open === a.id && (
                    <tr>
                      <td colSpan="7" className="attempt-detail">
                        <div className="stack">
                          <p className="muted small">
                            Question set: {a.csvName} · seed <span className="mono">{a.seed}</span> · {a.answeredCount} of {a.totalQuestions} answered
                          </p>
                          {a.domainBreakdown?.length > 0 && <DomainBars attempt={a} />}
                          <AttemptReview attempt={a} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {missed.length > 0 && (
        <section className="card stack">
          <h2>Questions you miss most</h2>
          <table className="review-table">
            <thead><tr><th>Question</th><th>Missed</th></tr></thead>
            <tbody>
              {missed.map((m, i) => (
                <tr key={i}>
                  <td>{m.text.length > 110 ? `${m.text.slice(0, 110)}…` : m.text}</td>
                  <td className="mono">{m.wrong} of {m.seen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
