let provider = null;
let signer = null;
let account = null;

let nft = null;
let marketplace = null;
let loyalty = null;



let NFT_ADDRESS = "";
let MARKETPLACE_ADDRESS = "";
let LOYALTY_ADDRESS = "";

let PINATA_GATEWAY = "";



const nftABI = [

    "function mintNFT(address to,string uri) returns(uint256)",

    "function ownerOf(uint256 tokenId) view returns(address)",

    "function tokenURI(uint256 tokenId) view returns(string)",

    "function getCurrentTokenId() view returns(uint256)",

    "function marketplace() view returns(address)",

    "function setMarketplace(address _marketplace)",

    "function approve(address to,uint256 tokenId)",

    "function getApproved(uint256 tokenId) view returns(address)"
];



const marketplaceABI = [

    "function mintAndList(string metadataURI,uint256 price) returns(uint256)",

    "function buyProducts(uint256[] tokenIds, bool useLoyalty) payable",

    "function admin() view returns(address)",

    "function calculateReward(uint256 ethPaid) view returns(uint256)",

    "function getProduct(uint256 tokenId) view returns(uint256,address,uint256,string,bool)",

    "function getProductCount() view returns(uint256)",

    "function getProductId(uint256 index) view returns(uint256)",

    "function getAllProductIds() view returns(uint256[])",

    "function getLoyaltyBalance(address user) view returns(uint256)"
];



const loyaltyABI = [

    "function balanceOf(address user) view returns(uint256)"
];

// ============================================================
// ERC20 DECIMALS
// ============================================================

const LOYALTY_DECIMALS = 18;



// ============================================================
// ADMIN + CART STATE
// ============================================================

let isAdmin = false;

let cart = [];                 // [{ tokenId, price (bigint), name }]

let currentProducts = [];      // last products shown on the page


// ============================================================
// ADMIN CHECK  (only the admin account can add products)
// ============================================================

async function checkAdmin() {

    try {

        if (!marketplace || !account) {

            isAdmin = false;

        } else {

            const adminAddress =
                await marketplace.admin();

            isAdmin =
                adminAddress.toLowerCase() ===
                account.toLowerCase();
        }

    } catch (error) {

        console.error("Admin check error:", error);

        isAdmin = false;
    }

    applyAdminUI();

    return isAdmin;
}

function applyAdminUI() {

    if (!document.getElementById("adminUiStyle")) {

        const style =
            document.createElement("style");

        style.id = "adminUiStyle";

        style.textContent =
            ".admin-hidden{display:none !important;}";

        document.head.appendChild(style);
    }

    // Everything that opens / submits the "add product" form.
    const elements =
        document.querySelectorAll(
            "#addProductBtn, #productForm, " +
            "[onclick*='showProductForm']"
        );

    elements.forEach(
        (element) => {

            element.classList.toggle(
                "admin-hidden",
                !isAdmin
            );
        }
    );
}


// ============================================================
// CART
// ============================================================

// Rules of the contract:
//   discount : spend 3 LOYAL -> 0.5 ETH off the order total (once per order)
//   reward   : below 1 ETH = 0, 1-5 = 2, 5-10 = 4, 10-20 = 6, 20-50 = 10,
//              50+ = 15 LOYAL (none when LOYAL are used in the order)

let cartUseLoyalty = false;     // true = use 3 LOYAL for 0.5 ETH off
let cartTotalWei = 0n;          // subtotal of the cart
let loyaltyBalanceCache = 0n;   // the buyer's LOYAL balance

function discountLoyalWei() { return ethers.parseEther("3"); }

function discountEthWei() { return ethers.parseEther("0.5"); }

// same table as calculateReward() in Marketplace.sol
function rewardFromEth(ethWei) {

    const e = ethers.parseEther;

    if (ethWei < e("1"))   return 0n;
    if (ethWei <= e("5"))  return e("2");
    if (ethWei <= e("10")) return e("4");
    if (ethWei <= e("20")) return e("6");
    if (ethWei <= e("50")) return e("10");

    return e("15");
}

// 1.0 -> "1", 0.30 -> "0.3"
function fmtNumber(wei) {

    const text = ethers.formatEther(wei);

    return text.includes(".")
        ? text.replace(/0+$/, "").replace(/\.$/, "")
        : text;
}

