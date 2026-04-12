/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARC_KIT_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  on(event: string, listener: (...args: unknown[]) => void): void;
  request(args: {
    method: string;
    params?: unknown;
  }): Promise<any>;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

interface Window {
  ethereum?: EthereumProvider;
}
