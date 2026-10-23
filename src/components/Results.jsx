import AttemptReview from './Review.jsx';
import { duration, dateTime } from '../lib/format.js';

function download(attempt) {
  const blob = new Blob([JSON.stringify(attempt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attempt-${attempt.seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DomainBars({ attempt }) {
  if (!attempt.domainBreakdown?.length) return null;
  return (
    <div className="bars">
      {attempt.domainBreakdown.map((d) => {
        const pct = d.total ? Math.round((100 * d.correct) / d.total) : 0;
        return (
          <div key={d.domain}>
            <div className="bar-label">
              <span>{d.domain}</span>
              <span className="muted">{d.correct} of {d.total} · {pct}%</span>
            </div>
            <div className="bar"><span style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export default function Results({ attempt, status, error, onNew, onRetake, onHistory }) {
  const a = attempt;
  const unscoredTotal = a.totalQuestions - a.scoredCount;
  return (
    <main className="page stack">
      <div>
        <h1>Exam results</h1>
        <p className="muted">
          {a.certName} ({a.certCode}) · {dateTime(a.createdAt)} · seed <span className="mono">{a.seed}</span>
        </p>
      </div>

      {status === 'saving' && <div className="notice notice-info">Saving to the results database…</div>}
      {status === 'saved' && <div className="notice notice-ok">Saved to the results database (<span className="mono">data/db.json</span>).</div>}
      {status === 'error' && (
        <div className="notice notice-bad">
          <b>This attempt was not saved.</b> {error}
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => download(a)}>Download attempt as JSON</button>
          </div>
        </div>
      )}
      {a.finishReason === 'timeout' && (
        <div className="notice notice-warn">Time ran out. Your answers at that moment were scored.</div>
      )}

      <section className="card">
        <div className="score-card">
          <div className="score-num">
            {a.scaledScore}
            <small> / 1000</small>
          </div>
          <div>
            <span className={`verdict ${a.passed ? 'pass' : 'fail'}`}>{a.passed ? 'Pass' : 'Not yet'}</span>
            <p className="muted">
              Passing score is {a.passingScore}. The scaled score is estimated from your scored answers; AWS's own
              scaling isn't published, so treat it as a guide.
            </p>
          </div>
        </div>
        <div className="stat-grid">
          <div className="fact"><b>{a.scoredCorrect} / {a.scoredCount}</b><span>scored questions correct</span></div>
          <div className="fact"><b>{a.unscoredCorrect} / {unscoredTotal}</b><span>unscored correct (not counted)</span></div>
          <div className="fact"><b>{a.answeredCount} / {a.totalQuestions}</b><span>answered</span></div>
          <div className="fact"><b>{duration(a.timeUsedSec)}</b><span>of {duration(a.durationSec)} used</span></div>
        </div>
      </section>

      {a.domainBreakdown?.length > 0 && (
        <section className="card stack">
          <h2>Score by domain</h2>
          <DomainBars attempt={a} />
        </section>
      )}

      <div className="row">
        <button className="btn btn-primary" onClick={onNew}>New exam</button>
        <button className="btn" onClick={onRetake}>Retake with the same seed</button>
        <button className="btn" onClick={onHistory}>View history</button>
      </div>

      <section>
        <h2 style={{ marginBottom: 12 }}>Review</h2>
        <AttemptReview attempt={a} />
      </section>
    </main>
  );
}