function ensureCartUI() {

    if (document.getElementById("cartPanel")) {

        return;
    }

    const style =
        document.createElement("style");

    style.textContent = `
        .product-card .cart-btn{margin-top:10px;}

        #cartPanel{position:fixed;right:18px;bottom:18px;width:340px;
            max-height:90vh;overflow:auto;background:#fff;color:#1f2937;
            border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);
            font-family:inherit;font-size:14px;z-index:9999;
            border:1px solid #e5e7eb;}

        #cartPanel .cart-head{display:flex;justify-content:space-between;
            align-items:center;padding:14px 16px;font-weight:700;
            font-size:16px;color:#fff;
            background:linear-gradient(135deg,#2b6cf0,#7c3aed);
            border-radius:16px 16px 0 0;}
        #cartPanel .cart-balance{font-size:12px;font-weight:600;
            background:rgba(255,255,255,.22);padding:4px 10px;
            border-radius:999px;}

        #cartPanel .cart-items{max-height:150px;overflow:auto;
            padding:8px 16px;}
        #cartPanel .cart-row{display:flex;justify-content:space-between;
            align-items:center;gap:8px;padding:7px 0;
            border-bottom:1px dashed #e5e7eb;}
        #cartPanel .cart-row:last-child{border-bottom:none;}
        #cartPanel .cart-name{flex:1;font-weight:600;}
        #cartPanel .cart-price{color:#374151;white-space:nowrap;}
        #cartPanel .cart-remove{border:none;background:#fee2e2;color:#b91c1c;
            width:22px;height:22px;border-radius:50%;cursor:pointer;
            line-height:1;font-size:14px;padding:0;margin:0;}

        #cartPanel .cart-summary{margin:4px 16px 10px;padding:12px;
            background:#f9fafb;border-radius:12px;}
        #cartPanel .cart-line{display:flex;justify-content:space-between;
            padding:3px 0;}
        #cartPanel .cart-line.discount{color:#047857;font-weight:600;}
        #cartPanel .cart-line.pay{font-size:16px;margin-top:6px;
            padding-top:8px;border-top:1px solid #e5e7eb;}
        #cartPanel .cart-check{display:flex;align-items:center;gap:8px;
            margin:10px 0 2px;padding:9px 10px;background:#eef2ff;
            border-radius:8px;font-weight:600;cursor:pointer;}
        #cartPanel .cart-check input{width:16px;height:16px;margin:0;}
        #cartPanel .cart-note{font-size:12px;color:#6b7280;margin:2px 2px 6px;}
        #cartPanel .cart-label{display:block;margin:10px 0 4px;
            font-size:12px;font-weight:700;color:#6b7280;
            text-transform:uppercase;letter-spacing:.04em;}
        #cartPanel select{width:100%;padding:8px;border-radius:8px;
            border:1px solid #d1d5db;background:#fff;font-size:14px;}
        #cartPanel .cart-earn{margin-top:10px;padding:8px 10px;
            background:#ecfdf5;color:#065f46;border-radius:8px;
            text-align:center;}

        #cartPanel .cart-rules{margin:0 16px 10px;padding:10px 12px;
            border:1px solid #e5e7eb;border-radius:12px;font-size:12px;
            color:#4b5563;}
        #cartPanel .cart-rules b{color:#111827;}
        #cartPanel .cart-rules table{width:100%;border-collapse:collapse;
            margin:4px 0 8px;}
        #cartPanel .cart-rules td{padding:3px 0;border-top:1px solid #f3f4f6;}
        #cartPanel .cart-rules td:last-child{text-align:right;}

        #cartPanel .cart-actions{display:flex;gap:8px;padding:0 16px 16px;}
        #cartPanel .cart-actions button{flex:1;cursor:pointer;padding:10px;
            border-radius:10px;border:1px solid #d1d5db;background:#f3f4f6;
            font-weight:600;font-size:14px;margin:0;}
        #cartPanel .cart-actions button.primary{flex:2;color:#fff;
            border:none;background:linear-gradient(135deg,#2b6cf0,#7c3aed);}
    `;

    document.head.appendChild(style);

    const panel =
        document.createElement("div");

    panel.id = "cartPanel";

    panel.style.display = "none";

    panel.innerHTML = `
        <div class="cart-head">
            <span>&#128722; Your Cart (<span id="cartCount">0</span>)</span>
            <span class="cart-balance">
                You have <b id="cartLoyalBalance">0</b> LOYAL
            </span>
        </div>

        <div class="cart-items" id="cartItems"></div>

        <div class="cart-summary">
            <div class="cart-line">
                <span>Subtotal</span>
                <span><b id="cartTotal">0</b> ETH</span>
            </div>

            <label class="cart-check">
                <input type="checkbox" id="cartUseLoyalty">
                Use 3 LOYAL for 0.5 ETH off
            </label>
            <div class="cart-note" id="cartLoyaltyNote"></div>

            <div class="cart-line discount">
                <span>Discount</span>
                <span id="cartDiscount">- 0 ETH</span>
            </div>

            <div class="cart-line pay">
                <span>You pay</span>
                <span><b id="cartPay">0</b> ETH</span>
            </div>

            <div class="cart-earn">
                You will earn <b id="cartEarn">0</b> LOYAL
            </div>
        </div>

        <div class="cart-rules">
            <b>Earn LOYAL on each order</b>
            <table>
                <tr><td>Below 1 ETH</td><td><b>0 LOYAL</b></td></tr>
                <tr><td>1 to 5 ETH</td><td><b>2 LOYAL</b></td></tr>
                <tr><td>Above 5 to 10 ETH</td><td><b>4 LOYAL</b></td></tr>
                <tr><td>Above 10 to 20 ETH</td><td><b>6 LOYAL</b></td></tr>
                <tr><td>Above 20 to 50 ETH</td><td><b>10 LOYAL</b></td></tr>
                <tr><td>Above 50 ETH</td><td><b>15 LOYAL</b></td></tr>
            </table>
            <b>Discount:</b> 3 LOYAL = 0.5 ETH off (once per order).
            An order that uses LOYAL earns no new LOYAL.
            Using points is optional. Save them for later if you like.
        </div>

        <div class="cart-actions">
            <button id="cartClearBtn">Clear</button>
            <button class="primary" id="cartCheckoutBtn">Buy all</button>
        </div>
    `;

    document.body.appendChild(panel);

    document
        .getElementById("cartCheckoutBtn")
        .addEventListener("click", checkoutCart);

    document
        .getElementById("cartClearBtn")
        .addEventListener(
            "click",
            () => {
                cart = [];
                cartUseLoyalty = false;
                renderCart();
            }
        );

    document
        .getElementById("cartUseLoyalty")
        .addEventListener(
            "change",
            (event) => {
                cartUseLoyalty = event.target.checked;
                updateCartSummary();
            }
        );
}

function isInCart(tokenId) {

    return cart.some(
        (item) => item.tokenId === Number(tokenId)
    );
}

