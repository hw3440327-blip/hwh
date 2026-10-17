import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Feather, Flower2, Mail, MailOpen } from 'lucide-react';
import { letters, unlockedLetters } from './letters.js';
import { scenes } from './story.js';
import './letters.css';

const personalize = (text, name) => text.replaceAll('{name}', name || '旅人');

export default function LettersPanel({ game, replies, onReply, onNotify }) {
  const [openId, setOpenId] = useState(null);
  const [replyingId, setReplyingId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const focusReply = useRef(null);
  const replyNodes = useRef({});
  const available = unlockedLetters(game);
  const savedReplies = replies ?? game?.letterReplies ?? {};
  const replyCount = available.filter((letter) => savedReplies[letter.id]).length;
  const isEarlierLetter = (letter) => scenes[game?.sceneId]?.age > scenes[letter.unlock.scene]?.age;

  useEffect(() => {
    const letterId = focusReply.current;
    if (letterId && savedReplies[letterId] && replyNodes.current[letterId]) {
      replyNodes.current[letterId].focus({ preventScroll: true });
      focusReply.current = null;
    }
  }, [savedReplies]);

  async function writeReply(letter, reply) {
    if (savedReplies[letter.id] || replyingId || typeof onReply !== 'function') return;
    setReplyingId(letter.id);
    setFeedback('');
    focusReply.current = letter.id;
    try {
      await onReply(letter.id, { id: reply.id, text: reply.text });
      setFeedback(isEarlierLetter(letter) ? '补写的话已收好，留在当年的信页里。' : '回信已收好，留在这一段人生里。');
    } catch (error) {
      focusReply.current = null;
      const message = error instanceof Error ? error.message : '这一页暂时没能收好，请稍后再试。';
      setFeedback(message);
      onNotify?.(message);
    } finally {
      setReplyingId(null);
    }
  }

  return (
    <section className="little-letters" aria-labelledby="little-letters-heading">
      <header className="little-letters-heading">
        <div>
          <span className="little-letters-eyebrow">LETTERS FROM THE TOWN</span>
          <h2 id="little-letters-heading"><Mail size={20} strokeWidth={1.3} />小镇来信</h2>
          <p>隔着几条街，或是很多年，有人把近况写给你。</p>
        </div>
        {available.length > 0 && <span className="little-letters-count">{available.length} 封来信 · {replyCount} 封回信</span>}
      </header>

      <div className="little-letters-list">
        {available.map((letter) => {
          const expanded = openId === letter.id;
          const historical = isEarlierLetter(letter);
          const sentReply = letter.replies.find((reply) => reply.id === savedReplies[letter.id]);
          return (
            <article key={letter.id} className={`little-letters-card${expanded ? ' is-open' : ''}`}>
              <button
                type="button"
                className="little-letters-envelope"
                aria-expanded={expanded}
                aria-controls={`letter-body-${letter.id}`}
                onClick={() => setOpenId(expanded ? null : letter.id)}
              >
                <span className="little-letters-stamp" aria-hidden="true"><Flower2 size={23} strokeWidth={1} /><small>栖屿</small></span>
                <span className="little-letters-envelope-copy">
                  <span className="little-letters-meta">{letter.from} <span>·</span> {letter.date}</span>
                  <strong>{letter.subject}</strong>
                  <span className="little-letters-preview">{expanded ? '把信慢慢读完' : personalize(letter.paragraphs[0], game?.name)}</span>
                </span>
                <span className="little-letters-open-state">
                  {sentReply ? <Check size={15} /> : expanded ? <MailOpen size={16} /> : <Mail size={16} />}
                  <small>{sentReply ? '已回信' : expanded ? '收起' : '拆开'}</small>
                  <ChevronDown className={expanded ? 'is-turned' : ''} size={14} />
                </span>
              </button>

              <div id={`letter-body-${letter.id}`} className="little-letters-body" hidden={!expanded}>
                {historical && <p className="little-letters-archive-note">这是 {scenes[letter.unlock.scene].age} 岁时收到的信。{sentReply ? '回信也收在这一页里，和当时的日子放在一起。' : '重读到这里，也可以补写当时没说出口的话。'}</p>}
                <div className="little-letters-prose">
                  {letter.paragraphs.map((paragraph, index) => <p key={index}>{personalize(paragraph, game?.name)}</p>)}
                  <div className="little-letters-signature"><span>{letter.from}</span><small>{letter.date}</small></div>
                  {letter.ps && <p className="little-letters-ps">附言：{personalize(letter.ps, game?.name)}</p>}
                </div>
                <div className="little-letters-reply">
                  {sentReply ? <div className="little-letters-kept" tabIndex={-1} ref={(node) => { replyNodes.current[letter.id] = node; }} aria-label="回信已收好">
                    <span><Check size={14} />回信已收好</span>
                    <p>{personalize(sentReply.text, game?.name)}</p>
                    <small>{historical ? '留在当年的信页里，随旅程一起保存。' : '留在这本故事里，随旅程一起保存。'}</small>
                  </div> : <>
                    <h3><Feather size={15} strokeWidth={1.3} />{historical ? '补写当时想说的话' : '写下回信'}</h3>
                    <div className="little-letters-reply-options">
                      {letter.replies.map((reply) => <button key={reply.id} type="button" disabled={Boolean(replyingId) || typeof onReply !== 'function'} onClick={() => writeReply(letter, reply)}>
                        {personalize(reply.text, game?.name)}<Feather size={13} strokeWidth={1.3} />
                      </button>)}
                    </div>
                    <small className="little-letters-local-note">选一句想说的话，留在故事里；不会向外发送。</small>
                  </>}
                </div>
              </div>
            </article>
          );
        })}

        {available.length < letters.length && <div className="little-letters-pending"><Mail size={24} strokeWidth={1} /><span>下一封信，还在路上。</span></div>}
      </div>
      <p className="little-letters-feedback" role="status" aria-live="polite">{feedback}</p>
    </section>
  );
}
