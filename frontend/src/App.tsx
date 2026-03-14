import { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { AppWalletProvider } from "./hooks/useAppWallet";
import { WalletConnect } from "./components/WalletConnect";
import { GrantForm } from "./components/GrantForm";
import { AutoSignToggle } from "./components/AutoSignToggle";
import { ApiTester } from "./components/ApiTester";

import "@solana/wallet-adapter-react-ui/styles.css";

function App() {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <AppWalletProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
              <WalletConnect />
              <main className="max-w-2xl mx-auto p-6 space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    SolAuth Dashboard
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    On-chain access control + signed HTTP requests for Solana
                  </p>
                </div>
                <AutoSignToggle />
                <GrantForm />
                <ApiTester />
              </main>
            </div>
          </AppWalletProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