function toggleCart(tokenId) {

    tokenId = Number(tokenId);

    if (isInCart(tokenId)) {

        cart = cart.filter(
            (item) => item.tokenId !== tokenId
        );

    } else {

        const product =
            currentProducts.find(
                (p) => Number(p.tokenId) === tokenId
            );

        if (!product || !product.active) {

            showToast("This product is not available.");

            return;
        }

        cart.push({
            tokenId: tokenId,
            price: BigInt(product.price),
            name:
                product.metadata?.name ||
                `NFT #${tokenId}`
        });
    }

    renderCart();
}

function renderCart() {

    ensureCartUI();

    // drop sold products
    cart = cart.filter(
        (item) => {

            const p =
                currentProducts.find(
                    (x) => Number(x.tokenId) === item.tokenId
                );

            return !p || p.active;
        }
    );

    const panel =
        document.getElementById("cartPanel");

    const list =
        document.getElementById("cartItems");

    let total = 0n;

    list.innerHTML = "";

    cart.forEach(
        (item) => {

            total += item.price;

            const row =
                document.createElement("div");

            row.className = "cart-row";

            row.innerHTML =
                `<span class="cart-name">${escapeHtml(item.name)}</span>` +
                `<span class="cart-price">${fmtNumber(item.price)} ETH</span>` +
                `<button class="cart-remove" title="Remove" ` +
                `onclick="toggleCart(${item.tokenId})">&times;</button>`;

            list.appendChild(row);
        }
    );

    cartTotalWei = total;

    document.getElementById("cartCount").textContent =
        cart.length;

    panel.style.display =
        cart.length > 0 ? "block" : "none";

    // update every "Add to Cart" button on the page
    document
        .querySelectorAll("[data-cart-btn]")
        .forEach(
            (button) => {

                button.textContent =
                    isInCart(button.dataset.cartBtn)
                        ? "Remove from Cart"
                        : "Add to Cart";
            }
        );

    updateCartSummary();

    refreshCartBalance();
}

// ------------------------------------------------------------
// CART SUMMARY: subtotal, discount, final price, LOYAL earned
// ------------------------------------------------------------

function updateCartSummary() {

    const checkbox =
        document.getElementById("cartUseLoyalty");

    if (!checkbox) {

        return;
    }

    const enoughLoyal =
        loyaltyBalanceCache >= discountLoyalWei();

    const bigEnough =
        cartTotalWei > discountEthWei();

    const canUse =
        enoughLoyal && bigEnough;

    if (!canUse) {

        cartUseLoyalty = false;
    }

    checkbox.disabled = !canUse;

    checkbox.checked = cartUseLoyalty;

    document.getElementById("cartLoyaltyNote").textContent =
        !enoughLoyal
            ? "You need at least 3 LOYAL to use the discount."
            : !bigEnough
                ? "Order total must be more than 0.5 ETH."
                : "Optional. Using LOYAL earns no new LOYAL on this order.";

    const discount =
        cartUseLoyalty
            ? discountEthWei()
            : 0n;

    const pay =
        cartTotalWei - discount;

    // no new LOYAL on an order where LOYAL are used
    const earn =
        cartUseLoyalty
            ? 0n
            : rewardFromEth(pay);

    document.getElementById("cartTotal").textContent =
        fmtNumber(cartTotalWei);

    document.getElementById("cartDiscount").textContent =
        `- ${fmtNumber(discount)} ETH`;

    document.getElementById("cartPay").textContent =
        fmtNumber(pay);

    document.getElementById("cartEarn").textContent =
        fmtNumber(earn);

    document.getElementById("cartLoyalBalance").textContent =
        fmtNumber(loyaltyBalanceCache);
}

async function refreshCartBalance() {

    try {

        if (!marketplace || !account) {

            loyaltyBalanceCache = 0n;

        } else {

            loyaltyBalanceCache =
                await marketplace.getLoyaltyBalance(account);
        }

        updateCartSummary();

    } catch (error) {

        console.error("Cart balance error:", error);
    }
}

async function checkoutCart() {

    await checkout(
        cart.map((item) => item.tokenId),
        cartUseLoyalty
    );
}

const DEFAULT_PINATA_GATEWAY =
    "https://gateway.pinata.cloud/ipfs/";

// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "NFT Shopping DApp loading..."
        );

        applyAdminUI();   // hide "add product" until admin is verified

        ensureCartUI();

        try {

            await loadConfig();

        } catch (error) {

            console.error(
                "Configuration error:",
                error
            );
        }

    }
);
// ============================================================
// LOAD CONFIGURATION FROM BACKEND
// ============================================================

async function loadConfig() {

    try {

        const response = await fetch("/config");

        const data = await safeJson(response);

        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to load configuration."
            );
        }

        NFT_ADDRESS =
            data.nft;

        MARKETPLACE_ADDRESS =
            data.marketplace;

        LOYALTY_ADDRESS =
            data.loyalty;

        PINATA_GATEWAY =
            data.pinataGateway ||
            DEFAULT_PINATA_GATEWAY;

        console.log(
            "Configuration loaded."
        );

        console.log(
            "NFT:",
            NFT_ADDRESS
        );

        console.log(
            "Marketplace:",
            MARKETPLACE_ADDRESS
        );

        console.log(
            "Loyalty:",
            LOYALTY_ADDRESS
        );

        if (window.ethereum) {

            await checkExistingConnection();

        }

    } catch (error) {

        console.error(
            "Config Error:",
            error
        );

        showToast(
            "Unable to load DApp configuration."
        );
    }
}


// ============================================================
// SAFE JSON RESPONSE
// ============================================================

async function safeJson(response) {

    const text =
        await response.text();

    if (!text) {

        return {};
    }

    try {

        return JSON.parse(text);

    } catch (error) {

        console.error(
            "Invalid JSON response:",
            text
        );

        return {
            success: false,
            message:
                "Server returned an invalid response."
        };
    }
}


