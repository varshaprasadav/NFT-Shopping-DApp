# NFT Shopping DApp — Full Setup Guide

An NFT marketplace where sellers mint & list product NFTs, buyers purchase
with ETH (optionally discounted with LOYAL loyalty tokens earned from past
purchases), images/metadata are stored on IPFS via Pinata, and everything is
served by a small Express backend.

## Folder structure
```
project/
├── server.js            <- backend (Express) — serves frontend + IPFS uploads
├── hardhat.config.js     <- contract compiler/network config
├── scripts/deploy.js     <- deploys all 3 contracts and wires them together
├── package.json
├── .env.example          <- copy to .env and fill in
├── frontend/
│   ├── index.html
│   └── app.js
└── contracts/
    ├── MyNFT.sol          (ERC-721 product NFTs)
    ├── Marketplace.sol    (listing / buying logic)
    └── LoyaltyToken.sol   (ERC-20 reward token, "LOYAL")
```

---

## 0. What you need before starting

| Thing | Where to get it |
|---|---|
| **Node.js** (v18+) | https://nodejs.org — installs `npm` too |
| **MetaMask** browser extension | https://metamask.io |
| **Testnet ETH** (Hoodi testnet) | a Hoodi faucet, e.g. https://hoodi-faucet.pk910.de |
| **An RPC URL for Hoodi** | e.g. free tier at https://alchemy.com or https://infura.io |
| **A Pinata account + JWT** | https://app.pinata.cloud (free tier is fine) |

You do **not** need to install Solidity, a blockchain node, or anything else
separately — `npm install` pulls in Hardhat (used to compile/deploy the
contracts) and Express (the backend server) together.

---

## 1. Install everything

```bash
cd project
npm install
```

This single command installs **all** dependencies: Express, CORS, Multer,
Axios, dotenv (backend) and Hardhat + OpenZeppelin (for compiling/deploying
the contracts). Nothing else needs separate installing.

## 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in:

```properties
PORT=5000

# Pinata → app.pinata.cloud → API Keys → create key with pin permissions → copy the JWT
PINATA_JWT=eyJhbGciOi...

PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/

# Your Hoodi RPC URL (from Alchemy/Infura)
HOODI_RPC_URL=https://eth-hoodi.g.alchemy.com/v2/YOUR_KEY

# The private key of the wallet you'll deploy contracts from
# (MetaMask → account menu → Account details → Show private key)
# Use a throwaway/test wallet, never your main wallet's key.
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x_prefix

# These get filled in AFTER you deploy (step 3) — leave blank for now
NFT_ADDRESS=
MARKETPLACE_ADDRESS=
LOYALTY_ADDRESS=
```

## 3. Deploy the contracts

```bash
npm run deploy:hoodi
```

This runs `scripts/deploy.js`, which automatically:
1. Deploys `LoyaltyToken`
2. Deploys `MyNFT`
3. Deploys `Marketplace` (linking it to the two above)
4. Calls `setMarketplace()` on `MyNFT` so it trusts the Marketplace
5. Calls `setMarketplace()` on `LoyaltyToken` so it trusts the Marketplace

At the end it prints something like:
```
============================================================
DEPLOYMENT COMPLETE - paste these into your .env file:
============================================================
NFT_ADDRESS=0x...
MARKETPLACE_ADDRESS=0x...
LOYALTY_ADDRESS=0x...
============================================================
```

Copy those 3 lines into your `.env`, replacing the blank ones from step 2.

## 4. Start the server

```bash
npm start
```

You should see:
```
Serving frontend from: .../frontend
Server running on http://localhost:5000
```

## 5. Use the app

1. Open **http://localhost:5000** in Chrome/Brave/Edge (with MetaMask installed)
2. Make sure MetaMask is on the **Hoodi** network (add it manually if needed, using your `HOODI_RPC_URL`)
3. Click **Connect Wallet**
4. Click **Add Product** — fill in name/description/price/image → confirm **1** MetaMask popup (mints + lists in one transaction)
5. To buy: click a product → answer the LOYAL-token prompt → confirm the purchase dialog → confirm **1** MetaMask transaction

---

## How the pieces fit together

```
Browser (frontend/index.html + app.js)
   │
   ├── talks to MetaMask directly for all blockchain reads/writes
   │   (connect wallet, mint+list, buy, check balances)
   │
   └── talks to your Express server for two things only:
         POST /upload-image     → server uploads to Pinata → returns ipfs:// URL
         POST /upload-metadata  → server uploads JSON to Pinata → returns ipfs:// URI
```

The blockchain itself never touches your server — MetaMask sends
transactions straight from the browser to the Hoodi network. Your server's
only job is proxying image/metadata uploads to Pinata (so your Pinata JWT
never has to be exposed in browser code) and serving the static frontend.

---

## Troubleshooting "Image upload failed"

Check the terminal running `npm start` — it now logs the real Pinata error
right before responding to the browser. Common causes:

1. **`.env` not filled in / server not restarted** after editing `.env`
2. **Invalid/expired `PINATA_JWT`** — regenerate at Pinata, use the JWT (long string), not the API key/secret pair
3. **JWT missing "pinFileToIPFS" permission** when it was created
4. **Pinata plan/storage limits** — check your dashboard
5. **Image over 10 MB** (different, clearer error shown client-side)

## Troubleshooting deployment

- **`npm run deploy:hoodi` fails with a network error** — check `HOODI_RPC_URL` is correct and your RPC provider (Alchemy/Infura) key is active
- **"insufficient funds" during deploy** — your deployer wallet needs Hoodi testnet ETH, get some from a faucet
- **`mintAndList` reverts with "Only marketplace can call this"** — `setMarketplace()` wasn't called on `MyNFT`; re-run `npm run deploy:hoodi` (it does this automatically) rather than deploying contracts manually one-by-one
