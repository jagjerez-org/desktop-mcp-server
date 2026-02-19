/**
 * WebRTC stub implementations for Node.js build compatibility
 */

// Stub classes that match the expected interfaces
export class RTCPeerConnection {
  connectionState: string = 'new';
  iceConnectionState: string = 'new';
  signalingState: string = 'stable';
  localDescription: any = null;
  remoteDescription: any = null;
  
  onicecandidate: ((event: any) => void) | null = null;
  oniceconnectionstatechange: ((event: any) => void) | null = null;
  onconnectionstatechange: ((event: any) => void) | null = null;
  onsignalingstatechange: ((event: any) => void) | null = null;
  ondatachannel: ((event: any) => void) | null = null;
  ontrack: ((event: any) => void) | null = null;

  constructor(config?: any) {}
  
  createOffer(options?: any): Promise<RTCSessionDescription> {
    return Promise.resolve(new RTCSessionDescription({ type: 'offer', sdp: '' }));
  }
  
  createAnswer(options?: any): Promise<RTCSessionDescription> {
    return Promise.resolve(new RTCSessionDescription({ type: 'answer', sdp: '' }));
  }
  
  setLocalDescription(desc?: any): Promise<void> {
    this.localDescription = desc;
    return Promise.resolve();
  }
  
  setRemoteDescription(desc: any): Promise<void> {
    this.remoteDescription = desc;
    return Promise.resolve();
  }
  
  addIceCandidate(candidate?: any): Promise<void> {
    return Promise.resolve();
  }
  
  createDataChannel(label: string, options?: any): RTCDataChannel {
    return new RTCDataChannel(label, options);
  }
  
  addTrack(track: any, ...streams: any[]): any {
    return {};
  }
  
  removeTrack(sender: any): void {}
  
  getSenders(): RTCRtpSender[] {
    return [];
  }
  
  close(): void {}
}

export class RTCDataChannel {
  label: string;
  readyState: string = 'connecting';
  bufferedAmount: number = 0;
  
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;

  constructor(label: string, options?: any) {
    this.label = label;
  }
  
  send(data: any): void {}
  close(): void {}
}

export class RTCSessionDescription {
  type: string;
  sdp: string;
  
  constructor(init: { type: string; sdp?: string }) {
    this.type = init.type;
    this.sdp = init.sdp || '';
  }
  
  toJSON(): any {
    return { type: this.type, sdp: this.sdp };
  }
}

export class RTCIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  
  constructor(init?: any) {
    this.candidate = init?.candidate || '';
    this.sdpMid = init?.sdpMid || null;
    this.sdpMLineIndex = init?.sdpMLineIndex || null;
  }
  
  toJSON(): any {
    return {
      candidate: this.candidate,
      sdpMid: this.sdpMid,
      sdpMLineIndex: this.sdpMLineIndex
    };
  }
}

export class MediaStream {
  id: string = '';
  active: boolean = true;
  
  onaddtrack: ((event: any) => void) | null = null;
  onremovetrack: ((event: any) => void) | null = null;
  
  constructor(tracks?: any[]) {}
  
  getTracks(): MediaStreamTrack[] { return []; }
  getAudioTracks(): MediaStreamTrack[] { return []; }
  getVideoTracks(): MediaStreamTrack[] { return []; }
  getTrackById(id: string): MediaStreamTrack | null { return null; }
  addTrack(track: MediaStreamTrack): void {}
  removeTrack(track: MediaStreamTrack): void {}
  clone(): MediaStream { return new MediaStream(); }
}

export class MediaStreamTrack {
  kind: string = '';
  id: string = '';
  label: string = '';
  enabled: boolean = true;
  muted: boolean = false;
  readyState: string = 'live';
  
  onmute: ((event: any) => void) | null = null;
  onunmute: ((event: any) => void) | null = null;
  onended: ((event: any) => void) | null = null;
  
  constructor() {}
  
  clone(): MediaStreamTrack { return new MediaStreamTrack(); }
  stop(): void {}
  getCapabilities(): any { return {}; }
  getConstraints(): any { return {}; }
  getSettings(): any { return {}; }
  applyConstraints(constraints?: any): Promise<void> { return Promise.resolve(); }
}

export class RTCRtpSender {
  track: MediaStreamTrack | null = null;
  
  constructor(track?: MediaStreamTrack) {
    this.track = track || null;
  }
  
  replaceTrack(track: MediaStreamTrack | null): Promise<void> {
    this.track = track;
    return Promise.resolve();
  }
}

// Type definitions
export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RTCConfiguration {
  iceServers?: RTCIceServer[];
}

export default {};