// ============================================================
// ERROR MESSAGE
// ============================================================

function getErrorMessage(error) {

    if (!error) {

        return "Unknown error.";
    }

    // MetaMask rejection
    if (
        error.code === 4001 ||
        error.code === "ACTION_REJECTED"
    ) {

        return "Transaction rejected in MetaMask.";
    }

    // Ethers CALL_EXCEPTION
    if (
        error.code ===
        "CALL_EXCEPTION"
    ) {

        if (error.reason) {

            return error.reason;
        }

        return (
            "Transaction failed. " +
            "Please check the contract and wallet."
        );
    }

    if (error.reason) {

        return error.reason;
    }

    if (error.shortMessage) {

        return error.shortMessage;
    }

    if (error.message) {

        return error.message;
    }

    if (
        typeof error ===
        "string"
    ) {

        return error;
    }

    try {

        return JSON.stringify(error);

    } catch {

        return "Unknown error.";
    }
}


// ============================================================
// TOAST
// ============================================================

function showToast(message) {

    let toast =
        document.getElementById(
            "toast"
        );

    // If toast element does not exist,
    // create it automatically.

    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "toast";

        toast.style.position =
            "fixed";

        toast.style.bottom =
            "25px";

        toast.style.right =
            "25px";

        toast.style.zIndex =
            "99999";

        toast.style.padding =
            "14px 20px";

        toast.style.borderRadius =
            "10px";

        toast.style.background =
            "#111827";

        toast.style.color =
            "white";

        toast.style.fontSize =
            "14px";

        toast.style.boxShadow =
            "0 5px 20px rgba(0,0,0,0.25)";

        document.body.appendChild(
            toast
        );
    }

    toast.textContent =
        message;

    toast.style.display =
        "block";

    clearTimeout(
        window.toastTimer
    );

    window.toastTimer =
        setTimeout(
            () => {

                toast.style.display =
                    "none";

            },
            4000
        );
}


// ============================================================
// FORM STATUS
// ============================================================

function setFormStatus(message) {

    const status =
        document.getElementById(
            "formStatus"
        );

    if (!status) {

        return;
    }

    status.textContent =
        message || "";

    status.style.display =
        message
            ? "block"
            : "none";
}


// ============================================================
// CHECK METAMASK
// ============================================================

function checkMetaMask() {

    if (!window.ethereum) {

        showToast(
            "MetaMask is not installed."
        );

        return false;
    }

    return true;
}


// ============================================================
// CONNECT WALLET
// ============================================================

async function connectWallet() {

    try {

        if (!checkMetaMask()) {

            return;
        }

        if (
            !NFT_ADDRESS ||
            !MARKETPLACE_ADDRESS ||
            !LOYALTY_ADDRESS
        ) {

            await loadConfig();
        }

        provider =
            new ethers.BrowserProvider(
                window.ethereum
            );

        await provider.send(
            "eth_requestAccounts",
            []
        );

        signer =
            await provider.getSigner();

        account =
            await signer.getAddress();

        // ====================================================
        // CREATE CONTRACT INSTANCES
        // ====================================================

        nft =
            new ethers.Contract(
                NFT_ADDRESS,
                nftABI,
                signer
            );

        marketplace =
            new ethers.Contract(
                MARKETPLACE_ADDRESS,
                marketplaceABI,
                signer
            );

        loyalty =
            new ethers.Contract(
                LOYALTY_ADDRESS,
                loyaltyABI,
                signer
            );

        console.log(
            "Wallet connected:",
            account
        );

        console.log(
            "NFT contract:",
            NFT_ADDRESS
        );

        console.log(
            "Marketplace contract:",
            MARKETPLACE_ADDRESS
        );

        console.log(
            "Loyalty contract:",
            LOYALTY_ADDRESS
        );

        updateWalletUI();

        showToast(
            "Wallet connected successfully."
        );

        // ====================================================
        // LOAD DAPP DATA
        // ====================================================

        if (
            typeof loadProducts ===
            "function"
        ) {

            await loadProducts();
        }

        if (
            typeof loadRewardBalance ===
            "function"
        ) {

            await loadRewardBalance();
        }

     

        if (
            typeof addLoyaltyTokenToMetaMask ===
            "function"
        ) {

            await addLoyaltyTokenToMetaMask();
        }

    } catch (error) {

        console.error(
            "Wallet Connection Error:",
            error
        );

        showToast(
            "Wallet connection failed: " +
            getErrorMessage(error)
        );
    }
}


// ============================================================
// CHECK EXISTING WALLET CONNECTION
// ============================================================

async function checkExistingConnection() {

    try {

        if (!window.ethereum) {

            return;
        }

        provider =
            new ethers.BrowserProvider(
                window.ethereum
            );

        const accounts =
            await provider.send(
                "eth_accounts",
                []
            );

        if (
            !accounts ||
            accounts.length === 0
        ) {

            return;
        }

        signer =
            await provider.getSigner();

        account =
            await signer.getAddress();

        nft =
            new ethers.Contract(
                NFT_ADDRESS,
                nftABI,
                signer
            );

        marketplace =
            new ethers.Contract(
                MARKETPLACE_ADDRESS,
                marketplaceABI,
                signer
            );

        loyalty =
            new ethers.Contract(
                LOYALTY_ADDRESS,
                loyaltyABI,
                signer
            );

        console.log(
            "Existing wallet connected:",
            account
        );

        updateWalletUI();

        if (
            typeof loadProducts ===
            "function"
        ) {

            await loadProducts();
        }

        if (
            typeof loadRewardBalance ===
            "function"
        ) {

            await loadRewardBalance();
        }

    } catch (error) {

        console.error(
            "Existing connection error:",
            error
        );
    }
}


