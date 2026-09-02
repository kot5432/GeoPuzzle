import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          background: '#173640',
          color: '#f4f0e6',
          border: '1px solid #244950',
          fontFamily: 'inherit',
        },
      }}
    />
  );
}
