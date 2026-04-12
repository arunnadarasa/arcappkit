import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppKit,
  Blockchain,
  BridgeChain,
  type SendParams,
  SwapChain,
} from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import MetaMaskSDK from "@metamask/sdk";
import {
  chainCatalog,
  liveBridgeChains,
  liveBrowserChains,
  liveSendChains,
  liveSwapChains,
  mainnetChains,
  testnetChains,
  type ChainSupport,
  type NetworkTier,
} from "./chainCatalog";

type OperationMode = "execute" | "estimate";
type Workflow = "bridge" | "swap" | "send";
type MatrixFilter = "all" | NetworkTier;

type BridgeForm = {
  fromChain: BridgeChain;
  toChain: BridgeChain;
  amount: string;
};

type SwapToken = "USDC" | "EURC" | "USDT" | "NATIVE";

type SwapForm = {
  chain: SwapChain;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amountIn: string;
  slippageBps: string;
};

type SendToken = "USDC" | "EURC" | "USDT" | "NATIVE";

type SendForm = {
  chain: Blockchain;
  to: string;
  amount: string;
  token: SendToken;
};

type ActionState = {
  status: "idle" | "running" | "success" | "error";
  label: string;
  payload?: string;
};

type SelectOption = {
  label: string;
  value: string;
};

const APP_KIT = new AppKit();

const bridgeOptions = toOptions(liveBridgeChains, (chain) => chain.bridgeValue);
const swapOptions = toOptions(liveSwapChains, (chain) => chain.swapValue);
const sendOptions = toOptions(liveSendChains, (chain) => chain.chain);

const swapTokens: ReadonlyArray<{
  value: SwapToken;
  label: string;
  description: string;
}> = [
  { value: "USDC", label: "USDC", description: "Core settlement asset" },
  { value: "EURC", label: "EURC", description: "Euro stablecoin" },
  { value: "USDT", label: "USDT", description: "Common swap target" },
  { value: "NATIVE", label: "Native", description: "Chain gas asset" },
];

const flowHighlights = [
  {
    eyebrow: "Coverage",
    title: "Map every compatible network without making the page feel crowded.",
    copy:
      "The matrix remains complete, but the interface now feels more like a flagship operations product than an internal admin tool.",
  },
  {
    eyebrow: "Execution",
    title: "Turn bridge, swap, and send into a premium control deck.",
    copy:
      "The workflow area is reorganized around a single active mission so decisions and outputs feel faster, clearer, and more confident.",
  },
  {
    eyebrow: "Trust",
    title: "Surface live status with richer hierarchy and calmer visual rhythm.",
    copy:
      "Wallet readiness, environment posture, execution state, and generated code all have clearer separation, spacing, and visual priority.",
  },
];

const setupSteps = [
  "Connect with MetaMask SDK to use the live browser wallet path across supported EVM chains.",
  "Set VITE_ARC_KIT_KEY in a local .env file for swap estimates and swap execution.",
  "Use the compatibility matrix to choose between browser EVM, Circle Wallets, or a Solana adapter path.",
  "Add a Solana adapter if you want live Solana execution beyond the current browser EVM flow.",
];

const workflowMeta: Record<
  Workflow,
  { title: string; kicker: string; detail: string }
> = {
  bridge: {
    title: "Cross-chain bridge",
    kicker: "Capital routing",
    detail:
      "Move stablecoin liquidity between compatible networks through a cleaner high-conviction route planning surface.",
  },
  swap: {
    title: "Same-chain swap",
    kicker: "Instant conversion",
    detail:
      "Inspect slippage and route readiness before committing funds, with the result state elevated alongside the form.",
  },
  send: {
    title: "Direct send",
    kicker: "Treasury dispatch",
    detail:
      "Run clean treasury-style transfers with a polished operator experience and an immediate execution trail.",
  },
};

const initialBridgeForm: BridgeForm = {
  fromChain: BridgeChain.Ethereum_Sepolia,
  toChain: BridgeChain.Arc_Testnet,
  amount: "1.00",
};

