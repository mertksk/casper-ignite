/**
 * Type declarations for Casper Wallet browser extension
 * The extension injects these objects into the window asynchronously
 */

interface CasperSignResponse {
  cancelled: boolean;
  signatureHex?: string;
  signature?: Uint8Array;
  message?: string;
}

interface CasperWalletProvider {
  requestConnection: () => Promise<boolean>;
  requestSwitchAccount: () => Promise<boolean>;
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<CasperSignResponse>;
  signMessage: (message: string, signingPublicKeyHex: string) => Promise<CasperSignResponse>;
  disconnectFromSite: () => Promise<boolean>;
  isConnected: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string>;
  getVersion: () => Promise<string>;
  getActivePublicKeySupports: () => Promise<string[]>;
}

interface CasperWalletEventTypes {
  Connected: string;
  ActiveKeyChanged: string;
  Disconnected: string;
  TabChanged: string;
  Locked: string;
  Unlocked: string;
  ActiveKeySupportsChanged: string;
}

interface CasperWalletProviderOptions {
  timeout?: number;
}

type CasperWalletProviderFactory = (options?: CasperWalletProviderOptions) => CasperWalletProvider;

interface Window {
  CasperWalletProvider?: CasperWalletProviderFactory;
  CasperWalletEventTypes?: CasperWalletEventTypes;
}
