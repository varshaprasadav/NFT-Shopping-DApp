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
    // BUY PRODUCT
    // =========================================================

    function buyNFT(
        uint256 tokenId,
        uint256 loyaltyUsed
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
        // LOYALTY PAYMENT
        // =====================================================

        uint256 loyaltyValue = 0;

        if (loyaltyUsed > 0) {

            uint256 balance =
                loyaltyToken.balanceOf(
                    msg.sender
                );

            require(
                balance >= loyaltyUsed,
                "Insufficient loyalty tokens"
            );

            loyaltyValue =
                loyaltyUsed;

            require(
                loyaltyValue <= product.price,
                "Too many loyalty tokens"
            );

            loyaltyToken.redeemReward(
                msg.sender,
                loyaltyUsed
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
            loyaltyUsed
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