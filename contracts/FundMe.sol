// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";

/**
 * @title FundMe
 * @author Patrick Collins - (Mohammad Mahdi Keshavarz Edition)
 * @notice A sample decentralized funding smart contract.
 * @dev This contract implements price feeds using our library.
 */
contract FundMe {
    using PriceConverter for uint256;

    /// @notice Minimum required funding in USD-equivalent Ether.
    uint256 public constant MINIMUM_USD = 50 * 10**18;

    /// @dev The address of the contract owner who can withdraw funds.
    address private immutable owner;

    /// @dev An array of addresses representing funders who have contributed to the contract.
    address[] private funders;

    /// @dev A mapping that associates each funder's address with the amount they've funded.
    mapping(address => uint256) private addressToAmountFunded;

    /// @dev An instance of the Chainlink Price Feed interface used for price conversion.
    AggregatorV3Interface private priceFeed;

    event FundContribution(address indexed funder, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event PriceFeedUpdated(address previousPriceFeed, address newPriceFeed);

    // Modifiers

    /**
     * @dev Modifier to allow only the contract owner to access certain functions.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "You're not the owner!");
        _;
    }

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        owner = msg.sender;
    }

    /**
     * @notice Funds the contract based on the ETH/USD price.
     * @dev Changed the `fund` function to be `external` for gas optimization.
     * @dev External functions use less gas than public ones.
     */
    function fund() external payable {
        require(
            msg.value.getConversionRate(priceFeed) >= MINIMUM_USD,
            "You need to spend more ETH!"
        );
        addressToAmountFunded[msg.sender] += msg.value;
        funders.push(msg.sender);

        emit FundContribution(msg.sender, msg.value); // Emit the FundContribution event to log the contribution
    }

    function withdraw(uint256 amount) public onlyOwner {
        // Loop through the funders and reset their funded amount.
        for (
            uint256 funderIndex = 0;
            funderIndex < funders.length;
            funderIndex++
        ) {
            address funder = funders[funderIndex];
            addressToAmountFunded[funder] = 0; // This line writes to storage every time the loop executes.
        }
        funders = new address[](0);
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit FundsWithdrawn(owner, amount);
    }

    function updatePriceFeed(address newPriceFeedAddress) public onlyOwner {
        require(newPriceFeedAddress != address(0), "Invalid address provided");
        AggregatorV3Interface previousPriceFeed = priceFeed;
        priceFeed = AggregatorV3Interface(newPriceFeedAddress);

        emit PriceFeedUpdated(address(previousPriceFeed), newPriceFeedAddress);
    }

    /**
     * @notice Gets the amount that an address has funded.
     * @param fundingAddress The address of the funder.
     * @return The amount funded.
     */
    function getAddressToAmountFunded(address fundingAddress)
        public
        view
        returns (uint256)
    {
        return addressToAmountFunded[fundingAddress];
    }

    /**
     * @notice Get the version of the price feed.
     * @return The version of the price feed.
     */
    function getVersion() public view returns (uint256) {
        return priceFeed.version();
    }

    /**
     * @notice Get the address of a funder at a specific index.
     * @param index The index of the funder.
     * @return The address of the funder.
     */
    function getFunder(uint256 index) public view returns (address) {
        return funders[index];
    }

    /**
     * @notice Get the owner of the contract.
     * @return The address of the owner.
     */
    function getOwner() public view returns (address) {
        return owner;
    }

    /**
     * @notice Get the price feed interface.
     * @return The AggregatorV3Interface address used for price conversion.
     */
    function getPriceFeed() public view returns (AggregatorV3Interface) {
        return priceFeed;
    }

    /**
     * @notice Get the balance of the contract.
     * @return The contract's ETH balance.
     */
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
