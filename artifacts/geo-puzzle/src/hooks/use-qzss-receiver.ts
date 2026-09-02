import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fix } from '@/lib/geo';
import { processNmeaChunk } from '@/lib/nmea';
import {
  QZSS_BAUD_RATE,
  createInitialQzssState,
  isPositionFresh,
  isWebSerialSupported,
  mergeNmeaUpdate,
  qzssStateToFix,
  type QzssState,
  webSerialUnavailableMessage,
} from '@/lib/qzss';

type UseQzssReceiverOptions = {
  onFix?: (fix: Fix) => void;
  enabled?: boolean;
};

export function useQzssReceiver({ onFix, enabled = true }: UseQzssReceiverOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<QzssState>(() => createInitialQzssState());

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const readLoopRef = useRef<Promise<void> | null>(null);
  const onFixRef = useRef(onFix);
  const mountedRef = useRef(true);

  onFixRef.current = onFix;

  const readLoop = useCallback(async (port: SerialPort) => {
    const decoder = new TextDecoder();

    // MDN 推奨: readable が null になるまで reader を再生成
    while (port.readable && mountedRef.current) {
      const reader = port.readable.getReader();
      readerRef.current = reader;
      try {
        while (mountedRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          processNmeaChunk(decoder.decode(value), (update) => {
            setState((current) => {
              const next = mergeNmeaUpdate(current, update);
              const fix = qzssStateToFix(next);
              if (fix) onFixRef.current?.(fix);
              return next;
            });
          });
        }
      } catch (readError) {
        if (mountedRef.current) {
          console.error('Serial read error:', readError);
          setError('みちびき受信機からの読み取りに失敗しました。');
        }
        break;
      } finally {
        reader.releaseLock();
        readerRef.current = null;
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) await readerRef.current.cancel().catch(() => undefined);
      if (portRef.current) await portRef.current.close().catch(() => undefined);
    } finally {
      portRef.current = null;
      readerRef.current = null;
      readLoopRef.current = null;
      if (mountedRef.current) {
        setConnected(false);
        setConnecting(false);
        setState(createInitialQzssState());
      }
    }
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    if (!isWebSerialSupported()) {
      setError(webSerialUnavailableMessage());
      return false;
    }

    setConnecting(true);
    setError(null);

    try {
      if (portRef.current) await disconnect();

      const port = await navigator.serial!.requestPort();
      await port.open({ baudRate: QZSS_BAUD_RATE });

      portRef.current = port;
      setConnected(true);
      setConnecting(false);
      setState(createInitialQzssState());

      readLoopRef.current = readLoop(port);
      return true;
    } catch (connectError) {
      console.error('Serial connect error:', connectError);
      const message = connectError instanceof Error ? connectError.message : String(connectError);
      if (message.includes('cancel') || message.includes('Cancel')) {
        setError(null);
      } else {
        setError(`みちびき受信機の接続に失敗しました: ${message}`);
      }
      setConnected(false);
      setConnecting(false);
      portRef.current = null;
      return false;
    }
  }, [disconnect, enabled, readLoop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => {
      setState((current) => {
        if (isPositionFresh(current)) return current;
        if (current.signalQuality === 'none') return current;
        return { ...current, signalQuality: 'none' };
      });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [connected]);

  const fix = qzssStateToFix(state);

  return {
    connected,
    connecting,
    error,
    state,
    fix,
    supported: isWebSerialSupported(),
    connect,
    disconnect,
  };
}
