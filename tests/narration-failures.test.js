import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chineseVoices, chooseNarrationVoice, narrationFailure, narrationStartTimeout,
  normalizeNarrationPreferences, readNarrationPreferences,
} from '../src/narration.js';

const localVoice = {
  name: 'Microsoft Huihui', lang: 'zh-CN', voiceURI: 'local-huihui', localService: true,
};
const onlineVoice = {
  name: 'Microsoft Xiaoxiao Online (Natural)', lang: 'zh-CN', voiceURI: 'cloud-xiaoxiao', localService: false,
};

test('首次选择优先本机中文；明确保存过的联网音色选择仍被尊重', () => {
  const voices = chineseVoices([onlineVoice, localVoice]);
  assert.equal(voices[0].localService, true, '云端自然音色的名称评分不能压过本机默认');
  assert.equal(chooseNarrationVoice(voices).id, voices[0].id);
  const cloud = voices.find((voice) => !voice.localService);
  const saved = readNarrationPreferences({ getItem: () => JSON.stringify({ voiceId: cloud.id, rate: 0.9, volume: 0.85 }) });
  assert.equal(chooseNarrationVoice(voices, saved.voiceId).id, cloud.id);
  assert.equal(chooseNarrationVoice(voices, 'an-uninstalled-voice').localService, true);
  assert.equal(chooseNarrationVoice([]), null);
});

test('没有本机中文时仍只呈现真实中文声音，不用英语冒充可用旁白', () => {
  const english = { name: 'English Local', lang: 'en-US', voiceURI: 'en', localService: true };
  const cloudOnly = chineseVoices([english, onlineVoice]);
  assert.equal(cloudOnly.length, 1);
  assert.equal(chooseNarrationVoice(cloudOnly).name, onlineVoice.name);
  assert.equal(chooseNarrationVoice(chineseVoices([english])), null);
});

test('联网启动允许十五秒，本机允许八秒，均有界而不无限重试', () => {
  assert.equal(narrationStartTimeout(localVoice), 8000);
  assert.equal(narrationStartTimeout(onlineVoice), 15000);
  assert.equal(narrationStartTimeout(undefined), 15000);
});

test('网络错误绑定实际音色，说明可能连接失败而不武断断言地区或服务根因', () => {
  const [voice] = chineseVoices([onlineVoice]);
  const failure = narrationFailure('network', voice);
  assert.deepEqual({ code: failure.code, voiceId: failure.voiceId, voiceName: failure.voiceName, localService: failure.localService }, {
    code: 'network', voiceId: voice.id, voiceName: onlineVoice.name, localService: false,
  });
  assert.match(failure.message, /浏览器未能播放该联网音色，可能语音服务连接失败/);
  assert.doesNotMatch(failure.message, /VPN|防火墙|被墙|GFW|HTTPS|麦克风/);
});

test('权限、设备繁忙、硬件与合成服务错误按浏览器报告分别说明', () => {
  const [voice] = chineseVoices([localVoice]);
  const meanings = [
    ['not-allowed', /没有允许这次朗读/],
    ['audio-busy', /语音通道正忙/],
    ['audio-hardware', /音频输出设备/],
    ['voice-unavailable', /音色当前不可用/],
    ['language-unavailable', /朗读中文/],
    ['synthesis-unavailable', /语音合成服务暂时不可用/],
    ['synthesis-failed', /原因尚不明确/],
  ];
  for (const [code, meaning] of meanings) {
    const failure = narrationFailure(code, voice);
    assert.equal(failure.code, code);
    assert.match(failure.message, meaning);
    assert.doesNotMatch(failure.message, /联网音色|可能语音服务连接失败|朗读权限|麦克风权限/);
  }
});

test('正常中断不是故障，未知和静默完成不伪装成网络错误', () => {
  assert.equal(narrationFailure('interrupted', localVoice), null);
  assert.equal(narrationFailure('canceled', onlineVoice), null);
  const unknown = narrationFailure('some-future-browser-code', onlineVoice);
  assert.equal(unknown.code, 'unknown');
  assert.match(unknown.message, /没有说明具体原因/);
  assert.doesNotMatch(unknown.message, /网络|连接失败/);
  const neverStarted = narrationFailure('not-started', onlineVoice);
  assert.match(neverStarted.message, /没有开始播放/);
  assert.doesNotMatch(neverStarted.message, /连接失败/);
});

test('缺少本机语音给安装帮助，超时不保证切本机一定成功', () => {
  const missing = narrationFailure('no-local-voice');
  assert.equal(missing.voiceId, '');
  assert.equal(missing.localService, null);
  assert.match(missing.message, /系统语音设置里安装中文语音包/);
  assert.match(narrationFailure('start-timeout', localVoice).message, /本机中文声音未能及时启动/);
  assert.match(narrationFailure('start-timeout', onlineVoice).message, /可能/);
  assert.deepEqual(normalizeNarrationPreferences({ voiceId: 'cloud-choice', rate: 0.9, volume: 0.6 }), {
    voiceId: 'cloud-choice', rate: 0.9, volume: 0.6,
  });
});
