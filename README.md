# Arc App Kit Frontend

A React + Vite frontend for Arc App Kit that now reflects the full documented mainnet and testnet compatibility matrix, with live MetaMask SDK wallet flows for the EVM-compatible set.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your App Kit key:

   ```bash
   cp .env.example .env
   ```

3. Set `VITE_ARC_KIT_KEY` in `.env` if you want to use swap estimates and swap execution.

4. Start the app:

   ```bash
   npm run dev
   ```

## Notes

- The compatibility matrix covers all documented compatible mainnets and testnets from the Arc App Kit supported-blockchains reference.
- Live execution in this starter uses MetaMask SDK and passes its provider into the App Kit Viem adapter.
- Solana mainnet and Solana Devnet are shown in the UI, but need a Solana adapter flow rather than the current Viem browser-wallet path.
- Bridge and send can run without a kit key, but swap requires one.
