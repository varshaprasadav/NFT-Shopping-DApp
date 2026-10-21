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
    // ADMIN
    // =========================================================
    
    address public admin;

    modifier onlyAdmin() {
        require(
            msg.sender == admin,
            "Only admin can add products"
        );
        _;
    }


    // =========================================================
    // LOYALTY REWARD
    // =========================================================

    

    uint256 public constant MAX_ITEMS_PER_ORDER =
        20;

    function calculateReward(
        uint256 ethPaid
    )
        public
        pure
        returns (uint256)
    {
        if (ethPaid < 1 ether)  return 0;
        if (ethPaid <= 5 ether)  return 2 ether;   // 1 - 5 ETH
        if (ethPaid <= 10 ether) return 4 ether;   // above 5 - 10
        if (ethPaid <= 20 ether) return 6 ether;   // above 10 - 20
        if (ethPaid <= 50 ether) return 10 ether;  // above 20 - 50
        return 15 ether;                           // above 50
    }


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

        admin = msg.sender;

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
  

    function mintAndList(
        string memory metadataURI,
        uint256 price
    )
        external
        onlyAdmin
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
    

    uint256 public constant DISCOUNT_THRESHOLD =
        3 ether; // 3 LOYAL tokens (18 decimals, same as ETH)

    uint256 public constant DISCOUNT_AMOUNT =
        0.5 ether; // 0.5 ETH off


    // =========================================================
    // BUY ONE OR MANY PRODUCTS IN A SINGLE ORDER
    // =========================================================
   

    event OrderCompleted(
        address indexed buyer,
        uint256 itemCount,
        uint256 ethPaid,
        uint256 loyaltyUsed,
        uint256 loyaltyEarned
    );

    function buyProducts(
        uint256[] calldata tokenIds,
        bool useLoyalty
    )
        external
        payable
    {
        uint256 count =
            tokenIds.length;

        require(
            count > 0,
            "Cart is empty"
        );

        require(
            count <= MAX_ITEMS_PER_ORDER,
            "Too many products in one order"
        );


        // =====================================================
        // CHECK PRODUCTS + ADD UP THE TOTAL
        // =====================================================
        

        uint256 totalPrice = 0;

        for (uint256 i = 0; i < count; i++) {

            Product storage product =
                products[tokenIds[i]];

            require(
                product.active,
                "Product is not available"
            );

            require(
                msg.sender != product.seller,
                "Seller cannot buy"
            );

            product.active = false;

            totalPrice += product.price;
        }


        // =====================================================
        // OPTIONAL LOYALTY DISCOUNT (once per order)
        // =====================================================

        uint256 loyaltyValue = 0;
        uint256 loyaltyBurned = 0;

        if (useLoyalty) {

            require(
                loyaltyToken.balanceOf(msg.sender) >=
                    DISCOUNT_THRESHOLD,
                "Not enough LOYAL tokens"
            );

            require(
                totalPrice > DISCOUNT_AMOUNT,
                "Total too low for discount"
            );

            loyaltyValue =
                DISCOUNT_AMOUNT;

            loyaltyBurned =
                DISCOUNT_THRESHOLD;

            loyaltyToken.redeemReward(
                msg.sender,
                DISCOUNT_THRESHOLD
            );
        }


        // =====================================================
        // ETH PAYMENT
        // =====================================================

        uint256 ethToPay =
            totalPrice -
            loyaltyValue;

        require(
            msg.value >= ethToPay,
            "Insufficient ETH"
        );

        // Every product is listed by the admin, so the
        // admin receives the payment.

        if (ethToPay > 0) {

            (bool success, ) =
                payable(admin).call{
                    value: ethToPay
                }("");

            require(
                success,
                "ETH payment failed"
            );
        }


        // =====================================================
        // TRANSFER ALL NFTs TO THE BUYER
        // =====================================================

        for (uint256 i = 0; i < count; i++) {

            nftContract.safeTransferFrom(
                address(this),
                msg.sender,
                tokenIds[i]
            );

            emit ProductPurchased(
                tokenIds[i],
                msg.sender,
                products[tokenIds[i]].price,
                0
            );
        }


        // =====================================================
        // REWARD BUYER BASED ON THE TOTAL ETH PAID
        // =====================================================

        // No new LOYAL on an order where LOYAL were used.

        uint256 reward =
            useLoyalty
                ? 0
                : calculateReward(
                    ethToPay
                );

        if (reward > 0) {

            loyaltyToken.mintReward(
                msg.sender,
                reward
            );

            emit LoyaltyRewarded(
                msg.sender,
                reward
            );
        }

        emit OrderCompleted(
            msg.sender,
            count,
            ethToPay,
            loyaltyBurned,
            reward
        );


        // =====================================================
        // REFUND ANY EXTRA ETH
        // =====================================================

        if (msg.value > ethToPay) {

            (bool refundSuccess, ) =
                payable(msg.sender).call{
                    value: msg.value - ethToPay
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