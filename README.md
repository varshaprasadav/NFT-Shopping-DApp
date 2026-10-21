# NFT Shopping DApp with Loyalty Rewards

A decentralized online store where **every product is an NFT**. Customers connect a MetaMask wallet, add products to a cart and pay in ETH. The NFT is transferred to the buyer automatically, and the buyer earns **LOYAL** reward tokens that can be spent for a discount on a later order.

This project was built as part of an internship on blockchain and decentralized application (DApp) development.

---

## Table of Contents

1. [Features](#features)
2. [How It Works](#how-it-works)
3. [Reward and Discount Rules](#reward-and-discount-rules)
4. [Project Structure](#project-structure)
5. [Tech Stack](#tech-stack)
6. [Prerequisites](#prerequisites)
7. [Setup and Deployment](#setup-and-deployment)
8. [Running the App](#running-the-app)
9. [Using the App](#using-the-app)
10. [Smart Contract Reference](#smart-contract-reference)
11. [Security Notes](#security-notes)
12. [Troubleshooting](#troubleshooting)
13. [Limitations and Future Work](#limitations-and-future-work)
14. [License](#license)

---

## Features

- **One-transaction listing.** The admin uploads an image and a name, and one call (`mintAndList`) mints the NFT and lists it for sale.
- **Admin-only product creation.** Enforced by both the front end and the contract (`onlyAdmin`).
- **Shopping cart and bulk purchase.** Buy up to 20 products in a single order and a single transaction.
- **Clear cart summary.** The cart shows each item, the subtotal, the discount option, the final price to pay, the LOYAL you will earn, your LOYAL balance and a short rules guide.
- **Loyalty rewards.** Customers earn LOYAL tokens based on the ETH they pay.
- **Optional discount.** Spend 3 LOYAL for 0.5 ETH off an order.
- **No refill rule.** An order that uses LOYAL earns no new LOYAL.
- **Decentralized storage.** Product images and metadata are stored on IPFS through Pinata.
- **Safe purchase flow.** Double purchases are blocked, extra ETH is refunded, and sellers cannot buy their own products.
- **Friendly wallet experience.** Detects existing connections, reacts to account and network changes, shows the LOYAL balance and offers to add the LOYAL token to MetaMask.
- **Readable errors.** Wallet rejections and contract errors are turned into simple toast messages.

---

## How It Works

1. The admin deploys three contracts: `MyNFT`, `LoyaltyToken` and `Marketplace`.
2. The admin links them by calling `setMarketplace` on `MyNFT` and on `LoyaltyToken`.
3. The admin adds a product. The app uploads the image and metadata to IPFS through the backend, then calls `mintAndList`. The marketplace mints the NFT into its own custody and lists it for sale.
4. A customer connects MetaMask, adds products to the cart and chooses whether to use LOYAL for a discount.
5. The customer confirms one transaction. The contract applies the discount, sends the payment to the admin, transfers the NFTs to the buyer, burns any LOYAL used, mints new LOYAL when allowed, and refunds any extra ETH.

### Architecture

- **Browser (`app.js` and the HTML page):** wallet connection, product catalogue, cart and checkout, using Ethers.js.
- **Backend server:** serves `/config` (contract addresses and gateway) and handles `/upload-image` and `/upload-metadata`, so the Pinata keys never reach the browser.
- **Smart contracts:** `MyNFT` (ERC-721), `LoyaltyToken` (ERC-20) and `Marketplace`.
- **IPFS (Pinata):** stores product images and metadata JSON.

---

## Reward and Discount Rules

### Earning LOYAL

LOYAL tokens are given on the ETH paid in one order, as long as no LOYAL are used in that order:

- Below 1 ETH: 0 LOYAL
- 1 to 5 ETH: 2 LOYAL
- Above 5 to 10 ETH: 4 LOYAL
- Above 10 to 20 ETH: 6 LOYAL
- Above 20 to 50 ETH: 10 LOYAL
- Above 50 ETH: 15 LOYAL

### Using LOYAL for a discount

- A customer with at least **3 LOYAL** can spend **3 LOYAL** to get **0.5 ETH off** the order total.
- The discount can be used **once per order**.
- The order total must be **more than 0.5 ETH**.
- Using the discount is **optional**. The customer can save the LOYAL for a later order.
- An order that uses LOYAL earns **no new LOYAL**, so tokens cannot be refilled in the same order.

### Example

A customer buys products worth 4 ETH and earns 2 LOYAL. Two more orders of 3 ETH earn 2 LOYAL each, so the customer has 6 LOYAL.

On the next order of 5 ETH the customer ticks the discount in the cart:

- 3 LOYAL are used and 0.5 ETH is taken off.
- The customer pays 4.5 ETH and earns no new LOYAL.
- The customer is left with 3 LOYAL.

If the customer skips the discount instead, they pay 5 ETH, earn 2 LOYAL, and have 8 LOYAL.

---

## Project Structure

```
.
├── contracts/
│   ├── MyNFT.sol           # ERC-721 product NFTs
│   ├── LoyaltyToken.sol    # ERC-20 LOYAL reward token
│   └── Marketplace.sol     # listing, buying, rewards, refunds
├── public/
│   ├── index.html          # page that loads app.js
│   └── app.js              # front-end logic (wallet, cart, checkout)
├── server.js               # backend: /config, /upload-image, /upload-metadata
├── .env                    # private keys and settings (never commit this)
└── README.md
```

Your folder names may differ. The key point is that the page must load `app.js`, and the backend must serve the three endpoints listed above.

---

## Tech Stack

- **Solidity** `^0.8.23`
- **OpenZeppelin Contracts** (`ERC721URIStorage`, `ERC20`, `Ownable`)
- **Ethers.js** v6
- **MetaMask** wallet
- **IPFS** through **Pinata**
- **HTML, CSS and JavaScript** for the front end
- A **Node.js** backend server (for config and uploads)
- A development tool such as **Remix IDE** or **Hardhat**
- A test network such as **Sepolia**, or a local network

---

## Prerequisites

- Node.js (LTS version) and npm
- The MetaMask browser extension
- Test ETH on your chosen test network (from a faucet)
- A free Pinata account and an API key (JWT)
- A way to compile and deploy contracts (Remix IDE is the easiest for beginners)

---

## Setup and Deployment

### 1. Get the code

```bash
git clone <your-repository-url>
cd <your-project-folder>
npm install
```

### 2. Compile the contracts

If you use Remix:

1. Open `MyNFT.sol`, `LoyaltyToken.sol` and `Marketplace.sol`.
2. Select compiler version `0.8.23` or higher.
3. Compile all three files. The OpenZeppelin imports are resolved automatically in Remix.

### 3. Deploy the contracts (in this order)

1. Deploy **`MyNFT`** (no constructor arguments). Copy its address.
2. Deploy **`LoyaltyToken`** (no constructor arguments). Copy its address.
3. Deploy **`Marketplace`** with two constructor arguments:
   - `_nftAddress`: the `MyNFT` address
   - `_loyaltyAddress`: the `LoyaltyToken` address

   The account that deploys the marketplace becomes the **admin**.

### 4. Link the contracts

From the same account that deployed them, call:

- `MyNFT.setMarketplace(<Marketplace address>)`
- `LoyaltyToken.setMarketplace(<Marketplace address>)`

`LoyaltyToken.setMarketplace` also transfers ownership of the token to the marketplace, so only the marketplace can mint or burn LOYAL. This cannot be repeated, so use a fresh `LoyaltyToken` if you ever redeploy the marketplace.

### 5. Configure the backend

Create a `.env` file in the project root. The names below are examples, so use the names your `server.js` reads:

```env
NFT_ADDRESS=0x413d0e29e312519937ABca6DEf1130c4fe2a1FB9
MARKETPLACE_ADDRESS=0x221B802C166dD5b30d48fA732C0578721f6526dd
LOYALTY_ADDRESS=0x5727c378051b6F3046cC235a88B5789997Ff2f36

PINATA_JWT=your_pinata_jwt_here
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
PORT=3000
```

The `/config` endpoint must return JSON in this shape:

```json
{
  "success": true,
  "nft": "0x...",
  "marketplace": "0x...",
  "loyalty": "0x...",
  "pinataGateway": "https://gateway.pinata.cloud/ipfs/"
}
```

> **Never commit `.env` or your Pinata keys to GitHub.** Add `.env` to `.gitignore`.

---

## Running the App

```bash
node server.js
```

Open `http://localhost:3000` in your browser, then:

1. Connect MetaMask to the same network where you deployed the contracts.
2. Use the **admin** account (the one that deployed the marketplace) to add products.
3. Use a **different account** to buy them.

If you change `app.js` and the page does not update, do a hard refresh with `Ctrl + Shift + R`.

---

## Using the App

### As the admin

1. Connect the admin account.
2. Click **Add Product**, then choose an image and enter a name and a price in ETH.
3. Confirm the transaction. The NFT is minted and listed in one step.

### As a customer

1. Connect a different account that has test ETH.
2. Click **Add to Cart** on one or more products.
3. In the cart, check the subtotal, the final price to pay and the LOYAL you will earn.
4. If you have at least 3 LOYAL and the order is more than 0.5 ETH, you can tick **Use 3 LOYAL for 0.5 ETH off**.
5. Click **Buy all** and confirm in MetaMask.
6. The NFTs appear in your wallet, and your LOYAL balance updates.

### Tips for testing

- Price your test products at around 1 to 3 ETH so one order reaches the first reward tier, or adjust the test network amounts you hold.
- Buy a few products first to collect 3 or more LOYAL, then place a bigger order and use the discount.
- Use the admin account only to add products, and a second account to buy, because sellers cannot buy their own products.

---

## Smart Contract Reference

### `MyNFT` (ERC-721, `Ownable`)

- `setMarketplace(address)`: sets the marketplace that is allowed to mint.
- `mintForMarketplace(...)`: called only by the marketplace to mint a product NFT with its metadata link.
- `getCurrentTokenId()`: returns the current token counter.

### `LoyaltyToken` (ERC-20 "Loyalty Token", symbol `LOYAL`, `Ownable`)

- `setMarketplace(address)`: sets the marketplace and transfers ownership to it.
- `mintReward(address, uint256)`: mints LOYAL (marketplace only).
- `redeemReward(address, uint256)`: burns LOYAL used for a discount (marketplace only).

### `Marketplace`

- `constructor(address _nftAddress, address _loyaltyAddress)`: the deployer becomes the admin.
- `mintAndList(...)`: admin only. Mints an NFT into the marketplace and lists it for sale.
- `buyProducts(uint256[] tokenIds, bool useLoyalty)`: buys one or more products (up to `MAX_ITEMS_PER_ORDER = 20`). Pass `true` to use 3 LOYAL for 0.5 ETH off. Send the amount to pay as `value`.
- `calculateReward(uint256 ethPaid)`: returns the LOYAL earned for an order size.
- `getProduct`, `getProductCount`, `getProductId`, `getAllProductIds`: read product data.
- `getLoyaltyBalance(address)`: returns a customer's LOYAL balance.
- `onERC721Received(...)`: lets the marketplace receive NFTs it mints for itself.
- Events: `ProductListed`, `ProductPurchased`, `LoyaltyRewarded`, `OrderCompleted`.

---

## Security Notes

- **Access control.** Only the admin can list products. Only the marketplace can mint or burn LOYAL, because token ownership is transferred to it.
- **No double purchase.** Each listing is marked inactive before any payment or transfer, even when a product is repeated in one cart.
- **Refunds.** Any ETH above the amount due is returned to the buyer.
- **Self-purchase blocked.** A seller cannot buy their own product.
- **No free tokens.** LOYAL can only be created by the marketplace as a reward.
- **Private keys.** Pinata credentials live only in the backend `.env` file, never in the browser code.
- **Output safety.** User-provided text is escaped before it is shown on the page.

This is an internship and learning project. It has **not been professionally audited**, so do not use it on a real network with real money.

---

## Troubleshooting

- **The cart looks old after an update.** The browser is loading the old `app.js`. Replace the file, restart the server if needed, and hard refresh with `Ctrl + Shift + R`. Also check that `index.html` loads the file you edited.
- **"Failed to load configuration".** The `/config` endpoint is not running or does not return the JSON shape shown above.
- **Transactions fail on the wrong network.** Switch MetaMask to the network where the contracts are deployed.
- **`ERC721InvalidReceiver` error.** The marketplace must implement `onERC721Received`. The provided `Marketplace.sol` already does.
- **The discount tick box is disabled.** You need at least 3 LOYAL, and the order total must be more than 0.5 ETH.
- **No LOYAL after a purchase.** Orders below 1 ETH earn nothing, and an order that uses LOYAL earns no new LOYAL.
- **Cannot buy a product.** You may be using the admin account that listed it, or the product may already be sold.
- **Images do not load.** Check the Pinata JWT and the gateway URL in your `.env`.
- **Redeployed the marketplace and LOYAL no longer works.** Deploy all three contracts again, because the LOYAL token's ownership was already handed to the old marketplace.

---

## Limitations and Future Work

- The reward tiers depend on single order size, so splitting a large order into small ones can earn more LOYAL. A reward based on total spending would be fairer.
- The 3 LOYAL for 0.5 ETH discount is a fixed amount, which is generous on small orders. A percentage discount with a cap would be more realistic.
- All payments go to the admin account.
- Add automated tests with Hardhat or Foundry.
- Get a smart contract security review before any real deployment.
- Add NFT resale, seller dashboards and gas optimization.
- Deploy on a public test network and then a low-cost network.

---
