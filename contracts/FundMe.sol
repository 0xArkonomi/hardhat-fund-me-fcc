// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";

error FundMe__NotOwner();

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
    address private immutable owenr;

    /// @dev An array of addresses representing funders who have contributed to the contract.
    address[] private funders; 

    /// @dev A mapping that associates each funder's address with the amount they've funded.
    mapping(address => uint256) private addressToAmountFunded;

    /// @dev An instance of the Chainlink Price Feed interface used for price conversion.
    AggregatorV3Interface private priceFeed;


    // Events (we have none!)

    // Modifiers
    modifier onlyOwner() {
        // require(msg.sender == owenr);
        if (msg.sender != owenr) revert FundMe__NotOwner();
        _;
    }

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        owenr = msg.sender;
    }


    // The modifier order for a function should be:
    //  1.Visibility
    //  2.Mutability
    //  3.Virtual
    //  4.Override
    //  5.Custom modifiers

    /// @notice Funds our contract based on the ETH/USD price
    function fund() public payable {
        require(
            msg.value.getConversionRate(priceFeed) >= MINIMUM_USD,
            "You need to spend more ETH!"
        );
        // require(PriceConverter.getConversionRate(msg.value) >= MINIMUM_USD, "You need to spend more ETH!");
        addressToAmountFunded[msg.sender] += msg.value;
        funders.push(msg.sender);
    }

    function withdraw() public onlyOwner {
        for (
            uint256 funderIndex = 0;
            funderIndex < funders.length;
            funderIndex++
        ) {
            address funder = funders[funderIndex];
            addressToAmountFunded[funder] = 0;
        }
        funders = new address[](0);
        // Transfer vs call vs Send
        // payable(msg.sender).transfer(address(this).balance);
        (bool success, ) = owenr.call{value: address(this).balance}("");
        require(success, "Withdrawal failed.");
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
        (bool success, ) = owenr.call{value: address(this).balance}("");
        require(success, "cheaperWithdraw failed.");

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
        return owenr;
    }

    function getPriceFeed() public view returns (AggregatorV3Interface) {
        return priceFeed;
    }
}