// ============================================================
// UPDATE WALLET UI
// ============================================================

function updateWalletUI() {

    const connectButton =
        document.getElementById(
            "connectWalletBtn"
        );

    const walletAddress =
        document.getElementById(
            "walletAddress"
        );

    if (connectButton) {

        connectButton.textContent =
            "Wallet Connected";
    }

    if (walletAddress) {

        walletAddress.textContent =
            shortenAddress(account);
    }

    checkAdmin();
}


// ============================================================
// SHORTEN ADDRESS
// ============================================================

function shortenAddress(address) {

    if (!address) {

        return "";
    }

    if (
        address.length <= 12
    ) {

        return address;
    }

    return (
        address.substring(0, 6) +
        "..." +
        address.substring(
            address.length - 4
        )
    );
}


// ============================================================
// CONVERT IPFS URL
// ============================================================

function convertIPFSUrl(uri) {

    if (!uri) {

        return "";
    }

    uri =
        String(uri).trim();

    if (
        uri.startsWith(
            "ipfs://"
        )
    ) {

        const cid =
            uri.replace(
                "ipfs://",
                ""
            );

        const gateway =
            (
                PINATA_GATEWAY ||
                DEFAULT_PINATA_GATEWAY
            ).replace(
                /\/$/,
                ""
            );

        return (
            gateway +
            "/" +
            cid
        );
    }

    return uri;
}


// ============================================================
// METAMASK ACCOUNT CHANGED
// ============================================================

if (window.ethereum) {

    window.ethereum.on(
        "accountsChanged",
        async function (accounts) {

            if (
                !accounts ||
                accounts.length === 0
            ) {

                provider = null;
                signer = null;
                account = null;
                nft = null;
                marketplace = null;
                loyalty = null;

                console.log(
                    "Wallet disconnected."
                );

                return;
            }

            try {

                provider =
                    new ethers.BrowserProvider(
                        window.ethereum
                    );

                signer =
                    await provider.getSigner();

                account =
                    await signer.getAddress();

                nft =
                    new ethers.Contract(
                        NFT_ADDRESS,
                        nftABI,
                        signer
                    );

                marketplace =
                    new ethers.Contract(
                        MARKETPLACE_ADDRESS,
                        marketplaceABI,
                        signer
                    );

                loyalty =
                    new ethers.Contract(
                        LOYALTY_ADDRESS,
                        loyaltyABI,
                        signer
                    );

                updateWalletUI();

                await loadProducts();

                await loadRewardBalance();

            } catch (error) {

                console.error(
                    "Account change error:",
                    error
                );
            }
        }
    );

    // ========================================================
    // NETWORK CHANGED
    // ========================================================

    window.ethereum.on(
        "chainChanged",
        function () {

            window.location.reload();
        }
    );
}
// ============================================================
// LOAD ALL PRODUCTS
// ============================================================

async function loadProducts() {

    try {

        if (!marketplace) {

            console.log(
                "Marketplace contract is not initialized."
            );

            return;
        }

        const productIds =
            await marketplace.getAllProductIds();

        console.log(
            "Product IDs:",
            productIds
        );

        const products = [];

        for (
            const tokenIdBigInt of productIds
        ) {

            const tokenId =
                Number(tokenIdBigInt);

            try {

                const product =
                    await marketplace.getProduct(
                        tokenId
                    );

                /*
                 * product[0] = tokenId
                 * product[1] = seller
                 * product[2] = price
                 * product[3] = metadataURI
                 * product[4] = active
                 */

                const productTokenId =
                    Number(product[0]);

                const seller =
                    product[1];

                const price =
                    product[2];

                const metadataURI =
                    product[3];

                const active =
                    product[4];

                // Only show active products
                if (!active) {

                    continue;
                }

                let metadata = null;

                try {

                    metadata =
                        await loadMetadata(
                            metadataURI
                        );

                } catch (metadataError) {

                    console.error(
                        "Metadata loading error for NFT #" +
                        productTokenId,
                        metadataError
                    );
                }

                products.push({

                    tokenId:
                        productTokenId,

                    seller:
                        seller,

                    price:
                        price,

                    metadataURI:
                        metadataURI,

                    active:
                        active,

                    metadata:
                        metadata
                });

            } catch (error) {

                console.error(
                    "Error loading product #" +
                    tokenId,
                    error
                );
            }
        }

        console.log(
            "Loaded products:",
            products
        );

        displayProducts(
            products
        );

    } catch (error) {

        console.error(
            "Load Products Error:",
            error
        );

        showToast(
            "Unable to load products."
        );
    }
}


// ============================================================
// LOAD NFT METADATA
// ============================================================

async function loadMetadata(
    metadataURI
) {

    if (!metadataURI) {

        throw new Error(
            "Metadata URI is empty."
        );
    }

    const metadataURL =
        convertIPFSUrl(
            metadataURI
        );

    console.log(
        "Loading metadata:",
        metadataURL
    );

    const response =
        await fetch(
            metadataURL
        );

    if (!response.ok) {

        throw new Error(
            "Metadata request failed: " +
            response.status
        );
    }

    const metadata =
        await response.json();

    return metadata;
}
// ============================================================
// DISPLAY PRODUCTS
// ============================================================

