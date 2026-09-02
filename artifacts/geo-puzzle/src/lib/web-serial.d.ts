/** Web Serial API — https://developer.mozilla.org/ja/docs/Web/API/Web_Serial_API */

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
}

interface Serial extends EventTarget {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: { filters?: SerialPortFilter[] }): Promise<SerialPort>;
}

interface Navigator {
  readonly serial?: Serial;
}
