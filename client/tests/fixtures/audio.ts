import { vi } from "vitest";

class TestAudioParam implements AudioParam {
  automationRate: AutomationRate = "a-rate";
  defaultValue = 1;
  maxValue = 1;
  minValue = 0;
  value = 1;
  cancelAndHoldAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  setTargetAtTime() {
    return this;
  }
  setValueAtTime(value: number) {
    this.value = value;
    return this;
  }
  setValueCurveAtTime() {
    return this;
  }
}
class TestAudioNode extends EventTarget implements AudioNode {
  channelCount = 2;
  channelCountMode: ChannelCountMode = "max";
  channelInterpretation: ChannelInterpretation = "speakers";
  numberOfInputs = 1;
  numberOfOutputs = 1;
  get context(): BaseAudioContext {
    throw new Error("Context access is outside this audio fixture");
  }
  connect(destination: AudioNode, output?: number, input?: number): AudioNode;
  connect(destination: AudioParam, output?: number): void;
  connect(destination: AudioNode | AudioParam): AudioNode | void {
    if (destination instanceof TestAudioNode) return destination;
  }
  disconnect() {}
}
class TestDestinationNode extends TestAudioNode implements AudioDestinationNode {
  maxChannelCount = 2;
}
class TestAudioBuffer implements AudioBuffer {
  duration = 1;
  length = 44100;
  numberOfChannels = 2;
  sampleRate = 44100;
  copyFromChannel(destination: Float32Array) {
    destination.fill(0);
  }
  copyToChannel() {}
  getChannelData() {
    return new Float32Array(this.length);
  }
}
class TestGainNode extends TestAudioNode implements GainNode {
  gain = new TestAudioParam();
}
class TestBufferSource extends TestAudioNode implements AudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  detune = new TestAudioParam();
  playbackRate = new TestAudioParam();
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: AudioBufferSourceNode["onended"] = null;
  start = vi.fn<(when?: number, offset?: number, duration?: number) => void>();
  stop = vi.fn<(when?: number) => void>();
  constructor() {
    super();
    const source: TestBufferSource = this;
    vi.spyOn(source, "connect");
    vi.spyOn(source, "disconnect");
  }
}
/** Typed Web Audio boundary fixture for the operations used by audio feedback. */
export class TestAudioContext implements Pick<
  AudioContext,
  "destination" | "currentTime" | "createBufferSource" | "createGain" | "decodeAudioData" | "close"
> {
  destination = new TestDestinationNode();
  currentTime = 0;
  createBufferSource() {
    return new TestBufferSource();
  }
  createGain() {
    return new TestGainNode();
  }
  decodeAudioData(_arrayBuffer: ArrayBuffer) {
    return Promise.resolve(new TestAudioBuffer());
  }
  close() {
    return Promise.resolve();
  }
}