const initialSwapForm: SwapForm = {
  chain: SwapChain.Arc_Testnet,
  tokenIn: "USDC",
  tokenOut: "EURC",
  amountIn: "1.00",
  slippageBps: "100",
};

const initialSendForm: SendForm = {
  chain: Blockchain.Arc_Testnet,
  to: "",
  amount: "1.00",
  token: "USDC",
};

function createMetaMaskSdk() {
  return new MetaMaskSDK({
    dappMetadata: {
      name: "Arc App Kit",
      url:
        typeof window === "undefined"
          ? "http://localhost:5174"
          : window.location.href,
    },
    checkInstallationImmediately: false,
    preferDesktop: true,
    injectProvider: false,
  });
}

function App() {
  const sdkRef = useRef<MetaMaskSDK | null>(null);
  const providerRef = useRef<EthereumProvider | null>(null);
  const [workflow, setWorkflow] = useState<Workflow>("bridge");
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter>("all");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState(
    "Connect with MetaMask to activate live App Kit actions.",
  );
  const [bridgeForm, setBridgeForm] = useState(initialBridgeForm);
  const [swapForm, setSwapForm] = useState(initialSwapForm);
  const [sendForm, setSendForm] = useState(initialSendForm);
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
    label: "No operation run yet.",
  });

  const kitKey = import.meta.env.VITE_ARC_KIT_KEY;
  const activeWorkflowMeta = workflowMeta[workflow];
  const stats = {
    total: chainCatalog.length,
    mainnets: mainnetChains.length,
    testnets: testnetChains.length,
    swapEnabled: chainCatalog.filter((chain) => chain.swap).length,
    browserLive: liveBrowserChains.length,
  };

  const selectedNetwork =
    workflow === "bridge"
      ? `${bridgeForm.fromChain} -> ${bridgeForm.toChain}`
      : workflow === "swap"
        ? swapForm.chain
        : sendForm.chain;

  const visibleMatrix =
    matrixFilter === "all"
      ? chainCatalog
      : chainCatalog.filter((chain) => chain.tier === matrixFilter);

  const codeSnippet = useMemo(() => {
    if (workflow === "bridge") {
      return [
        "const result = await kit.bridge({",
        `  from: { adapter, chain: "${bridgeForm.fromChain}" },`,
        `  to: { adapter, chain: "${bridgeForm.toChain}" },`,
        `  amount: "${bridgeForm.amount}",`,
        "  token: 'USDC',",
        "});",
      ].join("\n");
    }

    if (workflow === "swap") {
      return [
        "const result = await kit.swap({",
        `  from: { adapter, chain: "${swapForm.chain}" },`,
        `  tokenIn: "${swapForm.tokenIn}",`,
        `  tokenOut: "${swapForm.tokenOut}",`,
        `  amountIn: "${swapForm.amountIn}",`,
        "  config: {",
        `    slippageBps: ${swapForm.slippageBps},`,
        "    kitKey: import.meta.env.VITE_ARC_KIT_KEY,",
        "  },",
        "});",
      ].join("\n");
    }

    return [
      "const result = await kit.send({",
      `  from: { adapter, chain: "${sendForm.chain}" },`,
      `  to: "${sendForm.to || "RECIPIENT_ADDRESS"}",`,
      `  amount: "${sendForm.amount}",`,
      `  token: "${sendForm.token}",`,
      "});",
    ].join("\n");
  }, [bridgeForm, sendForm, swapForm, workflow]);

  useEffect(() => {
    const sdk = sdkRef.current ?? createMetaMaskSdk();
    sdkRef.current = sdk;

    let cancelled = false;

    async function hydrateMetaMaskSession() {
      try {
        await sdk.init();
        const provider = sdk.getProvider();

        if (!provider || cancelled) {
          return;
        }

        bindProvider(provider as EthereumProvider);

        const accounts = (await provider.request({
          method: "eth_accounts",
        })) as string[];
        const chainId = (await provider.request({
          method: "eth_chainId",
        })) as string;

        if (cancelled) {
          return;
        }

        if (accounts[0]) {
          setWalletAddress(accounts[0]);
          setWalletChainId(chainId);
          setWalletStatus(
            "MetaMask SDK session restored. Live bridge, swap, and send forms are available for the browser-compatible EVM set.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          setWalletStatus(getErrorMessage(error));
        }
      }
    }

    void hydrateMetaMaskSession();

    return () => {
      cancelled = true;
      unbindProvider();
    };
  }, []);

  function bindProvider(provider: EthereumProvider) {
    if (providerRef.current === provider) {
      return;
    }

    unbindProvider();
    providerRef.current = provider;
    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("disconnect", handleProviderDisconnect);
  }

  function unbindProvider() {
    if (!providerRef.current) {
      return;
    }

    providerRef.current.removeListener("accountsChanged", handleAccountsChanged);
    providerRef.current.removeListener("chainChanged", handleChainChanged);
    providerRef.current.removeListener("disconnect", handleProviderDisconnect);
    providerRef.current = null;
  }

  function handleAccountsChanged(accounts: unknown) {
    const nextAccount = Array.isArray(accounts) ? accounts[0] : undefined;

    if (typeof nextAccount === "string") {
      setWalletAddress(nextAccount);
      setWalletStatus(
        "MetaMask wallet connected. Live bridge, swap, and send forms are available for the browser-compatible EVM set.",
      );
      return;
    }

    setWalletAddress(null);
    setWalletStatus(
      "MetaMask account disconnected in the app. Reconnect to resume live App Kit actions.",
    );
  }

  function handleChainChanged(chainId: unknown) {
    if (typeof chainId === "string") {
      setWalletChainId(chainId);
    }
  }

  function handleProviderDisconnect() {
    setWalletAddress(null);
    setWalletChainId(null);
    setWalletStatus(
      "MetaMask disconnected. Reconnect to resume live App Kit actions.",
    );
  }

  async function connectWallet() {
    try {
      const sdk = sdkRef.current ?? createMetaMaskSdk();
      sdkRef.current = sdk;

      setWalletStatus("Opening MetaMask SDK connection...");
      const accounts = await sdk.connect();
      const provider = sdk.getProvider();

      if (!provider) {
        throw new Error("MetaMask SDK did not return a provider.");
      }

      bindProvider(provider as EthereumProvider);
      const chainId = (await provider.request({
        method: "eth_chainId",
      })) as string;

      setWalletAddress(accounts[0] ?? null);
      setWalletChainId(chainId);
      setWalletStatus(
        "MetaMask SDK connected. Live bridge, swap, and send forms are available for the browser-compatible EVM set.",
      );
    } catch (error) {
      setWalletStatus(getErrorMessage(error));
    }
  }

  function disconnectWallet() {
    setWalletAddress(null);
    setWalletChainId(null);
    setWalletStatus(
      "MetaMask disconnected in the app. Reconnect to resume live App Kit actions.",
    );
    setActionState({
      status: "idle",
      label: "No operation run yet.",
    });
    unbindProvider();
    void sdkRef.current?.terminate();
  }

  async function withAdapter<T>(task: (adapter: ArcAdapter) => Promise<T>) {
    const provider = (providerRef.current ??
      sdkRef.current?.getProvider()) as EthereumProvider | undefined;

    if (!provider) {
      throw new Error("Connect with MetaMask SDK before running live App Kit actions.");
    }

    const adapter = await createViemAdapterFromProvider({
      provider,
      capabilities: {
        addressContext: "user-controlled",
      },
    });

    return task(adapter);
  }

  async function runBridge(mode: OperationMode) {
    return withAdapter(async (adapter) => {
      const params = {
        from: { adapter, chain: bridgeForm.fromChain },
        to: { adapter, chain: bridgeForm.toChain },
        amount: bridgeForm.amount,
        token: "USDC" as const,
      };

      return mode === "estimate"
        ? APP_KIT.estimateBridge(params)
        : APP_KIT.bridge(params);
    });
  }

  async function runSwap(mode: OperationMode) {
    if (!kitKey) {
      throw new Error(
        "Set VITE_ARC_KIT_KEY in your local environment before using swap estimate or execute.",
      );
    }

    if (swapForm.tokenIn === swapForm.tokenOut) {
      throw new Error("Pick different input and output tokens for the swap.");
    }

    return withAdapter(async (adapter) => {
      const params = {
        from: { adapter, chain: swapForm.chain },
        tokenIn: swapForm.tokenIn,
        tokenOut: swapForm.tokenOut,
        amountIn: swapForm.amountIn,
        config: {
          slippageBps: Number(swapForm.slippageBps),
          kitKey,
        },
      };

      return mode === "estimate"
        ? APP_KIT.estimateSwap(params)
        : APP_KIT.swap(params);
    });
  }

  async function runSend(mode: OperationMode) {
    return withAdapter(async (adapter) => {
      const params: SendParams = {
        from: { adapter, chain: sendForm.chain },
        to: sendForm.to,
        amount: sendForm.amount,
        token: sendForm.token,
      };

      return mode === "estimate"
        ? APP_KIT.estimateSend(params)
        : APP_KIT.send(params);
    });
  }

  async function handleOperation(mode: OperationMode) {
    setActionState({
      status: "running",
      label:
        mode === "estimate"
          ? "Collecting an App Kit preview..."
          : "Executing the live workflow...",
    });

    try {
      let result: unknown;

      if (workflow === "bridge") {
        result = await runBridge(mode);
      } else if (workflow === "swap") {
        result = await runSwap(mode);
      } else {
        if (!sendForm.to.trim()) {
          throw new Error("Provide a recipient address before running send.");
        }

        result = await runSend(mode);
      }

      setActionState({
        status: "success",
        label:
          mode === "estimate"
            ? "Estimate completed."
            : "Execution completed.",
        payload: stringifyResult(result),
      });
    } catch (error) {
      setActionState({
        status: "error",
        label: getErrorMessage(error),
      });
    }
  }

  return (
    <div className="shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <div className="ambient ambient-center" />

      <header className="hero-shell">
        <nav className="topbar panel-card topbar-panel">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <p>Arc App Kit</p>
              <span>All documented networks</span>
            </div>
          </div>

          <div className="topbar-center">
            <span className="topbar-chip">MetaMask SDK</span>
            <span className="topbar-chip">41 network matrix</span>
            <span className="topbar-chip">
              {kitKey ? "Swap key ready" : "Swap key missing"}
            </span>
          </div>

          <div className="wallet-actions">
            {walletAddress ? (
              <>
                <div className="wallet-pill" aria-label="Connected wallet">
                  <span className="wallet-dot" />
                  <span>{shorten(walletAddress)}</span>
                </div>
                <button
                  className="ghost-button"
                  onClick={connectWallet}
                  type="button"
                >
                  Switch Wallet
                </button>
                <button
                  className="secondary-button"
                  onClick={disconnectWallet}
                  type="button"
                >
                  Log out
                </button>
              </>
            ) : (
              <button className="ghost-button" onClick={connectWallet} type="button">
                Connect Wallet
              </button>
            )}
          </div>
        </nav>

        <section className="hero-grid">
          <section className="hero-panel panel-card">
            <div className="hero-copy">
              <p className="eyebrow">Premium cross-chain operations cockpit</p>
              <h1>Stablecoin operations, elevated into a flagship experience.</h1>
              <p className="hero-text">
                A more cinematic Arc control deck for routing liquidity, executing
                transfers, and showing compatibility depth without the clunky
                dashboard feel.
              </p>

              <div className="hero-actions">
                <button
                  className="primary-button"
                  onClick={() => handleOperation("estimate")}
                  type="button"
                >
                  Estimate Current Flow
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setMatrixFilter("all")}
                  type="button"
                >
                  Explore Coverage Matrix
                </button>
              </div>

              <div className="hero-microcopy">
                <span>Live wallet orchestration</span>
                <span>Bridge, swap, and send</span>
                <span>Docs-aligned compatibility intelligence</span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-orb" />
              <div className="visual-panel primary">
                <span className="visual-kicker">Current focus</span>
                <strong>{activeWorkflowMeta.title}</strong>
                <p>{activeWorkflowMeta.detail}</p>
                <div className="visual-tags">
                  <span>{activeWorkflowMeta.kicker}</span>
                  <span>{selectedNetwork}</span>
                </div>
              </div>

              <div className="visual-panel secondary">
                <span className="visual-kicker">Coverage snapshot</span>
                <div className="visual-statline">
                  <b>{stats.total}</b>
                  <span>documented networks</span>
                </div>
                <div className="visual-grid">
                  <MiniMetric label="Mainnets" value={String(stats.mainnets)} />
                  <MiniMetric label="Testnets" value={String(stats.testnets)} />
                  <MiniMetric label="Swap routes" value={String(stats.swapEnabled)} />
                  <MiniMetric label="Browser live" value={String(stats.browserLive)} />
                </div>
              </div>
            </div>
          </section>

          <aside className="status-panel panel-card">
            <div className="panel-head">
              <p className="eyebrow">Command rail</p>
              <h2>Runtime posture</h2>
            </div>

            <dl className="status-list">
              <StatusRow label="Wallet status" value={walletStatus} />
              <StatusRow label="Wallet address" value={walletAddress ?? "Not connected"} />
              <StatusRow label="Chain ID" value={walletChainId ?? "Unknown"} />
              <StatusRow
                label="Swap kit key"
                value={kitKey ? "Present" : "Missing: set VITE_ARC_KIT_KEY"}
              />
            </dl>

            <div className="status-highlight">
              <div>
                <span className="status-highlight-label">Execution mode</span>
                <strong>MetaMask SDK + App Kit Viem adapter</strong>
              </div>
              <span className="runtime-chip live">Operational</span>
            </div>

            <div className="network-card">
              <p>Live execution note</p>
              <span>
                Wallet login now uses MetaMask SDK, and the resulting provider powers
                the App Kit Viem adapter.
              </span>
              <span>
                Solana mainnet and devnet are included in the matrix, but need a
                Solana adapter flow instead of the current browser EVM wallet.
              </span>
            </div>
          </aside>
        </section>

        <section className="stats-grid feature-metrics">
          <StatCard
            label="Documented chains"
            value={String(stats.total)}
            copy="All compatible mainnets and testnets from the App Kit reference."
          />
          <StatCard
            label="Mainnet / Testnet"
            value={`${stats.mainnets} / ${stats.testnets}`}
            copy="Coverage stays complete without burying the operator in noise."
          />
          <StatCard
            label="Swap enabled"
            value={String(stats.swapEnabled)}
            copy="Swap stays available on supported mainnets plus Arc Testnet."
          />
          <StatCard
            label="Browser live now"
            value={String(stats.browserLive)}
            copy="MetaMask-driven execution is ready across the browser-compatible EVM set."
          />
        </section>
      </header>

      <main className="content">
        <section className="story-grid">
          {flowHighlights.map((item, index) => (
            <article className="story-card" key={item.title}>
              <span className="story-index">{`0${index + 1}`}</span>
              <p className="eyebrow">{item.eyebrow}</p>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="console-grid">
          <section className="control-panel panel-card">
            <div className="panel-head">
              <p className="eyebrow">Operations</p>
              <h2>{activeWorkflowMeta.title}</h2>
              <p className="panel-subcopy">{activeWorkflowMeta.detail}</p>
            </div>

            <div className="workflow-pills" role="tablist" aria-label="Workflow tabs">
              {(["bridge", "swap", "send"] as const).map((item) => (
                <button
                  aria-selected={workflow === item}
                  className={workflow === item ? "tab workflow-tab active" : "tab workflow-tab"}
                  key={item}
                  onClick={() => setWorkflow(item)}
                  role="tab"
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="operation-glance">
              <MiniMetric label="Mode" value={activeWorkflowMeta.kicker} />
              <MiniMetric label="Selected" value={selectedNetwork} />
              <MiniMetric
                label="Wallet"
                value={walletAddress ? shorten(walletAddress) : "Offline"}
              />
            </div>

            {workflow === "bridge" && (
              <div className="form-grid">
                <SelectField
                  label="From chain"
                  value={bridgeForm.fromChain}
                  options={bridgeOptions}
                  onChange={(value) =>
                    setBridgeForm((current) => ({
                      ...current,
                      fromChain: value as BridgeChain,
                    }))
                  }
                />
                <SelectField
                  label="To chain"
                  value={bridgeForm.toChain}
                  options={bridgeOptions}
                  onChange={(value) =>
                    setBridgeForm((current) => ({
                      ...current,
                      toChain: value as BridgeChain,
                    }))
                  }
                />
                <InputField
                  label="Amount (USDC)"
                  value={bridgeForm.amount}
                  onChange={(value) =>
                    setBridgeForm((current) => ({ ...current, amount: value }))
                  }
                  placeholder="1.00"
                />
                <div className="context-blurb">
                  Route stablecoin liquidity across the browser-compatible bridge
                  matrix with a cleaner planning surface before execution.
                </div>
              </div>
            )}

            {workflow === "swap" && (
              <div className="form-grid">
                <SelectField
                  label="Swap chain"
                  value={swapForm.chain}
                  options={swapOptions}
                  onChange={(value) =>
                    setSwapForm((current) => ({
                      ...current,
                      chain: value as SwapChain,
                    }))
                  }
                />
                <TokenField
                  label="Token in"
                  value={swapForm.tokenIn}
                  onChange={(value) =>
                    setSwapForm((current) => ({
                      ...current,
                      tokenIn: value as SwapToken,
                    }))
                  }
                />
                <TokenField
                  label="Token out"
                  value={swapForm.tokenOut}
                  onChange={(value) =>
                    setSwapForm((current) => ({
                      ...current,
                      tokenOut: value as SwapToken,
                    }))
                  }
                />
                <InputField
                  label="Amount in"
                  value={swapForm.amountIn}
                  onChange={(value) =>
                    setSwapForm((current) => ({ ...current, amountIn: value }))
                  }
                  placeholder="1.00"
                />
                <InputField
                  label="Slippage (bps)"
                  value={swapForm.slippageBps}
                  onChange={(value) =>
                    setSwapForm((current) => ({
                      ...current,
                      slippageBps: value,
                    }))
                  }
                  placeholder="100"
                />
                <div className="context-blurb">
                  Swap coverage follows the docs: eligible mainnets plus Arc Testnet,
                  with Arc Testnet limited to USDC and EURC in the reference.
                </div>
              </div>
            )}

            {workflow === "send" && (
              <div className="form-grid">
                <SelectField
                  label="Send on chain"
                  value={sendForm.chain}
                  options={sendOptions}
                  onChange={(value) =>
                    setSendForm((current) => ({
                      ...current,
                      chain: value as Blockchain,
                    }))
                  }
                />
                <TokenField
                  label="Token"
                  value={sendForm.token}
                  onChange={(value) =>
                    setSendForm((current) => ({
                      ...current,
                      token: value as SendToken,
                    }))
                  }
                />
                <InputField
                  label="Recipient"
                  value={sendForm.to}
                  onChange={(value) =>
                    setSendForm((current) => ({ ...current, to: value }))
                  }
                  placeholder="0x..."
                />
                <InputField
                  label="Amount"
                  value={sendForm.amount}
                  onChange={(value) =>
                    setSendForm((current) => ({ ...current, amount: value }))
                  }
                  placeholder="1.00"
                />
                <div className="context-blurb">
                  Execute direct treasury-style dispatches while the matrix below
                  still tracks broader adapter coverage for future expansion.
                </div>
              </div>
            )}

            <div className="button-row">
              <button
                className="primary-button"
                onClick={() => handleOperation("estimate")}
                type="button"
              >
                Estimate
              </button>
              <button
                className="secondary-button"
                onClick={() => handleOperation("execute")}
                type="button"
              >
                Execute
              </button>
            </div>
          </section>

          <aside className="side-panel">
            <div className="panel-card spotlight-panel">
              <div className="panel-head">
                <p className="eyebrow">Workflow brief</p>
                <h2>{activeWorkflowMeta.title}</h2>
              </div>
              <div className="spotlight-row">
                <span className="spotlight-chip">{activeWorkflowMeta.kicker}</span>
                <span className="spotlight-chip">{selectedNetwork}</span>
                <span className="spotlight-chip">
                  {walletAddress ? "Wallet live" : "Awaiting login"}
                </span>
              </div>
              <p className="spotlight-copy">
                {workflow === "bridge"
                  ? "Bridge mode is tuned for route selection, operational confidence, and premium result review."
                  : workflow === "swap"
                    ? "Swap mode balances route preview, slippage control, and a cleaner handoff into execution."
                    : "Send mode keeps payouts straightforward while preserving a premium control-room feel."}
              </p>
            </div>

            <div className="panel-card code-panel">
              <div className="panel-head">
                <p className="eyebrow">Generated code</p>
                <h2>Current workflow snippet</h2>
              </div>
              <pre className="code-block">
                <code>{codeSnippet}</code>
              </pre>
            </div>

            <div className={`panel-card result-card ${actionState.status}`}>
              <div className="panel-head">
                <p className="eyebrow">Run state</p>
                <div className="result-heading">
                  <h2>{actionState.label}</h2>
                  <StateBadge status={actionState.status} />
                </div>
              </div>
              <pre className="result-block">
                <code>{actionState.payload ?? "Results will appear here."}</code>
              </pre>
            </div>
          </aside>
        </section>

        <section className="matrix-section panel-card">
          <div className="panel-head">
            <p className="eyebrow">Compatibility matrix</p>
            <h2>All documented App Kit networks</h2>
          </div>

          <div className="filter-row" role="tablist" aria-label="Matrix filter">
            {([
              { label: "All", value: "all" },
              { label: "Mainnet", value: "mainnet" },
              { label: "Testnet", value: "testnet" },
            ] as const).map((item) => (
              <button
                aria-selected={matrixFilter === item.value}
                className={matrixFilter === item.value ? "tab active" : "tab"}
                key={item.value}
                onClick={() => setMatrixFilter(item.value)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="matrix-note">
            <p>
              The matrix follows the current supported-blockchains reference. The
              browser experience is optimized for EVM execution today while still
              exposing broader adapter strategy across the ecosystem.
            </p>
          </div>

          <div className="table-wrap">
            <table className="support-table">
              <thead>
                <tr>
                  <th>Blockchain</th>
                  <th>Tier</th>
                  <th>Send</th>
                  <th>Bridge</th>
                  <th>Swap</th>
                  <th>Chain adapters</th>
                  <th>Circle Wallets</th>
                  <th>Live here</th>
                </tr>
              </thead>
              <tbody>
                {visibleMatrix.map((chain) => (
                  <tr key={chain.chain}>
                    <td>
                      <div className="table-chain">
                        <strong>{chain.label}</strong>
                        <span>{chainSummary(chain)}</span>
                      </div>
                    </td>
                    <td>{chain.tier}</td>
                    <td>
                      <CapabilityBadge enabled={chain.send} />
                    </td>
                    <td>
                      <CapabilityBadge enabled={chain.bridge} />
                    </td>
                    <td>
                      <CapabilityBadge enabled={chain.swap} />
                    </td>
                    <td>
                      <CapabilityBadge enabled={chain.chainAdapters} />
                    </td>
                    <td>
                      <CapabilityBadge enabled={chain.circleWallets} />
                    </td>
                    <td>
                      <span
                        className={
                          chain.runtimeMode === "browser-evm"
                            ? "runtime-chip live"
                            : "runtime-chip adapter"
                        }
                      >
                        {chain.runtimeMode === "browser-evm"
                          ? "Browser EVM"
                          : "Solana adapter"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bottom-grid">
          <article className="panel-card">
            <div className="panel-head">
              <p className="eyebrow">Launch checklist</p>
              <h2>What to do next locally</h2>
            </div>
            <ol className="steps-list">
              {setupSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>

          <article className="panel-card chain-card">
            <div className="panel-head">
              <p className="eyebrow">Coverage snapshot</p>
              <h2>High-signal planning notes</h2>
            </div>
            <div className="chain-list">
              <div className="chain-item">
                <div>
                  <p>Arc Testnet</p>
                  <span>The only documented testnet with swap support.</span>
                </div>
                <strong>Swap</strong>
              </div>
              <div className="chain-item">
                <div>
                  <p>Solana + Solana Devnet</p>
                  <span>Included here, but they need a dedicated Solana adapter flow.</span>
                </div>
                <strong>Adapter</strong>
              </div>
              <div className="chain-item">
                <div>
                  <p>Codex, EDGE, Morph</p>
                  <span>Bridge and send are supported while swap is not documented.</span>
                </div>
                <strong>No swap</strong>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function InputField(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        value={props.value}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: ReadonlyArray<SelectOption>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select
        onChange={(event) => props.onChange(event.target.value)}
        value={props.value}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TokenField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select
        onChange={(event) => props.onChange(event.target.value)}
        value={props.value}
      >
        {swapTokens.map((token) => (
          <option key={token.value} value={token.value}>
            {token.label} · {token.description}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatCard(props: { label: string; value: string; copy: string }) {
  return (
    <article className="stat-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <p>{props.copy}</p>
    </article>
  );
}

function MiniMetric(props: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function StatusRow(props: { label: string; value: string }) {
  return (
    <div className="status-row">
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}

function CapabilityBadge(props: { enabled: boolean }) {
  return (
    <span className={props.enabled ? "capability-chip yes" : "capability-chip no"}>
      {props.enabled ? "Yes" : "No"}
    </span>
  );
}

function StateBadge(props: { status: ActionState["status"] }) {
  const label =
    props.status === "success"
      ? "Success"
      : props.status === "error"
        ? "Error"
        : props.status === "running"
          ? "Running"
          : "Idle";

  return <span className={`state-badge ${props.status}`}>{label}</span>;
}

function stringifyResult(value: unknown) {
  return JSON.stringify(
    value,
    (_, nestedValue) =>
      typeof nestedValue === "bigint"
        ? nestedValue.toString()
        : nestedValue,
    2,
  );
}

function shorten(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong while running the App Kit workflow.";
}

function toOptions(
  chains: ReadonlyArray<ChainSupport>,
  getValue: (chain: ChainSupport) => string | null,
) {
  return chains
    .map((chain) => {
      const value = getValue(chain);
      return value
        ? {
            label: `${chain.label} · ${chain.tier}`,
            value,
          }
        : null;
    })
    .filter((option): option is SelectOption => option !== null);
}

function chainSummary(chain: ChainSupport) {
  if (chain.runtimeMode === "solana-adapter") {
    return "Catalogued here; live execution needs a Solana adapter flow.";
  }

  if (chain.swap && chain.tier === "testnet") {
    return "Only documented testnet with swap support.";
  }

  if (!chain.swap) {
    return "Send and bridge supported, swap not documented.";
  }

  return "Supports send, bridge, and swap.";
}

export default App;

type ArcAdapter = Awaited<ReturnType<typeof createViemAdapterFromProvider>>;
