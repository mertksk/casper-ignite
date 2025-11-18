export type CasperSignResponse =
  | {
      cancelled: true;
      message?: string;
    }
  | {
      cancelled: false;
      signatureHex: string;
      signature: Uint8Array;
    };

export type CasperWalletProvider = {
  requestConnection: () => Promise<boolean>;
  requestSwitchAccount: () => Promise<boolean>;
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<CasperSignResponse>;
  signMessage: (message: string, signingPublicKeyHex: string) => Promise<CasperSignResponse>;
  disconnectFromSite: () => Promise<boolean>;
  isConnected: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string>;
  getVersion: () => Promise<string>;
  getActivePublicKeySupports: () => Promise<string[]>;
};

export type CasperWalletEventTypes = {
  Connected: string;
  ActiveKeyChanged: string;
  Disconnected: string;
  TabChanged: string;
  Locked: string;
  Unlocked: string;
  ActiveKeySupportsChanged: string;
};

export type CasperWalletProviderOptions = {
  timeout?: number;
};

type CasperWalletProviderFactory = (options?: CasperWalletProviderOptions) => CasperWalletProvider;

type CasperWalletWindow = typeof window & {
  CasperWalletProvider?: CasperWalletProviderFactory;
  CasperWalletEventTypes?: CasperWalletEventTypes;
};

export function getCasperWalletProvider(options?: CasperWalletProviderOptions): CasperWalletProvider | null {
  if (typeof window === "undefined") return null;

  const providerFactory = (window as CasperWalletWindow).CasperWalletProvider;
  if (!providerFactory) return null;

  try {
    return providerFactory(options);
  } catch (error) {
    console.error("Error initializing Casper Wallet provider:", error);
    return null;
  }
}

export function getCasperWalletEventTypes(): CasperWalletEventTypes | null {
  if (typeof window === "undefined") return null;

  return (window as CasperWalletWindow).CasperWalletEventTypes ?? null;
}

/**
 * Waits for the Casper Wallet provider to become available
 * @param timeout Maximum time to wait in milliseconds
 * @returns Promise that resolves with the provider or null if timeout
 */
export function waitForCasperWallet(timeout = 2000): Promise<CasperWalletProvider | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = 200;

    const check = () => {
      const provider = getCasperWalletProvider();

      if (provider) {
        resolve(provider);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        resolve(null);
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}
