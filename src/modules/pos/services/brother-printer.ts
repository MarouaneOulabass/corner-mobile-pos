/**
 * Brother QL-820NWBc label printer — IPP protocol wrapper.
 * Uses fetch to communicate with the printer over HTTP/IPP.
 * Falls back to browser print if IPP is not available.
 */

import { printViaBrowser } from './thermal-printer';

interface PrinterStatus {
  online: boolean;
  model?: string;
  error?: string;
}

interface PrintLabelOptions {
  copies?: number;
}

// Common local IPs for Brother printers
const COMMON_PRINTER_IPS = [
  '192.168.1.100',
  '192.168.1.101',
  '192.168.0.100',
  '192.168.0.101',
  '192.168.1.200',
  '192.168.0.200',
];

export class BrotherPrinter {
  private ipAddress: string;
  private baseUrl: string;

  constructor(ipAddress: string) {
    this.ipAddress = ipAddress;
    this.baseUrl = `http://${ipAddress}`;
  }

  /**
   * Send a label image to the printer via IPP.
   * The imageData should be a PNG or JPEG Blob.
   */
  async printLabel(imageData: Blob, options?: PrintLabelOptions): Promise<{ success: boolean; error?: string }> {
    const copies = options?.copies ?? 1;

    try {
      // Build IPP print-job request
      const ippPayload = this.buildIPPPrintJob(imageData, copies);

      const response = await fetch(`${this.baseUrl}/ipp/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ipp',
        },
        body: ippPayload,
      });

      if (!response.ok) {
        return { success: false, error: `Erreur imprimante: HTTP ${response.status}` };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      return { success: false, error: `Connexion impossible: ${message}` };
    }
  }

  /**
   * Get current printer status via HTTP.
   */
  async getStatus(): Promise<PrinterStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.baseUrl}/general/status.html`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          online: true,
          model: 'Brother QL-820NWBc',
        };
      }

      return { online: false, error: `HTTP ${response.status}` };
    } catch {
      return { online: false, error: 'Imprimante non trouvée sur le réseau' };
    }
  }

  /**
   * Attempt to discover a Brother printer on the local network
   * by probing common IP addresses.
   */
  static async discover(): Promise<string | null> {
    // Also check localStorage for a saved IP
    if (typeof window !== 'undefined') {
      const savedIp = localStorage.getItem('brother_printer_ip');
      if (savedIp) {
        const printer = new BrotherPrinter(savedIp);
        const status = await printer.getStatus();
        if (status.online) return savedIp;
      }
    }

    // Probe common IPs
    const probes = COMMON_PRINTER_IPS.map(async (ip) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`http://${ip}/general/status.html`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) return ip;
      } catch {
        // IP not reachable
      }
      return null;
    });

    const results = await Promise.allSettled(probes);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }

    return null;
  }

  /**
   * Fallback: print label HTML via browser print dialog.
   */
  static printFallback(html: string): void {
    printViaBrowser(html);
  }

  /**
   * Build a minimal IPP print-job payload.
   * IPP is a binary protocol over HTTP — this builds the minimal request.
   */
  private buildIPPPrintJob(imageData: Blob, copies: number): Blob {
    // IPP version 1.1 Print-Job operation
    const header = new Uint8Array([
      // Version 1.1
      0x01, 0x01,
      // Operation: Print-Job (0x0002)
      0x00, 0x02,
      // Request ID: 1
      0x00, 0x00, 0x00, 0x01,
    ]);

    // Operation attributes
    const encoder = new TextEncoder();
    const attrs: number[] = [];

    // Helper to push Uint8Array contents into number array
    const pushBytes = (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) attrs.push(arr[i]);
    };

    // Begin operation attributes tag
    attrs.push(0x01);

    // charset
    attrs.push(0x47); // charset type
    const charsetName = encoder.encode('attributes-charset');
    attrs.push(0x00, charsetName.length);
    pushBytes(charsetName);
    const charsetValue = encoder.encode('utf-8');
    attrs.push(0x00, charsetValue.length);
    pushBytes(charsetValue);

    // natural-language
    attrs.push(0x48); // naturalLanguage type
    const langName = encoder.encode('attributes-natural-language');
    attrs.push(0x00, langName.length);
    pushBytes(langName);
    const langValue = encoder.encode('fr-fr');
    attrs.push(0x00, langValue.length);
    pushBytes(langValue);

    // printer-uri
    attrs.push(0x45); // uri type
    const uriName = encoder.encode('printer-uri');
    attrs.push(0x00, uriName.length);
    pushBytes(uriName);
    const uriValue = encoder.encode(`ipp://${this.ipAddress}/ipp/print`);
    attrs.push(0x00, uriValue.length);
    pushBytes(uriValue);

    // Job attributes tag
    attrs.push(0x02);

    // copies
    attrs.push(0x21); // integer type
    const copiesName = encoder.encode('copies');
    attrs.push(0x00, copiesName.length);
    pushBytes(copiesName);
    attrs.push(0x00, 0x04); // value length = 4
    attrs.push((copies >> 24) & 0xff, (copies >> 16) & 0xff, (copies >> 8) & 0xff, copies & 0xff);

    // End of attributes
    attrs.push(0x03);

    const attrBytes = new Uint8Array(attrs);

    return new Blob([header, attrBytes, imageData], { type: 'application/ipp' });
  }
}
