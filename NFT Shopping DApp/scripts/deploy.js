const hre = require("hardhat");

async function main() {

    const [deployer] =
        await hre.ethers.getSigners();

    console.log(
        "Deploying with account:",
        deployer.address
    );

    // ============================================================
    // 1. DEPLOY LOYALTY TOKEN
    // ============================================================

    const LoyaltyToken =
        await hre.ethers.getContractFactory(
            "LoyaltyToken"
        );

    const loyaltyToken =
        await LoyaltyToken.deploy();

    await loyaltyToken.waitForDeployment();

    const loyaltyAddress =
        await loyaltyToken.getAddress();

    console.log(
        "LoyaltyToken deployed:",
        loyaltyAddress
    );

    // ============================================================
    // 2. DEPLOY NFT
    // ============================================================

    const MyNFT =
        await hre.ethers.getContractFactory(
            "MyNFT"
        );

    const nft =
        await MyNFT.deploy();

    await nft.waitForDeployment();

    const nftAddress =
        await nft.getAddress();

    console.log(
        "MyNFT deployed:",
        nftAddress
    );

    // ============================================================
    // 3. DEPLOY MARKETPLACE
    // ============================================================

    const Marketplace =
        await hre.ethers.getContractFactory(
            "Marketplace"
        );

    const marketplace =
        await Marketplace.deploy(
            nftAddress,
            loyaltyAddress
        );

    await marketplace.waitForDeployment();

    const marketplaceAddress =
        await marketplace.getAddress();

    console.log(
        "Marketplace deployed:",
        marketplaceAddress
    );

    // ============================================================
    // 4. WIRE MyNFT -> MARKETPLACE
    // ============================================================

    console.log(
        "Setting marketplace on MyNFT..."
    );

    const setNftMarketplaceTx =
        await nft.setMarketplace(
            marketplaceAddress
        );

    await setNftMarketplaceTx.wait();

    console.log(
        "MyNFT.marketplace set."
    );

    // ============================================================
    // 5. WIRE LoyaltyToken -> MARKETPLACE
    //    (this also transfers LoyaltyToken ownership to the
    //    Marketplace contract - do this LAST)
    // ============================================================

    console.log(
        "Setting marketplace on LoyaltyToken " +
        "(this transfers LoyaltyToken ownership)..."
    );

    const setLoyaltyMarketplaceTx =
        await loyaltyToken.setMarketplace(
            marketplaceAddress
        );

    await setLoyaltyMarketplaceTx.wait();

    console.log(
        "LoyaltyToken.marketplace set."
    );

    // ============================================================
    // SUMMARY
    // ============================================================

    console.log(
        "\n" +
        "============================================================\n" +
        "DEPLOYMENT COMPLETE - paste these into your .env file:\n" +
        "============================================================\n" +
        `NFT_ADDRESS=${nftAddress}\n` +
        `MARKETPLACE_ADDRESS=${marketplaceAddress}\n` +
        `LOYALTY_ADDRESS=${loyaltyAddress}\n` +
        "============================================================\n"
    );
}

main().catch((error) => {

    console.error(error);

    process.exitCode = 1;
});
