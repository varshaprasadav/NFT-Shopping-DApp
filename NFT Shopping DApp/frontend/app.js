
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

    "function buyNFT(uint256 tokenId,uint256 loyaltyUsed) payable",

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

                </div>
            `;

            container.appendChild(card);
        }
    );
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
        // CHECK MARKETPLACE
        // ====================================================

        if (!marketplace) {

            throw new Error(
                "Marketplace contract is not initialized."
            );
        }

        // ====================================================
        // GET PRODUCT
        // ====================================================

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

        const productPrice =
            product[2];

        const seller =
            product[1];

        const active =
            product[4];

        // ====================================================
        // CHECK PRODUCT
        // ====================================================

        if (!active) {

            showToast(
                "This product is no longer available."
            );

            await loadProducts();

            return;
        }

        if (
            seller.toLowerCase() ===
            account.toLowerCase()
        ) {

            showToast(
                "You cannot buy your own product."
            );

            return;
        }

        // ====================================================
        // GET LOYALTY BALANCE
        // ====================================================

        let loyaltyBalance =
            0n;

        try {

            loyaltyBalance =
                await marketplace.getLoyaltyBalance(
                    account
                );

        } catch (error) {

            console.error(
                "Loyalty balance error:",
                error
            );

            loyaltyBalance =
                0n;
        }

        const loyaltyBalanceFormatted =
            ethers.formatEther(
                loyaltyBalance
            );

        const productPriceFormatted =
            ethers.formatEther(
                productPrice
            );

        // ====================================================
        // ASK CUSTOMER HOW MANY LOYAL TO USE
        // ====================================================

        let loyaltyUsed =
            0n;

        if (
            loyaltyBalance > 0n
        ) {

            const input =
                prompt(
                    `Product price: ${productPriceFormatted} ETH\n` +
                    `Your LOYAL balance: ${loyaltyBalanceFormatted} LOYAL\n\n` +
                    `How many LOYAL tokens do you want to use?\n` +
                    `Enter 0 to pay completely with ETH.`
                );

            // User pressed Cancel
            if (
                input === null
            ) {

                return;
            }

            const loyaltyText =
                input.trim();

            if (
                loyaltyText === ""
            ) {

                loyaltyUsed =
                    0n;

            } else {

                if (
                    !/^\d+(\.\d+)?$/.test(
                        loyaltyText
                    )
                ) {

                    showToast(
                        "Enter a valid LOYAL amount."
                    );

                    return;
                }

                loyaltyUsed =
                    ethers.parseUnits(
                        loyaltyText,
                        18
                    );
            }

        } else {

            loyaltyUsed =
                0n;
        }

        // ====================================================
        // CHECK LOYALTY AMOUNT
        // ====================================================

        if (
            loyaltyUsed >
            loyaltyBalance
        ) {

            showToast(
                "You do not have enough LOYAL tokens."
            );

            return;
        }

        if (
            loyaltyUsed >
            productPrice
        ) {

            showToast(
                "LOYAL discount cannot be greater than the product price."
            );

            return;
        }

        // ====================================================
        // CALCULATE ETH
        // ====================================================

        const ethToPay =
            productPrice -
            loyaltyUsed;

        const ethToPayFormatted =
            ethers.formatEther(
                ethToPay
            );

        const loyaltyUsedFormatted =
            ethers.formatEther(
                loyaltyUsed
            );

        // ====================================================
        // FINAL CONFIRMATION
        // ====================================================

        const confirmationMessage =
            `Purchase Product #${tokenId}\n\n` +
            `Product price: ${productPriceFormatted} ETH\n` +
            `LOYAL used: ${loyaltyUsedFormatted}\n` +
            `ETH to pay: ${ethToPayFormatted} ETH\n\n` +
            `Continue with the purchase?`;

        const confirmed =
            window.confirm(
                confirmationMessage
            );

        if (!confirmed) {

            return;
        }

        // ====================================================
        // BUY
        // ====================================================

        showToast(
            "Confirm purchase in MetaMask."
        );

        const buyTx =
            await marketplace.buyNFT(
                tokenId,
                loyaltyUsed,
                {
                    value:
                        ethToPay
                }
            );

        console.log(
            "Purchase transaction:",
            buyTx.hash
        );

        // ====================================================
        // WAIT
        // ====================================================

        setFormStatus(
            "Waiting for purchase confirmation..."
        );

        await buyTx.wait();

        // ====================================================
        // SUCCESS
        // ====================================================

        console.log(
            "Product purchased successfully."
        );

        console.log(
            "NFT:",
            tokenId
        );

        console.log(
            "LOYAL used:",
            loyaltyUsedFormatted
        );

        console.log(
            "ETH paid:",
            ethToPayFormatted
        );

        console.log(
            "Purchase transaction:",
            buyTx.hash
        );

        // ====================================================
        // REFRESH PRODUCTS
        // ====================================================

        await loadProducts();

        // ====================================================
        // REFRESH LOYALTY BALANCE
        // ====================================================

        if (
            typeof loadRewardBalance ===
            "function"
        ) {

            await loadRewardBalance();
        }

        showToast(
            `Purchase successful! NFT #${tokenId}. You received 1 LOYAL reward.`
        );

    } catch (error) {

        console.error(
            "Buy Product Error:",
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
                "Purchase failed: " +
                message
            );
        }

    } finally {

        setFormStatus("");
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