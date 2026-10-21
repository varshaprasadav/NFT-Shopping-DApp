// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721URIStorage, Ownable {

    uint256 private _nextTokenId;

    address public marketplace;

    constructor()
        ERC721("Marketplace NFT", "MNFT")
        Ownable(msg.sender)
    {}

    // =========================================================
    // SET MARKETPLACE
    // =========================================================

    function setMarketplace(
        address _marketplace
    )
        external
        onlyOwner
    {
        require(
            _marketplace != address(0),
            "Invalid marketplace"
        );

        marketplace = _marketplace;
    }

    // =========================================================
    // MINT NFT
    // =========================================================

    function mintNFT(
        address to,
        string memory uri
    )
        external
        returns (uint256)
    {
        require(
            to == msg.sender,
            "Can only mint to yourself"
        );

        _nextTokenId++;

        uint256 tokenId =
            _nextTokenId;

        _safeMint(
            to,
            tokenId
        );

        _setTokenURI(
            tokenId,
            uri
        );

        return tokenId;
    }

   

    function mintForMarketplace(
        string memory uri
    )
        external
        returns (uint256)
    {
        require(
            msg.sender == marketplace,
            "Only marketplace can call this"
        );

        _nextTokenId++;

        uint256 tokenId =
            _nextTokenId;

        _safeMint(
            marketplace,
            tokenId
        );

        _setTokenURI(
            tokenId,
            uri
        );

        return tokenId;
    }

    // =========================================================
    // CURRENT TOKEN ID
    // =========================================================

    function getCurrentTokenId()
        external
        view
        returns (uint256)
    {
        return _nextTokenId;
    }
}