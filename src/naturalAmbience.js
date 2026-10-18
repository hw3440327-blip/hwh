// Original procedural ambience: filtered air, irregular surf and small surface
// transients. No field-recording claims and no external sound service.
export function createNaturalBed(context, kind) {
  const rate = Math.min(context.sampleRate, 24000);
  const seconds = 23.7;
  const length = Math.ceil(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  const phases = Array.from({ length: 5 }, () => Math.random() * Math.PI * 2);
  const events = [];
  const eventCount = kind === 'rain' ? 100 : kind === 'sea' ? 9 : 18;
  for (let i = 0; i < eventCount; i++) events.push({
    at: Math.random() * seconds, duration: kind === 'sea' ? 1.8 + Math.random() * 3.2 : .04 + Math.random() * .5,
    gain: .15 + Math.random() * .5, pan: Math.random(),
  });
  const envelope = Array.from({ length: Math.ceil(length / 128) }, (_, block) => {
    const t = block * 128 / rate;
    const breeze = .55 + .19 * Math.sin(t * .37 + phases[0]) + .12 * Math.sin(t * .83 + phases[1]) + .08 * Math.sin(t * .17 + phases[2]);
    let detail = 0;
    for (const e of events) {
      const x = (t - e.at) / e.duration;
      if (x >= 0 && x < 1) detail += e.gain * Math.sin(Math.PI * x) ** (kind === 'sea' ? 1.4 : 3);
    }
    return { breeze, detail };
  });
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0, middle = 0, dark = 0;
    for (let i = 0; i < length; i++) {
      const random = Math.random() * 2 - 1;
      low = low * .985 + random * .015;
      middle = middle * .76 + random * .24;
      dark = dark * .997 + random * .003;
      const { breeze, detail } = envelope[Math.floor(i / 128)];
      if (kind === 'rain') data[i] = ((middle - low) * (.38 + breeze * .22) + random * detail * .14) * .68;
      else if (kind === 'sea') data[i] = low * (2.6 + detail * 5) * breeze + (middle - low) * detail * .19;
      else if (kind === 'garden') data[i] = (low * 1.6 + (middle - low) * (.09 + detail * .35)) * breeze;
      else data[i] = dark * 2.8 * breeze + middle * detail * .08;
    }
    // Very short equal-power taper keeps the long, nonperiodic loop click-free.
    const seam = Math.floor(rate * .025);
    for (let i = 0; i < seam; i++) {
      const gain = Math.sin(i / seam * Math.PI / 2);
      data[i] *= gain; data[length - i - 1] *= gain;
    }
  }
  return buffer;
}
