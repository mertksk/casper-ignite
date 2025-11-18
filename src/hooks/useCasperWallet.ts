"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CasperSignResponse,
  CasperWalletProvider,
  getCasperWalletEventTypes,
  getCasperWalletProvider,
} from "@/lib/casperWallet";

export function useCasperWallet() {
  const [provider, setProvider] = useState<CasperWalletProvider | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const syncConnectionState = useCallback(async () => {
    if (!provider) return;

    try {
      const connected = await provider.isConnected();
      setIsConnected(connected);

      if (connected) {
        const pk = await provider.getActivePublicKey();
        setPublicKey(pk);
      } else {
        setPublicKey(null);
      }
    } catch {
      setIsConnected(false);
      setPublicKey(null);
    }
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;
    const retryDelay = 200; // Check every 200ms

    const checkForProvider = () => {
      if (cancelled) return;

      const p = getCasperWalletProvider();

      if (p) {
        setProvider(p);
        setIsInstalled(true);
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        // After 10 attempts (2 seconds total), consider it not installed
        setIsInstalled(false);
        return;
      }

      // Retry after delay
      setTimeout(checkForProvider, retryDelay);
    };

    // Start checking
    checkForProvider();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Set loading to false once we know if the wallet is installed or not
    if (isInstalled !== null) {
      setLoading(false);
    }
  }, [isInstalled]);

  useEffect(() => {
    if (!provider) return;

    (async () => {
      await syncConnectionState();
    })();
  }, [provider, syncConnectionState]);

  useEffect(() => {
    if (typeof window === "undefined" || !provider) return;

    const eventTypes = getCasperWalletEventTypes();
    if (!eventTypes) return;

    const handleConnect = () => {
      void syncConnectionState();
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setPublicKey(null);
    };

    const handleActiveKeyChange = () => {
      void syncConnectionState();
    };

    const handleLock = () => {
      setIsConnected(false);
      setPublicKey(null);
    };

    const handleUnlock = () => {
      void syncConnectionState();
    };

    window.addEventListener(eventTypes.Connected, handleConnect);
    window.addEventListener(eventTypes.Disconnected, handleDisconnect);
    window.addEventListener(eventTypes.ActiveKeyChanged, handleActiveKeyChange);
    window.addEventListener(eventTypes.Locked, handleLock);
    window.addEventListener(eventTypes.Unlocked, handleUnlock);

    return () => {
      window.removeEventListener(eventTypes.Connected, handleConnect);
      window.removeEventListener(eventTypes.Disconnected, handleDisconnect);
      window.removeEventListener(eventTypes.ActiveKeyChanged, handleActiveKeyChange);
      window.removeEventListener(eventTypes.Locked, handleLock);
      window.removeEventListener(eventTypes.Unlocked, handleUnlock);
    };
  }, [provider, syncConnectionState]);

  const connect = useCallback(async () => {
    if (!provider) throw new Error("Casper Wallet is not available");

    const approved = await provider.requestConnection();
    if (!approved) {
      throw new Error("Casper Wallet connection was rejected.");
    }

    const pk = await provider.getActivePublicKey();

    setIsConnected(true);
    setPublicKey(pk);
    return pk;
  }, [provider]);

  const disconnect = useCallback(async () => {
    if (!provider) return;

    await provider.disconnectFromSite();
    setIsConnected(false);
    setPublicKey(null);
  }, [provider]);

  const withActiveKey = useCallback(
    async (key?: string) => {
      if (key) return key;

      if (publicKey) {
        return publicKey;
      }

      if (!provider) return null;

      try {
        const pk = await provider.getActivePublicKey();
        setPublicKey(pk);
        return pk;
      } catch {
        return null;
      }
    },
    [provider, publicKey],
  );

  const signDeploy = useCallback(
    async (deployJson: string, key?: string): Promise<CasperSignResponse> => {
      if (!provider) throw new Error("Casper Wallet is not available");

      const signingKey = await withActiveKey(key);
      if (!signingKey) {
        throw new Error("Active public key not found.");
      }

      return provider.sign(deployJson, signingKey);
    },
    [provider, withActiveKey],
  );

  const signMessage = useCallback(
    async (message: string, key?: string): Promise<CasperSignResponse> => {
      if (!provider) throw new Error("Casper Wallet is not available");

      const signingKey = await withActiveKey(key);
      if (!signingKey) {
        throw new Error("Active public key not found.");
      }

      return provider.signMessage(message, signingKey);
    },
    [provider, withActiveKey],
  );

  return {
    provider,
    isInstalled,
    isConnected,
    publicKey,
    loading,
    connect,
    disconnect,
    signDeploy,
    signMessage,
  };
}