function displayProducts(products) {

    const container =
        document.getElementById(
            "productContainer"
        );

    if (!container) {

        console.warn(
            "Product container not found in index.html."
        );

        return;
    }

    container.innerHTML = "";

    currentProducts = products || [];

    if (
        !products ||
        products.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-products">
                <h3>No products available</h3>
                <p>Add the first product to the marketplace.</p>
            </div>
        `;

        return;
    }

    products.forEach(
        (product) => {

            const card =
                document.createElement("div");

            card.className =
                "product-card";

            const name =
                product.metadata?.name ||
                "Unnamed product";

            const imageUrl =
                convertIPFSUrl(
                    product.metadata?.image
                );

            const priceFormatted =
                ethers.formatEther(
                    product.price
                );

            card.innerHTML = `
                <img
                    class="product-image"
                    src="${imageUrl}"
                    alt="${escapeHtml(name)}"
                    onerror="this.src='';"
                >

                <div class="product-content">

                    <h3>
                        ${escapeHtml(name)}
                    </h3>

                    <div class="price">
                        ${priceFormatted} ETH
                    </div>

                    <p class="token-id">
                        NFT #${product.tokenId}
                    </p>

                    <p class="seller">
                        Seller:
                        ${shortAddress(product.seller)}
                    </p>

                    <button
                        class="buy-btn"
                        onclick="buyProduct(${product.tokenId})"
                        ${!product.active ? "disabled" : ""}
                    >
                        ${
                            product.active
                                ? "Buy Product"
                                : "Sold"
                        }
                    </button>

                    <button
                        class="buy-btn cart-btn"
                        data-cart-btn="${product.tokenId}"
                        onclick="toggleCart(${product.tokenId})"
                        ${!product.active ? "disabled" : ""}
                    >
                        Add to Cart
                    </button>

                </div>
            `;

            container.appendChild(card);
        }
    );

    renderCart();
}



// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// SHORT ADDRESS
// ============================================================

function shortAddress(address) {

    if (!address) {
        return "Unknown";
    }

    return (
        address.slice(0, 6) +
        "..." +
        address.slice(-4)
    );
}

// ============================================================
// REFRESH PRODUCTS
// ============================================================

async function refreshProducts() {

    try {

        if (!account) {

            showToast(
                "Please connect your wallet first."
            );

            return;
        }

        await loadProducts();

        showToast(
            "Products refreshed."
        );

    } catch (error) {

        console.error(
            "Refresh Products Error:",
            error
        );

        showToast(
            "Unable to refresh products."
        );
    }
}

// ============================================================
// REFRESH WHOLE DAPP (products + loyalty balance)
// ============================================================

async function refreshDApp() {

    try {

        if (!account) {

            showToast(
                "Please connect your wallet first."
            );

            return;
        }

        await loadProducts();

        if (
            typeof loadRewardBalance ===
            "function"
        ) {

            await loadRewardBalance();
        }

        showToast(
            "DApp refreshed."
        );

    } catch (error) {

        console.error(
            "Refresh DApp Error:",
            error
        );

        showToast(
            "Unable to refresh."
        );
    }
}

// ============================================================
// ADD PRODUCT
// ============================================================

async function addProduct() {

    const button =
        document.getElementById(
            "addProductBtn"
        );

    try {

        // ====================================================
        // CHECK WALLET
        // ====================================================

        if (
            !signer ||
            !account
        ) {

            showToast(
                "Please connect your wallet first."
            );

            return;
        }

        // ====================================================
        // ONLY THE ADMIN CAN ADD PRODUCTS
        // ====================================================

        if (!(await checkAdmin())) {

            showToast(
                "Only the admin account can add products."
            );

            return;
        }

        // ====================================================
        // CHECK CONTRACTS
        // ====================================================

        if (!nft) {

            throw new Error(
                "NFT contract is not initialized."
            );
        }

        if (!marketplace) {

            throw new Error(
                "Marketplace contract is not initialized."
            );
        }

        // ====================================================
        // GET FORM VALUES
        // ====================================================

        const nameElement =
            document.getElementById(
                "productName"
            );

      

        const priceElement =
            document.getElementById(
                "productPrice"
            );

        const imageElement =
            document.getElementById(
                "productImage"
            );

        const name =
            nameElement
                ?.value
                ?.trim();

        const price =
            priceElement
                ?.value
                ?.trim();

        const image =
            imageElement
                ?.files?.[0];

        // ====================================================
        // VALIDATION
        // ====================================================

        if (!name) {

            showToast(
                "Enter a product name."
            );

            return;
        }

        if (!price) {

            showToast(
                "Enter a product price."
            );

            return;
        }

        if (
            Number(price) <= 0
        ) {

            showToast(
                "Price must be greater than zero."
            );

            return;
        }

        if (!image) {

            showToast(
                "Please select a product image."
            );

            return;
        }

        if (
            !image.type ||
            !image.type.startsWith(
                "image/"
            )
        ) {

            showToast(
                "Please select a valid image."
            );

            return;
        }

        if (
            image.size >
            10 * 1024 * 1024
        ) {

            showToast(
                "Image must be smaller than 10 MB."
            );

            return;
        }

        // ====================================================
        // DISABLE BUTTON
        // ====================================================

        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Uploading Image...";
        }

        // ====================================================
        // STEP 1
        // UPLOAD IMAGE TO PINATA
        // ====================================================

        setFormStatus(
            "Uploading image to IPFS..."
        );

        const imageForm =
            new FormData();

        imageForm.append(
            "image",
            image
        );

        const imageResponse =
            await fetch(
                "/upload-image",
                {
                    method: "POST",

                    body: imageForm
                }
            );

        const imageData =
            await safeJson(
                imageResponse
            );

        if (
            !imageResponse.ok ||
            !imageData.success
        ) {

            throw new Error(
                imageData.message ||
                "Image upload failed."
            );
        }

        const imageURL =
            imageData.imageURL;

        if (!imageURL) {

            throw new Error(
                "Image upload did not return an IPFS URL."
            );
        }

        console.log(
            "Image IPFS URL:",
            imageURL
        );

        // ====================================================
        // STEP 2
        // UPLOAD METADATA
        // ====================================================

        if (button) {

            button.textContent =
                "Creating Metadata...";
        }

        setFormStatus(
            "Creating NFT metadata..."
        );

        const metadataResponse =
            await fetch(
                "/upload-metadata",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            name:
                                name,

                            image:
                                imageURL
                        })
                }
            );

        const metadataData =
            await safeJson(
                metadataResponse
            );

        if (
            !metadataResponse.ok ||
            !metadataData.success
        ) {

            throw new Error(
                metadataData.message ||
                "Metadata upload failed."
            );
        }

        const metadataURI =
            metadataData.metadataURI;

        if (!metadataURI) {

            throw new Error(
                "Metadata upload did not return an IPFS URI."
            );
        }

        console.log(
            "Metadata URI:",
            metadataURI
        );

        // ====================================================
        // STEP 3
        // MINT + LIST IN ONE TRANSACTION
        // ====================================================

        if (button) {

            button.textContent =
                "Confirm in MetaMask...";
        }

        setFormStatus(
            "Confirm minting & listing in MetaMask..."
        );

        const listingPrice =
            ethers.parseEther(
                price
            );

        console.log(
            "Minting + listing product. Price:",
            listingPrice.toString()
        );

        console.log(
            "Marketplace:",
            MARKETPLACE_ADDRESS
        );

        const mintAndListTx =
            await marketplace.mintAndList(
                metadataURI,
                listingPrice
            );

        console.log(
            "Mint + List transaction:",
            mintAndListTx.hash
        );

        setFormStatus(
            "Waiting for confirmation..."
        );

        const receipt =
            await mintAndListTx.wait();

        // ====================================================
        // GET TOKEN ID FROM EVENT LOGS
        // ====================================================

        let tokenId = null;

        try {

            for (
                const log of
                receipt.logs
            ) {

                const parsed =
                    marketplace.interface.parseLog(
                        log
                    );

                if (
                    parsed &&
                    parsed.name ===
                    "ProductListed"
                ) {

                    tokenId =
                        Number(
                            parsed.args
                                .tokenId
                        );

                    break;
                }
            }

        } catch (parseError) {

            console.warn(
                "Could not parse tokenId from logs:",
                parseError
            );
        }

        // ====================================================
        // SUCCESS
        // ====================================================

        console.log(
            "Product listed successfully."
        );

        console.log(
            "NFT:",
            tokenId
        );

        console.log(
            "Mint + List transaction:",
            mintAndListTx.hash
        );

        // ====================================================
        // CLEAR FORM
        // ====================================================

        clearForm();

        if (
            typeof hideProductForm ===
            "function"
        ) {

            hideProductForm();
        }

        // ====================================================
        // REFRESH PRODUCTS
        // ====================================================

        await loadProducts();

        // ====================================================
        // REFRESH LOYALTY
        // ====================================================

        if (
            typeof loadRewardBalance ===
            "function"
        ) {

            await loadRewardBalance();
        }

        // ====================================================
        // SUCCESS MESSAGE
        // ====================================================

        showToast(
            tokenId
                ? `Product added successfully. NFT #${tokenId}`
                : "Product added successfully."
        );

    } catch (error) {

        console.error(
            "Add Product Error:",
            error
        );

        const message =
            getErrorMessage(
                error
            );

        if (
            error?.code === 4001 ||
            error?.code ===
            "ACTION_REJECTED"
        ) {

            showToast(
                "Transaction rejected in MetaMask."
            );

        } else {

            showToast(
                "Add Product failed: " +
                message
            );
        }

    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Add Product";
        }

        setFormStatus("");
    }
}


