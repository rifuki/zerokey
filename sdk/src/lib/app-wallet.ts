import type { SolAuthSigner } from "../types.js";
import bs58 from "bs58";

const DB_NAME = "solauth-keystore";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const WALLET_KEY = "app-wallet";

/** Stored app wallet data */
export interface AppWallet {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyBase58: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Generate a non-extractable Ed25519 keypair via Web Crypto API.
 *
 * The private key CANNOT be exported — JavaScript can use it to sign
 * but cannot read the raw bytes. This is the core security property.
 */
export async function createAppWallet(expiresInMs: number = 3600_000): Promise<AppWallet> {
  const keyPair = await crypto.subtle.generateKey("Ed25519", false, [
    "sign",
    "verify",
  ]) as CryptoKeyPair;

  const pubKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyBase58 = bs58.encode(new Uint8Array(pubKeyRaw));

  const now = Date.now();

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyBase58,
    createdAt: now,
    expiresAt: now + expiresInMs,
  };
}

/**
 * Save app wallet to IndexedDB.
 *
 * The CryptoKey object is stored via structured cloning —
 * it preserves the non-extractable property. Even after loading
 * from IndexedDB, the key remains non-extractable.
 */
export async function saveAppWallet(wallet: AppWallet): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  await promisifyRequest(
    store.put(
      {
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        publicKeyBase58: wallet.publicKeyBase58,
        createdAt: wallet.createdAt,
        expiresAt: wallet.expiresAt,
      },
      WALLET_KEY
    )
  );

  await promisifyTransaction(tx);
  db.close();
}

/**
 * Load app wallet from IndexedDB.
 * Returns null if no wallet stored or if expired.
 */
export async function loadAppWallet(): Promise<AppWallet | null> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return null;
  }

  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const data = await promisifyRequest<AppWallet | undefined>(store.get(WALLET_KEY));

    if (!data) return null;

    // Check expiry
    if (data.expiresAt <= Date.now()) {
      // Expired — clean up
      db.close();
      await clearAppWallet();
      return null;
    }

    db.close();
    return data;
  } catch {
    db.close();
    return null;
  }
}

/**
 * Check if an app wallet exists and is not expired.
 */
export async function hasAppWallet(): Promise<boolean> {
  const wallet = await loadAppWallet();
  return wallet !== null;
}

/**
 * Delete app wallet from IndexedDB.
 */
export async function clearAppWallet(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }

  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await promisifyRequest(store.delete(WALLET_KEY));
    await promisifyTransaction(tx);
  } finally {
    db.close();
  }
}

/**
 * Create a SolAuthSigner from a stored app wallet.
 *
 * The signer uses crypto.subtle.sign() internally —
 * the private key bytes are never exposed to JavaScript.
 */
export async function createAppWalletSigner(): Promise<SolAuthSigner | null> {
  const wallet = await loadAppWallet();
  if (!wallet) return null;

  return appWalletToSigner(wallet);
}

/**
 * Convert an AppWallet to a SolAuthSigner.
 */
export function appWalletToSigner(wallet: AppWallet): SolAuthSigner {
  const { privateKey, publicKeyBase58 } = wallet;

  return {
    publicKey: publicKeyBase58,
    signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
      const buf = new ArrayBuffer(message.byteLength);
      new Uint8Array(buf).set(message);
      const signature = await crypto.subtle.sign("Ed25519", privateKey, buf);
      return new Uint8Array(signature);
    },
  };
}

// ─── IndexedDB Helpers ───

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
