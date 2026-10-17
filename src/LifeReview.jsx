import { ArrowRight, BookOpen, ChevronRight, Flower2, Leaf, Sprout } from 'lucide-react';
import { chapters, scenes } from './story.js';
import { origins } from './origins.js';
import { getSceneParagraphs } from './engine.js';
import { artwork } from './visuals.js';
import './life-review.css';

export function lifeDirection(game) {
  if (game.flags.includes('route_return')) return '把小镇的从容，带回城市';
  if (game.flags.includes('route_bakery')) return '在面包房，接住一个个早晨';
  if (game.flags.includes('route_workshop')) return '让旧物，有机会继续陪伴';
  if (game.flags.includes('route_bookshop')) return '在书页与日常之间，找到自己的速度';
  return '给陌生的日子，留一点可能';
}

export default function LifeReview({ game, onContinue, onRecall }) {
  const scene = scenes[game.sceneId];
  const origin = origins.find(item => item.id === game.origin) || origins[0];
  const ordinaryMemories = game.memories.filter(memory => !memory.id.startsWith('echo:'));
  return <div className="life-review">
    <section className="life-review-intro">
      <div className="life-review-art"><img src={artwork.garden} alt="手绘动画中的海边花园，木长椅和远处安静的小镇" /><div /></div>
      <div className="life-review-intro-copy"><span className="eyebrow">THE DAYS THAT MADE YOU</span><h2>{game.name}，这是你走过的日子。</h2><p>{lifeDirection(game)}。</p><div className="life-review-numbers"><span><strong>{scene.age || 22}</strong>岁，走到这里</span><span><strong>{game.history.length}</strong>次，跟随心意</span><span><strong>{ordinaryMemories.length}</strong>段，珍藏的回忆</span></div></div>
    </section>
    <div className="life-origin-note"><Leaf size={19} strokeWidth={1.4} /><div><span>那时候，你是为了这个念头出发的</span><p>{origin.title}</p></div></div>
    <div className="life-review-timeline">
      {chapters.map((chapter, index) => {
        const visited = game.visited.map(id => scenes[id]).filter(item => item.chapter === index);
        const entries = game.history.filter(entry => scenes[entry.sceneId]?.chapter === index);
        const reached = visited.length > 0;
        const age = visited[0]?.age;
        return <section className={`life-chapter-card ${reached ? '' : 'yet-to-come'}`} key={chapter.id}>
          <div className="life-chapter-marker">{reached ? <Sprout size={16} strokeWidth={1.5} /> : <span />}</div>
          <div className="life-chapter-title"><span className="eyebrow">CHAPTER {String(index + 1).padStart(2, '0')}{age ? ` · ${age} 岁` : ''}</span><h3>{chapter.title}<span>{chapter.subtitle}</span></h3></div>
          {reached ? <><p>{(visited.at(-1).note || getSceneParagraphs({ ...game, sceneId: visited.at(-1).id })[0]).replaceAll('{name}', game.name)}</p><div className="life-chapter-decisions">{entries.slice(-2).map((entry, i) => <span key={i}><ChevronRight size={12} />{entry.choiceTitle}</span>)}</div>{entries.length > 0 && <button className="text-button" onClick={() => onRecall(index)}><BookOpen size={13} />翻看这一章</button>}</> : <p>这一页，还留着空白。日子会慢慢把它写满。</p>}
        </section>;
      })}
    </div>
    <div className="life-review-bottom"><Flower2 size={25} strokeWidth={1} /><p>{scene.ending ? '这一生，有遗憾，也有许多值得记得的人和事。' : '现在的你，还在故事里。接下来，也按自己的步子走。'}</p><button className="primary-button" onClick={onContinue}>{scene.ending ? '回到这一生的最后一页' : '继续写我的故事'}<ArrowRight size={16} /></button></div>
  </div>;
}