// ============================================================
// SHOW / HIDE PRODUCT FORM (popup)
// ============================================================

function showProductForm() {

    const popup =
        document.getElementById(
            "productForm"
        );

    if (!popup) {

        console.warn(
            "Product form popup not found in index.html."
        );

        return;
    }

    popup.style.display = "flex";
}

function hideProductForm() {

    const popup =
        document.getElementById(
            "productForm"
        );

    if (!popup) {

        return;
    }

    popup.style.display = "none";

    if (
        typeof clearForm ===
        "function"
    ) {

        clearForm();
    }
}

// ============================================================
// CLEAR PRODUCT FORM
// ============================================================

function clearForm() {

    const name =
        document.getElementById(
            "productName"
        );

    const price =
        document.getElementById(
            "productPrice"
        );

    const image =
        document.getElementById(
            "productImage"
        );

    if (name) {

        name.value = "";
    }

    if (price) {

        price.value = "";
    }

    if (image) {

        image.value = "";
    }
}
// ============================================================
// BUY PRODUCT
// ============================================================

async function buyProduct(tokenId) {

    // "Buy Product" button = an order with just this one product
    await checkout([Number(tokenId)]);
}

async function checkout(tokenIds, preChosenLoyalty) {

    try {

        // ====================================================
        // CHECK WALLET + CONTRACT
        // ====================================================

        if (!signer || !account) {

            showToast("Please connect your wallet first.");

            return;
        }

        if (!marketplace) {

            throw new Error(
                "Marketplace contract is not initialized."
            );
        }

        if (!tokenIds || tokenIds.length === 0) {

            showToast("Your cart is empty.");

            return;
        }

        // ====================================================
        // CHECK EVERY PRODUCT + ADD UP THE TOTAL
        // ====================================================

        let totalPrice = 0n;

        for (const tokenId of tokenIds) {

            const product =
                await marketplace.getProduct(tokenId);

            // product[1] = seller, product[2] = price, product[4] = active

            if (!product[4]) {

                showToast(
                    `NFT #${tokenId} is no longer available.`
                );

                await loadProducts();

                return;
            }

            if (
                product[1].toLowerCase() ===
                account.toLowerCase()
            ) {

                showToast(
                    "You cannot buy your own product."
                );

                return;
            }

            totalPrice += product[2];
        }

        const totalFormatted =
            ethers.formatEther(totalPrice);

        // ====================================================
        // LOYALTY DISCOUNT (once per order, on the total)
        // ====================================================

        let loyaltyBalance = 0n;

        try {

            loyaltyBalance =
                await marketplace.getLoyaltyBalance(account);

        } catch (error) {

            console.error("Loyalty balance error:", error);
        }

        const DISCOUNT_THRESHOLD =
            ethers.parseEther("3");

        const DISCOUNT_AMOUNT =
            ethers.parseEther("0.5");

        const canUseLoyalty =
            loyaltyBalance >= DISCOUNT_THRESHOLD &&
            totalPrice > DISCOUNT_AMOUNT;

        // LOYAL earned is calculated by the contract on the ETH paid
        async function rewardFor(ethAmount) {

            try {

                return await marketplace.calculateReward(ethAmount);

            } catch (error) {

                return 0n;
            }
        }

        let useLoyalty = false;

        if (preChosenLoyalty !== undefined) {

            // the buyer already decided in the cart
            useLoyalty =
                canUseLoyalty && preChosenLoyalty === true;

        } else if (canUseLoyalty) {

            const discounted = totalPrice - DISCOUNT_AMOUNT;

            const rewardWithout = await rewardFor(totalPrice);

            // OK = use LOYAL, Cancel = no LOYAL (pay full, keep tokens)
            useLoyalty = window.confirm(
                `${tokenIds.length} product(s), total ${totalFormatted} ETH.\n\n` +
                `OK = Use 3 LOYAL now, pay ${ethers.formatEther(discounted)} ETH` +
                ` (earn 0 LOYAL on this order)\n` +
                `Cancel = Skip discount, keep my LOYAL for next time, pay full ${totalFormatted} ETH` +
                ` (earn ${ethers.formatEther(rewardWithout)} LOYAL)`
            );
        }

        const ethToPay =
            useLoyalty
                ? totalPrice - DISCOUNT_AMOUNT
                : totalPrice;

        // no new LOYAL on an order where LOYAL are used
        const earned =
            useLoyalty
                ? 0n
                : await rewardFor(totalPrice);

        // ====================================================
        // BUY (one transaction for the whole order)
        // ====================================================

        showToast("Confirm purchase in MetaMask.");

        const buyTx =
            await marketplace.buyProducts(
                tokenIds,
                useLoyalty,
                { value: ethToPay }
            );

        setFormStatus("Waiting for purchase confirmation...");

        await buyTx.wait();

        console.log("Order purchased:", buyTx.hash);
        console.log("NFTs:", tokenIds);
        console.log("ETH paid:", ethers.formatEther(ethToPay));

        // ====================================================
        // REFRESH
        // ====================================================

        cart = cart.filter(
            (item) => !tokenIds.includes(item.tokenId)
        );

        cartUseLoyalty = false;

        await loadProducts();

        if (typeof loadRewardBalance === "function") {

            await loadRewardBalance();
        }

        renderCart();

        showToast(
            earned > 0n
                ? `Purchase successful! You earned ${ethers.formatEther(earned)} LOYAL.`
                : "Purchase successful! Spend 1 ETH or more, without using LOYAL, to earn LOYAL."
        );

    } catch (error) {

        console.error("Checkout Error:", error);

        if (
            error?.code === 4001 ||
            error?.code === "ACTION_REJECTED"
        ) {

            showToast("Transaction rejected in MetaMask.");

        } else {

            showToast(
                "Purchase failed: " + getErrorMessage(error)
            );
        }

    } finally {

        setFormStatus("");
    }
}



