declare module 'screenshot-desktop' {
  interface ScreenshotOptions {
    screen?: number;
    format?: 'png' | 'jpg' | 'jpeg';
    quality?: number;
  }

  interface ScreenshotResult {
    data: Buffer;
    width: number;
    height: number;
  }

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  function screenshot(callback: (error: Error | null, img: Buffer) => void): void;
  function screenshot(options: ScreenshotOptions, callback: (error: Error | null, img: Buffer) => void): void;

  namespace screenshot {
    function listDisplays(): Promise<Array<{
      id: number;
      name: string;
      primary: boolean;
    }>>;

    function all(): Promise<Buffer[]>;
  }

  export = screenshot;
}