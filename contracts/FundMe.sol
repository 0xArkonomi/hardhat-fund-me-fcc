// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";

/**@title A sample Funding Contract
 * @author Patrick Collins - (Mohammad Mahdi Keshavarz Edition)
 * @notice Decentralized Funding Smart Contract Sample
 * @dev This implements price feeds as our library
 */
contract FundMe {
    // Type Declarations
    using PriceConverter for uint256;

    /// @notice Minimum required funding in USD-equivalent Ether.
    uint256 public constant MINIMUM_USD = 50 * 10 ** 18;

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
    modifier onlyOwner() {
        // require(msg.sender == owner);
        require(msg.sender == owner, "You're not the owner!");
        _;
    }

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        owner = msg.sender;
    }

    // The modifier order for a function should be:
    //  1.Visibility
    //  2.Mutability
    //  3.Virtual
    //  4.Override
    //  5.Custom modifiers

    /**
     * @notice Funds our contract based on the ETH/USD price
     * @dev Changed the `fund` function to be `external` for gas optimization since
     * external functions use less gas than public ones.
     */
    function fund() external payable {
        require(
            msg.value.getConversionRate(priceFeed) >= MINIMUM_USD,
            "You need to spend more ETH!"
        );
        // require(PriceConverter.getConversionRate(msg.value) >= MINIMUM_USD, "You need to spend more ETH!");
        addressToAmountFunded[msg.sender] += msg.value;
        funders.push(msg.sender);

        emit FundContribution(msg.sender, msg.value); // Emit the FundContribution event to log the contribution
    }

    function withdraw() public onlyOwner {
        for (
            uint256 funderIndex = 0;
            funderIndex < funders.length;
            funderIndex++
        ) {
            address funder = funders[funderIndex];
            addressToAmountFunded[funder] = 0; // It writes to the storage every time the `for` loop execute 
        }
        funders = new address[](0);
        uint256 balance = address(this).balance;
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdrawal failed."); // Added error message

        emit FundsWithdrawn(owner, balance);
    }

    function cheaperWithdraw() public onlyOwner {
        address[] memory tempFunders = funders;
        // mappings can't be in memory, sorry!
        for (
            uint256 funderIndex = 0;
            funderIndex < tempFunders.length;
            funderIndex++
        ) {
            address funder = tempFunders[funderIndex];
            addressToAmountFunded[funder] = 0;
        }
        funders = new address[](0);
        // payable(msg.sender).transfer(address(this).balance);
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "cheaperWithdraw failed.");

        emit FundsWithdrawn(owner, address(this).balance);
    }

    function updatePriceFeed(address newPriceFeedAddress) public onlyOwner {
        require(newPriceFeedAddress != address(0), "Invalid address provided");
        AggregatorV3Interface previousPriceFeed = priceFeed;
        priceFeed = AggregatorV3Interface(newPriceFeedAddress);

        emit PriceFeedUpdated(address(previousPriceFeed), newPriceFeedAddress);
    }

    /** @notice Gets the amount that an address has funded
     *  @param fundingAddress the address of the funder
     *  @return the amount funded
     */
    function getAddressToAmountFunded(address fundingAddress)
        public
        view
        returns (uint256)
    {
        return addressToAmountFunded[fundingAddress];
    }

    function getVersion() public view returns (uint256) {
        return priceFeed.version();
    }

    function getFunder(uint256 index) public view returns (address) {
        return funders[index];
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function getPriceFeed() public view returns (AggregatorV3Interface) {
        return priceFeed;
    }
}
