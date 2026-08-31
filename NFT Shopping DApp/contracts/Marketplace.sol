// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface INFT {

    function ownerOf(
        uint256 tokenId
    )
        external
        view
        returns (address);

    function getApproved(
        uint256 tokenId
    )
        external
        view
        returns (address);

    function isApprovedForAll(
        address owner,
        address operator
    )
        external
        view
        returns (bool);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        external;

    function mintForMarketplace(
        string memory uri
    )
        external
        returns (uint256);
}

interface ILoyaltyToken {

    function mintReward(
        address user,
        uint256 amount
    )
        external;

    function redeemReward(
        address user,
        uint256 amount
    )
        external;

    function balanceOf(
        address user
    )
        external
        view
        returns (uint256);
}

contract Marketplace {

    // =========================================================
    // CONTRACTS
    // =========================================================

    INFT public nftContract;

    ILoyaltyToken public loyaltyToken;


    // =========================================================
    // LOYALTY REWARD
    // =========================================================

    uint256 public constant REWARD_AMOUNT =
        1 ether;


    // =========================================================
    // PRODUCT
    // =========================================================

    struct Product {

        uint256 tokenId;

        address seller;

        uint256 price;

        string metadataURI;

        bool active;
    }

    mapping(uint256 => Product)
        public products;

    uint256[] private productIds;


    // =========================================================
    // EVENTS
    // =========================================================

    event ProductListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        string metadataURI
    );

    event ProductPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 ethPaid,
        uint256 loyaltyUsed
    );

    event LoyaltyRewarded(
        address indexed user,
        uint256 amount
    );


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    constructor(
        address _nftAddress,
        address _loyaltyAddress
    )
    {
        require(
            _nftAddress != address(0),
            "Invalid NFT address"
        );

        require(
            _loyaltyAddress != address(0),
            "Invalid loyalty address"
        );

        nftContract =
            INFT(_nftAddress);

        loyaltyToken =
            ILoyaltyToken(_loyaltyAddress);
    }


    // =========================================================
    // ERC721 RECEIVER HOOK
    // =========================================================
    //
    // Required because MyNFT.mintForMarketplace() mints straight
    // to this contract using _safeMint, which checks that the
    // recipient correctly implements IERC721Receiver before the
    // mint is allowed to go through. Without this function every
    // mintAndList() call reverts with ERC721InvalidReceiver.

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    )
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }


    // =========================================================
    // MINT + LIST PRODUCT (single transaction)
    // =========================================================
    //
    // Mints a brand-new NFT directly into this Marketplace's own
    // custody (via mintForMarketplace) and lists it for sale, all
    // in one call - so the seller only ever signs ONE transaction
    // instead of mint -> approve -> list.

    function mintAndList(
        string memory metadataURI,
        uint256 price
    )
        external
        returns (uint256)
    {
        require(
            price > 0,
            "Price must be greater than zero"
        );

        uint256 tokenId =
            nftContract.mintForMarketplace(
                metadataURI
            );

        products[tokenId] =
            Product({

                tokenId:
                    tokenId,

                seller:
                    msg.sender,

                price:
                    price,

                metadataURI:
                    metadataURI,

                active:
                    true
            });

        productIds.push(
            tokenId
        );

        emit ProductListed(
            tokenId,
            msg.sender,
            price,
            metadataURI
        );

        return tokenId;
    }


    // =========================================================
    // LOYALTY DISCOUNT SETTINGS
    // =========================================================
    //
    // Hold at least DISCOUNT_THRESHOLD LOYAL tokens at the time
    // of purchase and DISCOUNT_AMOUNT is automatically taken off
    // the price - no manual redemption step. Those tokens are
    // then burned as the "payment" for that discount.

    uint256 public constant DISCOUNT_THRESHOLD =
        3 ether; // 3 LOYAL tokens (18 decimals, same as ETH)

    uint256 public constant DISCOUNT_AMOUNT =
        0.5 ether; // 0.5 ETH off


    // =========================================================
    // BUY PRODUCT
    // =========================================================

    function buyNFT(
        uint256 tokenId
    )
        external
        payable
    {
        Product storage product =
            products[tokenId];

        require(
            product.active,
            "Product is not available"
        );

        require(
            msg.sender != product.seller,
            "Seller cannot buy"
        );


        // =====================================================
        // AUTOMATIC LOYALTY DISCOUNT
        // =====================================================

        uint256 loyaltyValue = 0;

        bool qualifiesForDiscount =
            loyaltyToken.balanceOf(msg.sender) >=
                DISCOUNT_THRESHOLD
            &&
            product.price >
                DISCOUNT_AMOUNT;

        if (qualifiesForDiscount) {

            loyaltyValue =
                DISCOUNT_AMOUNT;

            loyaltyToken.redeemReward(
                msg.sender,
                DISCOUNT_THRESHOLD
            );
        }


        // =====================================================
        // ETH PAYMENT
        // =====================================================

        uint256 ethToPay =
            product.price -
            loyaltyValue;

        require(
            msg.value >= ethToPay,
            "Insufficient ETH"
        );


        // =====================================================
        // CLOSE LISTING
        // =====================================================

        product.active = false;


        // =====================================================
        // PAY SELLER
        // =====================================================

        if (ethToPay > 0) {

            (bool success, ) =
                payable(product.seller).call{
                    value: ethToPay
                }("");

            require(
                success,
                "ETH payment failed"
            );
        }


        // =====================================================
        // TRANSFER NFT
        // =====================================================

        nftContract.safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );


        // =====================================================
        // REWARD BUYER
        // =====================================================
        //
        // Only reward when the buyer actually paid real ETH.
        // If the purchase was fully covered by LOYAL tokens,
        // no new token is minted - otherwise spending a token
        // and immediately earning one back would make the
        // balance look like it never changed.

        if (ethToPay > 0) {

            loyaltyToken.mintReward(
                msg.sender,
                REWARD_AMOUNT
            );

            emit LoyaltyRewarded(
                msg.sender,
                REWARD_AMOUNT
            );
        }


        emit ProductPurchased(
            tokenId,
            msg.sender,
            ethToPay,
            loyaltyValue
        );


        // =====================================================
        // REFUND
        // =====================================================

        if (msg.value > ethToPay) {

            uint256 refund =
                msg.value -
                ethToPay;

            (bool refundSuccess, ) =
                payable(msg.sender).call{
                    value: refund
                }("");

            require(
                refundSuccess,
                "Refund failed"
            );
        }
    }


    // =========================================================
    // GET PRODUCT
    // =========================================================

    function getProduct(
        uint256 tokenId
    )
        external
        view
        returns (
            uint256,
            address,
            uint256,
            string memory,
            bool
        )
    {
        Product memory product =
            products[tokenId];

        return (
            product.tokenId,
            product.seller,
            product.price,
            product.metadataURI,
            product.active
        );
    }


    // =========================================================
    // PRODUCT COUNT
    // =========================================================

    function getProductCount()
        external
        view
        returns (uint256)
    {
        return productIds.length;
    }


    // =========================================================
    // PRODUCT ID
    // =========================================================

    function getProductId(
        uint256 index
    )
        external
        view
        returns (uint256)
    {
        require(
            index < productIds.length,
            "Invalid index"
        );

        return productIds[index];
    }


    // =========================================================
    // ALL PRODUCT IDS
    // =========================================================

    function getAllProductIds()
        external
        view
        returns (uint256[] memory)
    {
        return productIds;
    }


    // =========================================================
    // LOYALTY BALANCE
    // =========================================================

    function getLoyaltyBalance(
        address user
    )
        external
        view
        returns (uint256)
    {
        return loyaltyToken.balanceOf(
            user
        );
    }
}