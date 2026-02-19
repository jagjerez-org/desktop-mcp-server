/**
 * WebRTC type declarations for Node.js (wrtc package)
 */

declare module 'wrtc' {
  export const RTCPeerConnection: typeof globalThis.RTCPeerConnection;
  export const RTCIceCandidate: typeof globalThis.RTCIceCandidate;
  export const RTCSessionDescription: typeof globalThis.RTCSessionDescription;
  export const MediaStream: typeof globalThis.MediaStream;
  export const MediaStreamTrack: typeof globalThis.MediaStreamTrack;
  export const RTCDataChannel: typeof globalThis.RTCDataChannel;
  export const RTCRtpSender: typeof globalThis.RTCRtpSender;
  export const RTCRtpReceiver: typeof globalThis.RTCRtpReceiver;
}

// Global WebRTC types for Node.js
declare global {
  interface RTCConfiguration {
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: 'all' | 'relay';
    bundlePolicy?: 'balanced' | 'max-compat' | 'max-bundle';
    rtcpMuxPolicy?: 'negotiate' | 'require';
    peerIdentity?: string;
    certificates?: RTCCertificate[];
    iceCandidatePoolSize?: number;
  }

  interface RTCIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
    credentialType?: 'password' | 'oauth';
  }

  interface RTCPeerConnection extends EventTarget {
    localDescription: RTCSessionDescription | null;
    remoteDescription: RTCSessionDescription | null;
    signalingState: RTCSignalingState;
    iceGatheringState: RTCIceGatheringState;
    iceConnectionState: RTCIceConnectionState;
    connectionState: RTCPeerConnectionState;
    canTrickleIceCandidates: boolean | null;
    sctp: RTCSctpTransport | null;

    new(configuration?: RTCConfiguration): RTCPeerConnection;

    createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescription>;
    createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescription>;
    setLocalDescription(description?: RTCSessionDescription): Promise<void>;
    setRemoteDescription(description: RTCSessionDescription): Promise<void>;
    addIceCandidate(candidate?: RTCIceCandidate): Promise<void>;
    getStats(selector?: MediaStreamTrack): Promise<RTCStatsReport>;
    getIdentityAssertion(): Promise<string>;
    createDataChannel(label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
    close(): void;

    addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender;
    removeTrack(sender: RTCRtpSender): void;
    addStream(stream: MediaStream): void;
    removeStream(stream: MediaStream): void;

    onicecandidate: ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => any) | null;
    oniceconnectionstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null;
    onicegatheringstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null;
    onconnectionstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null;
    onnegotiationneeded: ((this: RTCPeerConnection, ev: Event) => any) | null;
    onsignalingstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null;
    ondatachannel: ((this: RTCPeerConnection, ev: RTCDataChannelEvent) => any) | null;
    onaddstream: ((this: RTCPeerConnection, ev: MediaStreamEvent) => any) | null;
    onremovestream: ((this: RTCPeerConnection, ev: MediaStreamEvent) => any) | null;
    ontrack: ((this: RTCPeerConnection, ev: RTCTrackEvent) => any) | null;
  }

  interface RTCDataChannel extends EventTarget {
    label: string;
    ordered: boolean;
    maxPacketLifeTime: number | null;
    maxRetransmits: number | null;
    protocol: string;
    negotiated: boolean;
    id: number | null;
    readyState: RTCDataChannelState;
    bufferedAmount: number;
    bufferedAmountLowThreshold: number;
    binaryType: string;

    close(): void;
    send(data: string | Blob | ArrayBuffer | ArrayBufferView): void;

    onopen: ((this: RTCDataChannel, ev: Event) => any) | null;
    onmessage: ((this: RTCDataChannel, ev: MessageEvent) => any) | null;
    onerror: ((this: RTCDataChannel, ev: Event) => any) | null;
    onclose: ((this: RTCDataChannel, ev: Event) => any) | null;
  }

  interface RTCSessionDescription {
    type: RTCSdpType;
    sdp: string;
    toJSON(): any;
  }

  interface RTCIceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    foundation: string | null;
    component: RTCIceComponent | null;
    priority: number | null;
    address: string | null;
    protocol: RTCIceProtocol | null;
    port: number | null;
    type: RTCIceCandidateType | null;
    tcpType: string | null;
    relatedAddress: string | null;
    relatedPort: number | null;
    usernameFragment: string | null;
    toJSON(): RTCIceCandidateInit;
  }

  interface RTCRtpSender {
    track: MediaStreamTrack | null;
    transport: RTCDtlsTransport | null;
    rtcpTransport: RTCDtlsTransport | null;
    getCapabilities(kind: string): RTCRtpCapabilities | null;
    getParameters(): RTCRtpSendParameters;
    setParameters(parameters: RTCRtpSendParameters): Promise<void>;
    getStats(): Promise<RTCStatsReport>;
    replaceTrack(withTrack: MediaStreamTrack | null): Promise<void>;
  }

  interface MediaStream extends EventTarget {
    id: string;
    active: boolean;
    onaddtrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => any) | null;
    onremovetrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => any) | null;
    clone(): MediaStream;
    getAudioTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
    getTracks(): MediaStreamTrack[];
    getTrackById(trackId: string): MediaStreamTrack | null;
    addTrack(track: MediaStreamTrack): void;
    removeTrack(track: MediaStreamTrack): void;
  }

  interface MediaStreamTrack extends EventTarget {
    kind: string;
    id: string;
    label: string;
    enabled: boolean;
    muted: boolean;
    onmute: ((this: MediaStreamTrack, ev: Event) => any) | null;
    onunmute: ((this: MediaStreamTrack, ev: Event) => any) | null;
    readyState: MediaStreamTrackState;
    onended: ((this: MediaStreamTrack, ev: Event) => any) | null;
    clone(): MediaStreamTrack;
    stop(): void;
    getCapabilities(): MediaTrackCapabilities;
    getConstraints(): MediaTrackConstraints;
    getSettings(): MediaTrackSettings;
    applyConstraints(constraints?: MediaTrackConstraints): Promise<void>;
  }

  // Events
  interface RTCPeerConnectionIceEvent extends Event {
    candidate: RTCIceCandidate | null;
  }

  interface RTCDataChannelEvent extends Event {
    channel: RTCDataChannel;
  }

  interface MediaStreamEvent extends Event {
    stream: MediaStream;
  }

  interface RTCTrackEvent extends Event {
    receiver: RTCRtpReceiver;
    track: MediaStreamTrack;
    streams: MediaStream[];
    transceiver: RTCRtpTransceiver;
  }

  interface MediaStreamTrackEvent extends Event {
    track: MediaStreamTrack;
  }

  // Enums
  type RTCSignalingState = 'stable' | 'have-local-offer' | 'have-remote-offer' | 'have-local-pranswer' | 'have-remote-pranswer' | 'closed';
  type RTCIceGatheringState = 'new' | 'gathering' | 'complete';
  type RTCIceConnectionState = 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';
  type RTCPeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
  type RTCSdpType = 'offer' | 'pranswer' | 'answer' | 'rollback';
  type RTCDataChannelState = 'connecting' | 'open' | 'closing' | 'closed';
  type RTCIceComponent = 'rtp' | 'rtcp';
  type RTCIceProtocol = 'udp' | 'tcp';
  type RTCIceCandidateType = 'host' | 'srflx' | 'prflx' | 'relay';
  type MediaStreamTrackState = 'live' | 'ended';

  // Additional interfaces for completeness
  interface RTCOfferOptions {
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
    iceRestart?: boolean;
    voiceActivityDetection?: boolean;
  }

  interface RTCAnswerOptions {
    voiceActivityDetection?: boolean;
  }

  interface RTCDataChannelInit {
    ordered?: boolean;
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
    protocol?: string;
    negotiated?: boolean;
    id?: number;
  }

  interface RTCIceCandidateInit {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  }

  // Stubs for other interfaces
  interface RTCStatsReport extends Map<string, any> {}
  interface RTCCertificate {}
  interface RTCSctpTransport {}
  interface RTCDtlsTransport {}
  interface RTCRtpCapabilities {}
  interface RTCRtpSendParameters {}
  interface RTCRtpReceiver {}
  interface RTCRtpTransceiver {}
  interface MediaTrackCapabilities {}
  interface MediaTrackConstraints {}
  interface MediaTrackSettings {}

  // Constructor functions
  var RTCPeerConnection: {
    prototype: RTCPeerConnection;
    new(configuration?: RTCConfiguration): RTCPeerConnection;
  };

  var RTCSessionDescription: {
    prototype: RTCSessionDescription;
    new(descriptionInitDict: RTCSessionDescriptionInit): RTCSessionDescription;
  };

  var RTCIceCandidate: {
    prototype: RTCIceCandidate;
    new(candidateInitDict?: RTCIceCandidateInit): RTCIceCandidate;
  };

  var MediaStream: {
    prototype: MediaStream;
    new(): MediaStream;
    new(stream: MediaStream): MediaStream;
    new(tracks: MediaStreamTrack[]): MediaStream;
  };

  interface RTCSessionDescriptionInit {
    type: RTCSdpType;
    sdp?: string;
  }
}

export {};