async function addLoyaltyTokenToMetaMask(
    force
) {

    try {

        if (
            !window.ethereum ||
            !LOYALTY_ADDRESS
        ) {

            return;
        }

        if (
            !force &&
            sessionStorage.getItem(
                "loyaltyTokenWatchPrompted"
            )
        ) {

            return;
        }

        await window.ethereum.request({

            method:
                "wallet_watchAsset",

            params: {

                type:
                    "ERC20",

                options: {

                    address:
                        LOYALTY_ADDRESS,

                    symbol:
                        "LOYAL",

                    decimals:
                        18
                }
            }
        });

        sessionStorage.setItem(
            "loyaltyTokenWatchPrompted",
            "true"
        );

    } catch (error) {

       
        console.warn(
            "Could not prompt to add LOYAL token:",
            error
        );
    }
}


// ============================================================
// LOAD LOYALTY BALANCE
// ============================================================

async function loadRewardBalance() {

    try {

        if (
            !marketplace ||
            !account
        ) {

            return;
        }

        const balance =
            await marketplace.getLoyaltyBalance(
                account
            );

        const formatted =
            ethers.formatEther(
                balance
            );

        console.log(
            "LOYAL balance:",
            formatted
        );

        // Try several possible IDs
        const balanceElement =
            document.getElementById(
                "loyaltyBalance"
            ) ||
            document.getElementById(
                "rewardBalance"
            ) ||
            document.getElementById(
                "loyalBalance"
            );

        if (balanceElement) {

            balanceElement.textContent =
                `${formatted} LOYAL`;
        }

    } catch (error) {

        console.error(
            "Load Loyalty Balance Error:",
            error
        );
    }
}