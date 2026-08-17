// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoyaltyToken is ERC20, Ownable {

    address public marketplace;

    constructor()
        ERC20("Loyalty Token", "LOYAL")
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

        transferOwnership(
            _marketplace
        );
    }

    // =========================================================
    // MINT REWARD
    // =========================================================

    function mintReward(
        address user,
        uint256 amount
    )
        external
        onlyOwner
    {
        require(
            user != address(0),
            "Invalid user"
        );

        require(
            amount > 0,
            "Invalid amount"
        );

        _mint(
            user,
            amount
        );
    }

    // =========================================================
    // REDEEM REWARD
    // =========================================================

    function redeemReward(
        address user,
        uint256 amount
    )
        external
        onlyOwner
    {
        require(
            user != address(0),
            "Invalid user"
        );

        require(
            amount > 0,
            "Invalid amount"
        );

        _burn(
            user,
            amount
        );
    }
}