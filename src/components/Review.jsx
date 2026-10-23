import { useState } from 'react';
import { duration } from '../lib/format.js';

const statusOf = (a) => (a.selected.length === 0 ? 'unanswered' : a.isCorrect ? 'correct' : 'incorrect');

// Question-by-question review, used by both the results page and the history page.
export default function AttemptReview({ attempt }) {
  const [filter, setFilter] = useState('all');
  const list = attempt.answers;
  const counts = {
    all: list.length,
    incorrect: list.filter((a) => statusOf(a) !== 'correct').length,
    flagged: list.filter((a) => a.flagged).length,
    unscored: list.filter((a) => !a.scored).length,
  };
  const shown = list.filter((a) =>
    filter === 'incorrect' ? statusOf(a) !== 'correct'
      : filter === 'flagged' ? a.flagged
        : filter === 'unscored' ? !a.scored
          : true,
  );

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        {[
          ['all', 'All'],
          ['incorrect', 'Missed or unanswered'],
          ['flagged', 'Flagged'],
          ['unscored', 'Not counted'],
        ].map(([k, label]) => (
          <button key={k} className="tab" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label} ({counts[k]})
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="muted">No questions match this filter.</p>}

      {shown.map((a) => {
        const st = statusOf(a);
        return (
          <details key={a.id + a.position} className="q-item">
            <summary>
              <b>{a.position}</b>
              <span className="sum-text">{a.text}</span>
              {a.flagged && <span className="chip warn">Flagged</span>}
              {!a.scored && <span className="chip dim">Not counted</span>}
              <span className={`chip ${st === 'correct' ? 'ok' : 'bad'}`}>
                {st === 'correct' ? 'Correct' : st === 'unanswered' ? 'Unanswered' : 'Incorrect'}
              </span>
            </summary>
            <div className="q-body">
              <p style={{ whiteSpace: 'pre-wrap' }}>{a.text}</p>
              {a.options.map((o) => {
                const isCorrect = a.correct.includes(o.key);
                const picked = a.selected.includes(o.key);
                return (
                  <div key={o.key} className={`ropt${isCorrect ? ' is-correct' : picked ? ' is-wrong' : ''}`}>
                    <span className={`bubble${a.correct.length > 1 ? ' square' : ''}`}>{o.key}</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{o.text}</span>
                    <span className="tag">
                      {isCorrect && picked ? 'Your answer · correct'
                        : isCorrect ? 'Correct answer'
                          : picked ? 'Your answer' : ''}
                    </span>
                  </div>
                );
              })}
              {a.explanation && <div className="explain">{a.explanation}</div>}
              <p className="muted small" style={{ marginTop: 10 }}>
                {a.domain ? `${a.domain} · ` : ''}
                {a.timeSpentSec > 0 ? `${duration(a.timeSpentSec)} on this question` : 'No time recorded'}
              </p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
