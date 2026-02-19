/**
 * Screen Capture for Desktop Agent
 * 
 * Captures desktop screen and converts it to WebRTC MediaStream
 */

import screenshot from 'screenshot-desktop';
import { RTCVideoSource, createCanvas, createImageData } from './wrtc-stub.js';
import { ScreenInfo, DisplayInfo } from 'desktop-mcp-shared';

export interface ScreenCaptureOptions {
  frameRate?: number;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  displayId?: string;
}

export class ScreenCapture {
  private source: RTCVideoSource;
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private options: Required<ScreenCaptureOptions>;
  private lastFrameTime = 0;

  constructor(options: ScreenCaptureOptions = {}) {
    this.options = {
      frameRate: options.frameRate || 30,
      quality: options.quality || 80,
      maxWidth: options.maxWidth || 1920,
      maxHeight: options.maxHeight || 1080,
      displayId: options.displayId || 'primary'
    };

    // Create RTCVideoSource for WebRTC
    this.source = new RTCVideoSource();
  }

  /**
   * Start screen capture
   */
  async startCapture(): Promise<any> {
    if (this.isCapturing) {
      throw new Error('Screen capture already started');
    }

    console.log('🎥 Starting screen capture...');
    this.isCapturing = true;

    // Create video track from source
    const track = this.source.createTrack();

    // Start capture loop
    const frameInterval = 1000 / this.options.frameRate;
    this.captureInterval = setInterval(async () => {
      try {
        await this.captureFrame();
      } catch (error) {
        console.error('❌ Error capturing frame:', error);
      }
    }, frameInterval);

    // Capture first frame immediately
    await this.captureFrame();

    console.log(`✅ Screen capture started at ${this.options.frameRate} FPS`);
    return track;
  }

  /**
   * Stop screen capture
   */
  stopCapture(): void {
    if (!this.isCapturing) return;

    console.log('🛑 Stopping screen capture...');
    this.isCapturing = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Clean up video source
    this.source.destroy();
  }

  /**
   * Capture a single frame and send to WebRTC
   */
  private async captureFrame(): Promise<void> {
    if (!this.isCapturing) return;

    const now = Date.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    const expectedInterval = 1000 / this.options.frameRate;

    // Skip frame if we're capturing too frequently
    if (timeSinceLastFrame < expectedInterval * 0.8) {
      return;
    }

    try {
      // Take screenshot
      const screenshotBuffer = await screenshot({
        format: 'png',
        quality: this.options.quality / 100,
        screen: this.options.displayId === 'primary' ? 0 : parseInt(this.options.displayId)
      });

      if (!screenshotBuffer) {
        console.warn('⚠️ No screenshot data received');
        return;
      }

      // Convert to image data for WebRTC
      await this.processScreenshotForWebRTC(screenshotBuffer);
      this.lastFrameTime = now;

    } catch (error) {
      console.error('❌ Error taking screenshot:', error);
    }
  }

  /**
   * Process screenshot buffer for WebRTC transmission
   */
  private async processScreenshotForWebRTC(buffer: Buffer): Promise<void> {
    try {
      // For now, we'll use a simplified approach
      // In a real implementation, you would:
      // 1. Decode the PNG buffer
      // 2. Resize if needed
      // 3. Convert to YUV/RGB format expected by WebRTC
      // 4. Call this.source.onFrame() with the frame data

      // This is a placeholder - real implementation would require
      // image processing libraries like sharp or canvas
      const mockFrameData = {
        width: 1920,
        height: 1080,
        data: new Uint8ClampedArray(1920 * 1080 * 4) // RGBA
      };

      // WebRTC expects frame data in a specific format
      // This would need to be properly implemented with actual image processing
      console.log(`📸 Frame captured: ${mockFrameData.width}x${mockFrameData.height}`);

    } catch (error) {
      console.error('❌ Error processing screenshot for WebRTC:', error);
    }
  }

  /**
   * Get screen information
   */
  async getScreenInfo(): Promise<ScreenInfo> {
    try {
      // Get display information
      const displays = await this.getDisplays();
      const primaryDisplay = displays.find(d => d.primary) || displays[0];

      if (!primaryDisplay) {
        throw new Error('No displays found');
      }

      // Get cursor position (this would need a native module in real implementation)
      const cursorPosition = { x: 0, y: 0 }; // Placeholder

      return {
        width: primaryDisplay.width,
        height: primaryDisplay.height,
        cursorX: cursorPosition.x,
        cursorY: cursorPosition.y,
        scaleFactor: 1.0, // Would get from system
        displays
      };

    } catch (error) {
      console.error('❌ Error getting screen info:', error);
      throw error;
    }
  }

  /**
   * Get available displays
   */
  private async getDisplays(): Promise<DisplayInfo[]> {
    // This would use a native module to get actual display information
    // For now, return mock data
    return [
      {
        id: 0,
        name: 'Primary Display',
        width: 1920,
        height: 1080,
        primary: true
      }
    ];
  }

  /**
   * Update capture options
   */
  updateOptions(options: Partial<ScreenCaptureOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (this.isCapturing && this.captureInterval) {
      // Restart with new frame rate if changed
      if (options.frameRate) {
        clearInterval(this.captureInterval);
        const frameInterval = 1000 / this.options.frameRate;
        this.captureInterval = setInterval(async () => {
          try {
            await this.captureFrame();
          } catch (error) {
            console.error('❌ Error capturing frame:', error);
          }
        }, frameInterval);
      }
    }
  }

  /**
   * Check if capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Get current options
   */
  getOptions(): ScreenCaptureOptions {
    return { ...this.options };
  }
}