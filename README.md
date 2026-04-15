# Arc App Kit — Control Room

A React + Vite single-page app that demonstrates [Circle Arc App Kit](https://www.circle.com/) flows—**bridge**, **same-chain swap**, and **send**—with a polished operator-style UI. It mirrors the full documented **mainnet and testnet** compatibility surface in a filterable matrix, and runs live **MetaMask SDK** + **Viem adapter** execution on the **browser EVM** subset.

---

## Features

### Wallet and execution

- **MetaMask SDK integration** — Connect, switch wallet, disconnect, and session restore on load (`eth_accounts`).
- **Live EVM path** — Provider is wired into `@circle-fin/adapter-viem-v2` with user-controlled address context for App Kit calls.
- **Runtime status panel** — Wallet status text, shortened address, chain ID, and whether `VITE_ARC_KIT_KEY` is set (required for swap estimate/execute).

### Operations (three workflows)

| Workflow | What it does | Form controls |
| -------- | -------------- | ------------- |
| **Bridge** | Cross-chain USDC bridge | From chain, to chain, amount |
| **Swap** | Same-chain swap | Chain, token in/out (USDC, EURC, USDT, Native), amount in, slippage (bps) |
| **Send** | Direct transfer | Chain, token (USDC, EURC, USDT, Native), recipient address, amount |

- **Estimate** — Calls `estimateBridge`, `estimateSwap`, or `estimateSend` for a preview (no full execution).
- **Execute** — Calls `bridge`, `swap`, or `send` with the same parameters.
- **Result panel** — JSON output with `bigint` values stringified for readability; success / error / running states.

### Compatibility matrix (41 networks)

- **Full catalog** aligned with App Kit supported-blockchains: send, bridge, swap, chain adapters, Circle Wallets, and **live mode** (Browser EVM vs Solana adapter).
- **Filters** — All networks, mainnet only, or testnet only.
- **Per-row context** — Short summaries (e.g. Arc Testnet as the only documented testnet with swap; Solana rows noting adapter requirement).

### Hero and insights

- **Coverage snapshot** — Total documented networks, mainnet/testnet counts, swap-enabled count, and “browser live” EVM count.
- **Story highlights** — Three feature callouts (coverage, execution UX, trust/status hierarchy).
- **Generated code snippet** — Live-updating sample for the active workflow (bridge / swap / send) matching current form values.
- **Workflow brief** — Side panel describing the active mission (bridge vs swap vs send).
- **Launch checklist** — Numbered local setup steps in the UI.
- **Planning notes** — Arc Testnet, Solana paths, and chains without documented swap (e.g. Codex, EDGE, Morph).

### Tech stack

- **React 19**, **TypeScript**, **Vite 8**
- **@circle-fin/app-kit**, **@circle-fin/adapter-viem-v2**, **viem**
- **@metamask/sdk**

---

## Requirements

- **Node.js** (LTS recommended) and **npm**
- **MetaMask** (or compatible injected provider via MetaMask SDK) for live browser flows
- **`VITE_ARC_KIT_KEY`** for **swap** estimate and execute (bridge and send can run without it)

---

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and add your App Kit key if you use swaps:

   ```bash
   cp .env.example .env
   ```

3. Set `VITE_ARC_KIT_KEY` in `.env` when you need swap estimates or execution.

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open the URL Vite prints (default [http://localhost:5173/](http://localhost:5173/)).

### Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build locally |

---

## Behavior notes

- **EVM vs Solana** — Solana mainnet and Solana Devnet appear in the matrix with swap/send/bridge per docs, but **live execution in this app uses the MetaMask + Viem path on EVM chains only**. Solana live flows need a dedicated Solana adapter.
- **Swap tokens** — Arc Testnet swap coverage in reference material is limited to **USDC** and **EURC**; the UI exposes the broader token set where the kit allows.
- **Bridge token** — Live bridge form uses **USDC** as in the sample code path.

---

## Repository

Source: [https://github.com/arunnadarasa/arcappkit](https://github.com/arunnadarasa/arcappkit)

---

## License

See [LICENSE](LICENSE) in this repository.
