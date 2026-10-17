import React from 'react';
import { Headphones, Music2, Play, Sprout, Waves } from 'lucide-react';
import './audio-settings.css';

function Switch({ label, checked, onChange, disabled = false }) {
  return <button type="button" className={`toggle ${checked ? 'checked' : ''}`} role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange}><span /></button>;
}

function Volume({ label, value, onChange }) {
  return <label className="audio-volume"><span>{label}<small>{Math.round(value * 100)}%</small></span><input type="range" aria-label={label} min="0" max="1" step="0.02" value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

export default function AudioSettings({ music, sound, narration, autoNarration, onAutoNarration }) {
  const hasVoice = narration.supported && narration.voices.length > 0;
  const hasLocalVoice = narration.voices.some(voice => voice.localService);
  const selectedVoice = narration.voices.find(voice => voice.id === narration.voiceId) || narration.voices[0];
  const voiceMessage = !narration.supported
    ? '这个浏览器暂不支持故事朗读，可以试试新版 Edge 或 Chrome。'
    : !hasVoice
      ? '这台电脑还没有可用的中文声音。可以先在系统的语言与语音设置里添加中文语音包，再重新打开游戏。'
      : selectedVoice?.localService
        ? '这是这台电脑的本机中文音色，通常不需要联网。可以先试听，确认它能在这里播放。'
        : '这是浏览器提供的联网音色。出现在列表里，不代表语音服务当前能连接或播放；听不到时，可以重试或改用本机中文声音。';

  return <section className="audio-settings" aria-label="配乐、环境声与故事朗读">
    <div className="audio-setting-card">
      <div className="audio-card-heading"><Music2 size={22} strokeWidth={1.2} aria-hidden="true" /><div><strong>小镇配乐</strong><small>原创钢琴与柔和弦音 · {music.trackTitle}</small></div><Switch label="背景音乐" checked={music.enabled} onChange={music.toggle} /></div>
      <Volume label="配乐音量" value={music.volume} onChange={music.setVolume} />
      <p className="audio-gentle-note">有人讲故事时，旋律会轻轻退到后面。</p>
    </div>

    <div className="audio-setting-card">
      <div className="audio-card-heading"><Waves size={22} strokeWidth={1.2} aria-hidden="true" /><div><strong>身边的声音</strong><small>跟着天气和地点变化的海风、细雨与屋内轻响</small></div><Switch label="环境声音" checked={sound.enabled} onChange={sound.toggle} /></div>
      <Volume label="环境音量" value={sound.volume} onChange={sound.setVolume} />
    </div>

    <div className="audio-setting-card audio-narration-card">
      <div className="audio-card-heading"><Headphones size={22} strokeWidth={1.2} aria-hidden="true" /><div><strong>把故事读给你听</strong><small>一段一段慢慢讲，遇到选择时等你决定</small></div><Switch label="故事朗读" checked={narration.enabled} onChange={narration.toggle} disabled={!hasVoice} /></div>
      <p className="audio-voice-help" role="status">{voiceMessage}</p>
      {hasVoice && <>
        <div className="audio-voice-select"><label htmlFor="story-voice">讲述的声音</label><select id="story-voice" aria-label="讲述的声音" value={selectedVoice?.id || ''} onChange={event => narration.setVoiceId(event.target.value)}>{narration.voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}{voice.localService ? ' · 本机' : ' · 联网'}{narration.voiceHealth?.[voice.id]?.status === 'failed' ? ' · 刚才未播出' : ''}</option>)}</select></div>
        <button type="button" className="audio-preview" onClick={() => narration.preview()}><Play size={14} strokeWidth={1.4} aria-hidden="true" />试听这一种声音</button>
        {narration.lastError && <div className="audio-voice-error" role="alert">
          <strong>这次朗读没有成功播放</strong>
          <p>{narration.lastError.message}</p>
          <small>刚才选择的声音：{narration.lastError.voiceName || selectedVoice?.name || '中文声音'}</small>
          <div className="audio-voice-recovery">
            <button type="button" onClick={() => narration.preview()}><Play size={14} strokeWidth={1.4} aria-hidden="true" />再试听一次</button>
            {hasLocalVoice && <button type="button" onClick={() => narration.tryLocalVoice()}>改用本机中文声音</button>}
          </div>
          {!hasLocalVoice && <p className="audio-local-help">这台电脑暂未列出本机中文声音。若使用 Windows，可在“设置 → 时间和语言 → 语音”中添加中文声音，安装完成后重新打开游戏。</p>}
        </div>}
        <label className="audio-volume"><span>讲述的速度<small>{Number(narration.rate).toFixed(2)}×</small></span><input type="range" aria-label="朗读速度" min="0.75" max="1.1" step="0.05" value={narration.rate} onChange={event => narration.setRate(Number(event.target.value))} /></label>
        <Volume label="朗读音量" value={narration.volume} onChange={narration.setVolume} />
        <div className="audio-auto-read"><div><strong>让故事接着讲</strong><small>读完本段后继续下一段，选项由你亲自决定</small></div><Switch label="连续讲述" checked={autoNarration} onChange={onAutoNarration} /></div>
        <p className="audio-narration-status" aria-live="polite"><Sprout size={13} strokeWidth={1.2} aria-hidden="true" />{narration.status === 'error' ? '这次没有播出声音，可以先试听或换一个音色' : narration.status === 'starting' ? '正在准备声音，请稍等一下' : narration.speaking ? '正在轻声讲述' : narration.enabled ? '回到故事，就从这一段继续' : '开启朗读后，故事与风景讲解都会有声音'}</p>
      </>}
    </div>
  </section>;
}
