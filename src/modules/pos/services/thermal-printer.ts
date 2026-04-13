/**
 * ESC/POS command builder and Web Serial API wrapper for thermal printers.
 */

// Web Serial API type declarations (not yet in standard lib)
declare global {
  interface Navigator {
    serial?: {
      requestPort(): Promise<SerialPortDevice>;
    };
  }

  interface SerialPortDevice {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    writable: WritableStream<Uint8Array> | null;
  }
}

// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

type Alignment = 'left' | 'center' | 'right';

/** Convert a Uint8Array to a plain number array for safe spreading */
function toArray(bytes: Uint8Array): number[] {
  return Array.from(bytes);
}

export class ESCPOSBuilder {
  private commands: number[] = [];
  private encoder = new TextEncoder();

  /** Initialize printer */
  init(): ESCPOSBuilder {
    this.commands.push(ESC, 0x40); // ESC @ — initialize
    return this;
  }

  /** Print text */
  text(str: string): ESCPOSBuilder {
    const bytes = toArray(this.encoder.encode(str));
    this.commands.push(...bytes);
    return this;
  }

  /** Set bold mode on/off */
  bold(on: boolean): ESCPOSBuilder {
    this.commands.push(ESC, 0x45, on ? 1 : 0); // ESC E n
    return this;
  }

  /** Set text alignment */
  align(alignment: Alignment): ESCPOSBuilder {
    const n = alignment === 'left' ? 0 : alignment === 'center' ? 1 : 2;
    this.commands.push(ESC, 0x61, n); // ESC a n
    return this;
  }

  /** Set font size (1 = normal, 2 = double height, 3 = double width+height) */
  fontSize(size: number): ESCPOSBuilder {
    let n = 0x00;
    if (size === 2) n = 0x01; // double height
    if (size >= 3) n = 0x11; // double width + double height
    this.commands.push(GS, 0x21, n); // GS ! n
    return this;
  }

  /** Print barcode (Code128) */
  barcode(data: string): ESCPOSBuilder {
    // Set barcode height (100 dots)
    this.commands.push(GS, 0x68, 100); // GS h n
    // Set barcode width (2)
    this.commands.push(GS, 0x77, 2); // GS w n
    // HRI position: below barcode
    this.commands.push(GS, 0x48, 2); // GS H n
    // Print Code128 barcode
    this.commands.push(GS, 0x6b, 73, data.length + 2, 0x7b, 0x42); // GS k m n {B
    const bytes = toArray(this.encoder.encode(data));
    this.commands.push(...bytes);
    return this;
  }

  /** Print QR code */
  qrCode(data: string): ESCPOSBuilder {
    const encoded = this.encoder.encode(data);
    const len = encoded.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;

    // QR Code: Select model 2
    this.commands.push(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 50, 0);
    // QR Code: Set size (module size 6)
    this.commands.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 6);
    // QR Code: Set error correction level (M)
    this.commands.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 49);
    // QR Code: Store data
    this.commands.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 48);
    this.commands.push(...toArray(encoded));
    // QR Code: Print
    this.commands.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 48);

    return this;
  }

  /** Cut paper */
  cut(): ESCPOSBuilder {
    this.commands.push(GS, 0x56, 0x00); // GS V m — full cut
    return this;
  }

  /** Feed n lines */
  feed(lines: number = 1): ESCPOSBuilder {
    for (let i = 0; i < lines; i++) {
      this.commands.push(LF);
    }
    return this;
  }

  /** Print a separator line */
  separator(char: string = '-', width: number = 32): ESCPOSBuilder {
    this.text(char.repeat(width));
    this.feed(1);
    return this;
  }

  /** Build the final Uint8Array of ESC/POS commands */
  build(): Uint8Array {
    return new Uint8Array(this.commands);
  }
}

/**
 * Web Serial API wrapper for thermal printers.
 */
export class ThermalPrinter {
  private port: SerialPortDevice | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  /** Check if Web Serial API is available in the browser */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /** Whether the printer is currently connected */
  get isConnected(): boolean {
    return this.port !== null && this.writer !== null;
  }

  /** Open a serial port connection to the printer */
  async connect(baudRate: number = 9600): Promise<void> {
    if (!ThermalPrinter.isSupported()) {
      throw new Error('Web Serial API non supportée par ce navigateur');
    }

    // Request user to select a serial port
    this.port = await navigator.serial!.requestPort();
    await this.port.open({ baudRate });

    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    } else {
      throw new Error('Le port série n\'est pas accessible en écriture');
    }
  }

  /** Send ESC/POS data to the printer */
  async print(data: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error('Imprimante non connectée');
    }
    await this.writer.write(data);
  }

  /** Disconnect from the printer */
  async disconnect(): Promise<void> {
    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }
}

/**
 * Fallback: print HTML content via browser print dialog using a hidden iframe.
 */
export function printViaBrowser(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @media print {
          body { margin: 0; padding: 0; }
        }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  doc.close();

  // Wait for content to render, then print
  iframe.onload = () => {
    iframe.contentWindow?.print();
    // Remove iframe after a delay to allow print dialog
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  // Trigger load for inline content
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 250);
}
