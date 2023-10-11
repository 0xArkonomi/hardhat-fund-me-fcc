const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", function () {
        let fundMe
        let mockV3Aggregator
        let deployer
        const sendValue = ethers.utils.parseEther("1")

        beforeEach(async () => {
            // const accounts = await ethers.getSigners()
            // deployer = accounts[0]
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            fundMe = await ethers.getContract("FundMe", deployer)
            mockV3Aggregator = await ethers.getContract(
                "MockV3Aggregator",
                deployer
            )
        })

        describe("constructor", function () {
            it("sets the aggregator addresses correctly", async () => {
                const response = await fundMe.getPriceFeed()
                assert.equal(response, mockV3Aggregator.address)
            })
        })

        describe("fund", function () {
            // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
            // could also do assert.fail
            it("Fails if you don't send enough ETH", async () => {
                await expect(fundMe.fund()).to.be.revertedWith(
                    "You need to spend more ETH!"
                )
            })
            // we could be even more precise here by making sure exactly $50 works
            // but this is good enough for now
            it("Updates the amount funded data structure", async () => {
                await fundMe.fund({ value: sendValue })
                const response = await fundMe.getAddressToAmountFunded(
                    deployer
                )
                assert.equal(response.toString(), sendValue.toString())
            })
            it("Adds funder to array of funders", async () => {
                await fundMe.fund({ value: sendValue })
                const response = await fundMe.getFunder(0)
                assert.equal(response, deployer)
            })
            
            // Add additional test cases for improve branch coverage up to the 100%
            it("Funds when a funder sends exactly the minimum required amount in ETH", async () => {
                const minimumFundingAmount = ethers.utils.parseEther("50");
                await expect(fundMe.fund({ value: minimumFundingAmount })).to.not.be.reverted;
            })
            it("Funds when a funder sends more than the minimum required amount in ETH", async () => {
                const moreThanMinimumFundingAmount = ethers.utils.parseEther("51");
                await expect(fundMe.fund({ value: moreThanMinimumFundingAmount })).to.not.be.reverted;
            });
        })

        describe("withdraw", function () {
            beforeEach(async () => {
                await fundMe.fund({ value: sendValue })
            })
            it("withdraws ETH from a single funder", async () => {
                // Arrange
                const startingFundMeBalance =
                    await fundMe.provider.getBalance(fundMe.address)
                const startingDeployerBalance =
                    await fundMe.provider.getBalance(deployer)

                // Act
                const transactionResponse = await fundMe.withdraw()
                const transactionReceipt = await transactionResponse.wait()
                const { gasUsed, effectiveGasPrice } = transactionReceipt
                const gasCost = gasUsed.mul(effectiveGasPrice)

                const endingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const endingDeployerBalance =
                    await fundMe.provider.getBalance(deployer)

                // Assert
                // Maybe clean up to understand the testing
                assert.equal(endingFundMeBalance, 0)
                assert.equal(
                    startingFundMeBalance
                        .add(startingDeployerBalance)
                        .toString(),
                    endingDeployerBalance.add(gasCost).toString()
                )
            })
            // this test is overloaded. Ideally we'd split it into multiple tests
            // but for simplicity we left it as one
            it("is allows us to withdraw with multiple funders", async () => {
                // Arrange
                const accounts = await ethers.getSigners()
                for (i = 1; i < 6; i++) {
                    const fundMeConnectedContract = await fundMe.connect(
                        accounts[i]
                    )
                    await fundMeConnectedContract.fund({ value: sendValue })
                }
                const startingFundMeBalance =
                    await fundMe.provider.getBalance(fundMe.address)
                const startingDeployerBalance =
                    await fundMe.provider.getBalance(deployer)

                // Act
                const transactionResponse = await fundMe.withdraw()
                // Let's comapre gas costs :)
                // const transactionResponse = await fundMe.withdraw()
                const transactionReceipt = await transactionResponse.wait()
                const { gasUsed, effectiveGasPrice } = transactionReceipt
                const withdrawGasCost = gasUsed.mul(effectiveGasPrice)
                console.log(`GasCost: ${withdrawGasCost}`)
                console.log(`GasUsed: ${gasUsed}`)
                console.log(`GasPrice: ${effectiveGasPrice}`)
                const endingFundMeBalance = await fundMe.provider.getBalance(
                    fundMe.address
                )
                const endingDeployerBalance =
                    await fundMe.provider.getBalance(deployer)
                // Assert
                assert.equal(
                    startingFundMeBalance
                        .add(startingDeployerBalance)
                        .toString(),
                    endingDeployerBalance.add(withdrawGasCost).toString()
                )
                // Make a getter for storage variables
                await expect(fundMe.getFunder(0)).to.be.reverted

                for (i = 1; i < 6; i++) {
                    assert.equal(
                        await fundMe.getAddressToAmountFunded(
                            accounts[i].address
                        ),
                        0
                    )
                }
            })
            it("Only allows the owner to withdraw", async function () {
                const accounts = await ethers.getSigners()
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[1]
                )
                await expect(
                    fundMeConnectedContract.withdraw()
                ).to.be.revertedWith("You're not the owner!")
            })

            it("Withdraws when there is a single funder in the contract", async () => {
                // Ensure there is a single funder
                await fundMe.fund({ value: sendValue });
                await expect(fundMe.withdraw()).to.not.be.reverted;
            })
            it("Withdraws when there are multiple funders in the contract", async () => {
                // Ensure there are multiple funders
                for (let i = 0; i < 5; i++) {
                    await fundMe.fund({ value: sendValue });
                }
            
                // Attempt to withdraw
                await expect(fundMe.withdraw()).to.not.be.reverted;
            })
        })

        // Additional Test Cases:
        describe("getters", function () {
            it("Returns the owner of the contract", async () => {
                const owner = await fundMe.getOwner();
                assert.equal(owner, deployer, "Owner should match deployer");
            })
        
            it("Returns the price feed contract address", async () => {
                const priceFeedAddress = await fundMe.getPriceFeed();
                assert.equal(
                    priceFeedAddress,
                    mockV3Aggregator.address,
                    "Price feed address should match"
                );
            })
        
            it("Returns the version of the price feed", async () => {
                const version = await fundMe.getVersion();
                const expectedVersion = 0; // Convert 0 to BigNumber: ethers.BigNumber.from(0)
                assert.isTrue(version.gte(expectedVersion), "Price feed version should match");
            })
        
            it("Returns the list of funders", async () => {
                const funders = [];
                for (let i = 0; i < 5; i++) {
                    await fundMe.fund({ value: sendValue });
                    funders.push(await fundMe.getFunder(i));
                }
        
            assert.deepEqual(funders, funders.slice(0, 5), "Funders list should match");
            })
        
            it("Returns the amount funded by an address", async () => {
                const accounts = await ethers.getSigners();
                const amounts = [];
                for (let i = 0; i < 5; i++) {
                    const fundMeConnectedContract = await fundMe.connect(accounts[i]);
                    await fundMeConnectedContract.fund({ value: sendValue });
                    const amountFunded = await fundMe.getAddressToAmountFunded(accounts[i].address);
                    amounts.push(amountFunded.toString()); // Convert to string
                }
                assert.deepEqual(amounts, Array(5).fill(sendValue.toString()), "Funded amounts should match");
            })

           
            // Additional Test Cases for Getters
            it("Returns the list of funders when there are multiple funders", async () => {
                // Ensure there are multiple funders
                for (let i = 0; i < 5; i++) {
                    await fundMe.fund({ value: sendValue });
                }
            
                // Retrieve the list of funders
                const funders = [];
                for (let i = 0; i < 5; i++) {
                    funders.push(await fundMe.getFunder(i));
                }
            
                // Check if the returned funders match the expected funders
                assert.deepEqual(funders, funders.slice(0, 5), "Funders list should match");
            })            
        });
        
        // Additional Test Cases:
        describe("updatePriceFeed", function () {
            it("Allows the owner to update the price feed", async () => {
                const newPriceFeed = await ethers.getContract("MockV3Aggregator"); // Deploy a new MockV3Aggregator
                await fundMe.updatePriceFeed(newPriceFeed.address);
                const updatedPriceFeed = await fundMe.getPriceFeed();
                assert.equal(updatedPriceFeed, newPriceFeed.address, "Price feed should be updated");
            })
        
            it("Only allows the owner to update the price feed", async () => {
                const accounts = await ethers.getSigners();
                const nonOwner = accounts[1];
                const newPriceFeed = await ethers.getContract("MockV3Aggregator"); // Deploy a new MockV3Aggregator
                const fundMeConnectedContract = await fundMe.connect(nonOwner);
                await expect(fundMeConnectedContract.updatePriceFeed(newPriceFeed.address)).to.be.revertedWith("You're not the owner!");
            })

            it("Allows the owner to update the price feed to a new valid address", async () => {
                const newPriceFeed = await ethers.getContract("MockV3Aggregator"); // Deploy a new MockV3Aggregator
                await expect(fundMe.updatePriceFeed(newPriceFeed.address)).to.not.be.reverted;
            })
            
            it("Doesn't allow the owner to update the price feed to an invalid address", async () => {
                // Attempt to update to an invalid address (address(0))
                await expect(fundMe.updatePriceFeed(ethers.constants.AddressZero)).to.be.revertedWith("Invalid address provided");
            })
        });
    }); 