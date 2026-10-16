# Scholar Quest

Track every scholarship, grant and accelerator application as a quest. Each step you clear is stamped on BOT Chain, building a public, verifiable record of your hustle.

*No tokens, no payments, no admin, no personal data. Program names and links are public, so use demo or public program names.*

## Status

| | |
|---|---|
| Live site | https://scholarquest.my.id/ |
| Contract (BOT Chain mainnet, chain ID 677) | [`0xB3D7295B802D056828b88FCaA9AF2167E96D3e27`](https://scan.botchain.ai/address/0xB3D7295B802D056828b88FCaA9AF2167E96D3e27) |
| Contract (testnet, chain ID 968) | _not deployed yet_ |

## Project layout

- `index.html`: the whole frontend (ethers.js v6 from CDN, no build step, no backend)
- `contracts/ScholarQuest.sol`: the contract (Solidity ^0.8.20)
- `deploy.html`: one-click deploy from MetaMask
- `build/`: compiled ABI and bytecode, plus the standard JSON input for explorer verification
- `tools/`: scripts that compile and test the contract
- `images/bot-chain-black.png`: the BOT Chain logo used in the footer

## Run locally

```bash
python3 -m http.server 4605
```

Then open http://localhost:4605. Until a contract address is configured the site runs in *preview mode*. Stamps are saved in this browser's localStorage, so you can review every screen before deploying. Without MetaMask, the board offers a "preview wallet". "Demo quest" (`?scholar=demo`) shows built-in sample data until `CONFIG.demoScholar` is set.

## 1. Deploy the contract

Compiled with Solidity 0.8.20, optimizer 200 runs, EVM `paris`.

1. Run the site locally and open http://localhost:4605/deploy.html in a browser with MetaMask.
2. Click **Deploy to Testnet (968)**, confirm in MetaMask, then try the app at http://localhost:4605/?net=testnet#board. On localhost the app picks up the address you just deployed.
3. Click **Deploy to Mainnet (677)**.
4. Paste each address into the matching `contract: ''` field in `CONFIG.networks` near the top of the script in `index.html`, and into the Status table above. That one constant feeds the app, the footer and the explorer link.
5. Optional: add a few demo applications from one wallet and put that wallet's address in `CONFIG.demoScholar`, so "Demo quest" opens a real on-chain quest.

Or use Remix: paste `contracts/ScholarQuest.sol` into https://remix.ethereum.org, compile with 0.8.20 and EVM version `paris`, then deploy with *Injected Provider – MetaMask*.

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Testnet | 968 | https://rpc.bohr.life | https://scan.bohr.life |
| Mainnet | 677 | https://rpc.botchain.ai | https://scan.botchain.ai |

To verify the source on the explorer, use "Standard JSON input" with `build/ScholarQuest.standard-input.json` and compiler `v0.8.20+commit.a1b79de6`.

## 2. Publish the site

GitHub Pages serves the `gh-pages` branch, so publish with `git push origin main:gh-pages` after pushing `main`. For a custom domain, add it under Settings → Pages, which creates the `CNAME` file. A public profile lives at `https://<your-domain>/?scholar=<wallet address>`.

## How it works

- Each wallet owns its applications. Only that wallet can advance them.
- Stages only move forward: 01 Drafting → 02 Submitted → 03 Shortlisted → 04 Interview → 05 Decision. Each move is stamped with the block time, so history can't be backdated.
- The final result (Won / Not this time) can only be set at 05 Decision, and it locks the application.
- `getStageTimes` returns six timestamps: stages 1–5, then the time the result was set. Zero means "not reached yet".
- The days-left and OVERDUE badges come from the deadline and are worked out in the UI. OVERDUE means the deadline has passed while the application is still at 01 Drafting.
- The "tx ↗" links in a quest log come from the contract's `StageAdvanced` and `ApplicationFinished` events.

## Contract tools

```bash
npm --prefix tools install
node tools/compile.mjs        # writes build/
node tools/test-contract.mjs  # runs the contract on an in-memory chain
```
