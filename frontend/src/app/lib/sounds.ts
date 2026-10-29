/**
 * Sons sutis da interface.
 *
 * Gerados na hora com a Web Audio API — nada de arquivos de áudio para baixar.
 * São toques curtos e discretos (um "toc" ao trocar de menu, um "pop" ao abrir
 * um livro), pensados para dar resposta tátil sem irritar. Respeitam a
 * preferência `soundsOn` das configurações e ficam quietos se a pessoa pediu
 * para reduzir movimento.
 *
 * O navegador só deixa tocar áudio depois de um gesto do usuário, então o
 * contexto é criado preguiçosamente no primeiro toque.
 */

type Ctx = AudioContext & { mybooksMaster?: GainNode };

let ctx: Ctx | null = null;
let unlocked = false;

const SETTINGS_KEY = "mybooks-settings";

function soundsEnabled(): boolean {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (s.soundsOn === false) return false;
    if (s.reduceMotion === true) return false; // quem reduz movimento também quer silêncio
    return true;
  } catch {
    return true;
  }
}

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC() as Ctx;
    const master = ctx.createGain();
    master.gain.value = 0.5; // teto geral: os sons já nascem baixos, isso é só um limite
    master.connect(ctx.destination);
    ctx.mybooksMaster = master;
  }
  return ctx;
}

/**
 * Libera o áudio no primeiro gesto do usuário — o navegador exige isso.
 * Chamado uma vez pela casca do app.
 */
export function primeSounds(): void {
  if (unlocked) return;
  const resume = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    unlocked = true;
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
  };
  window.addEventListener("pointerdown", resume, { once: false });
  window.addEventListener("keydown", resume, { once: false });
}

interface Blip {
  freq: number;
  toFreq?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function blip({ freq, toFreq, dur, type = "sine", gain = 0.09, delay = 0 }: Blip): void {
  const c = getCtx();
  if (!c || !c.mybooksMaster) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
  // Envelope suave: sobe rápido e cai — sem clique seco no começo/fim.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.mybooksMaster);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function play(fn: () => void): void {
  if (!soundsEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  try {
    fn();
  } catch {
    /* áudio é acessório: nunca deve estourar */
  }
}

/** Toque leve — troca de aba/menu. */
export function soundTap(): void {
  play(() => blip({ freq: 440, toFreq: 620, dur: 0.07, type: "triangle", gain: 0.05 }));
}

/** Abrir um livro — um "pop" ascendente, um pouco mais presente. */
export function soundOpen(): void {
  play(() => {
    blip({ freq: 380, toFreq: 720, dur: 0.12, type: "sine", gain: 0.08 });
    blip({ freq: 760, dur: 0.09, type: "sine", gain: 0.04, delay: 0.05 });
  });
}

/** Ligar/desligar algo — duas notinhas conforme o estado. */
export function soundToggle(on: boolean): void {
  play(() => blip({ freq: on ? 520 : 400, toFreq: on ? 780 : 300, dur: 0.09, type: "triangle", gain: 0.06 }));
}

/** Ação concluída com sucesso (publicar, salvar). */
export function soundSuccess(): void {
  play(() => {
    blip({ freq: 523, dur: 0.1, type: "sine", gain: 0.06 });
    blip({ freq: 784, dur: 0.14, type: "sine", gain: 0.06, delay: 0.08 });
  });
}

export function soundLevelUp(milestone: boolean): void {
  play(() => {
    blip({ freq: 440, toFreq: 660, dur: .18, gain: .07 });
    blip({ freq: 660, toFreq: milestone ? 1046 : 880, dur: .24, gain: .08, delay: .12 });
    if (milestone) blip({ freq: 1046, dur: .34, gain: .06, delay: .28 });
  });
}
