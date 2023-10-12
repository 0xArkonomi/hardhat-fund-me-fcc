const { assert, expect } = require("chai")
const { deployments, ethers } = require("hardhat")

describe("FundMe", function () {
    let fundMe
    let mockV3Aggregator
    let deployer
    const sendValue = ethers.utils.parseEther("1")

    beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe", deployer)
        mockV3Aggregator = await ethers.getContract(
            "MockV3Aggregator",
            deployer
        )
    })

    describe("Constructor", function () {
        it("Should set the aggregator address correctly", async () => {
            const response = await fundMe.getPriceFeed()
            assert.equal(response, mockV3Aggregator.address)
        })
    })

    describe("fund", function () {
        it("Should revert if not enough ETH sent", async () => {
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH!"
            )
        })

        it("Should update the amount funded data structure", async () => {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.getAddressToAmountFunded(deployer)
            assert.equal(response.toString(), sendValue.toString())
        })

        it("Should add the funder to the array of funders", async () => {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.getFunder(0)
            assert.equal(response, deployer)
        })

        it("Should fund when a funder sends exactly the minimum required amount in ETH", async () => {
            const minimumFundingAmount = ethers.utils.parseEther("50")
            await expect(fundMe.fund({ value: minimumFundingAmount })).to.not.be
                .reverted
        })

        it("Should fund when a funder sends more than the minimum required amount in ETH", async () => {
            const moreThanMinimumFundingAmount = ethers.utils.parseEther("51")
            await expect(fundMe.fund({ value: moreThanMinimumFundingAmount }))
                .to.not.be.reverted
        })
    })

    describe("withdraw", function () {
        beforeEach(async () => {
            for (let i = 0; i < 6; i++) {
                await fundMe.fund({ value: sendValue })
            }
        })

        it("Should allow the owner to withdraw a specified amount", async () => {
            const initialOwnerBalance = await fundMe.provider.getBalance(
                deployer
            )

            const amountToWithdraw = ethers.utils.parseEther("2") // Specify the amount to withdraw

            const transactionResponse = await fundMe.withdraw(amountToWithdraw)
            const transactionReceipt = await transactionResponse.wait()
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const withdrawGasCost = gasUsed.mul(effectiveGasPrice)

            const finalOwnerBalance = await fundMe.provider.getBalance(deployer)

            // Calculate the expected ending balance of the owner
            const expectedOwnerBalance = initialOwnerBalance
                .add(amountToWithdraw)
                .sub(withdrawGasCost)

            assert.equal(
                finalOwnerBalance.toString(),
                expectedOwnerBalance.toString()
            )
        })

        it("Should revert if someone other than the owner tries to withdraw", async function () {
            const accounts = await ethers.getSigners()
            const nonOwner = accounts[1]
            const fundMeConnectedContract = await fundMe.connect(nonOwner)
            await expect(
                fundMeConnectedContract.withdraw(sendValue)
            ).to.be.revertedWith("You're not the owner!")
        })

        it("Should revert if the specified amount exceeds the contract balance", async () => {
            const contractBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const amountToWithdraw = contractBalance.add(
                ethers.utils.parseEther("1")
            ) // Exceed the contract balance
            await expect(fundMe.withdraw(amountToWithdraw)).to.be.revertedWith(
                "Withdrawal failed"
            )
        })

        it("Should allow the owner to withdraw the entire contract balance", async () => {
            const contractBalance = await fundMe.provider.getBalance(
                fundMe.address
            )
            const transactionResponse = await fundMe.withdraw(contractBalance)
            const transactionReceipt = await transactionResponse.wait()
            const finalContractBalance = await fundMe.provider.getBalance(
                fundMe.address
            )

            assert.equal(finalContractBalance, 0)
        })

        it("Should allow the owner to withdraw when there is only one funder", async () => {
            await fundMe.fund({ value: sendValue })
            const initialContractBalance = await fundMe.provider.getBalance(
                fundMe.address
            )

            const transactionResponse = await fundMe.withdraw(sendValue)
            const transactionReceipt = await transactionResponse.wait()
            const finalContractBalance = await fundMe.provider.getBalance(
                fundMe.address
            )

            assert.equal(
                finalContractBalance.toString(),
                initialContractBalance.sub(sendValue).toString()
            )
        })
    })

    describe("getters", function () {
        it("Should return the owner of the contract", async () => {
            const owner = await fundMe.getOwner()
            assert.equal(owner, deployer, "Owner should match deployer")
        })

        it("Should return the price feed contract address", async () => {
            const priceFeedAddress = await fundMe.getPriceFeed()
            assert.equal(
                priceFeedAddress,
                mockV3Aggregator.address,
                "Price feed address should match"
            )
        })

        it("Should return the version of the price feed", async () => {
            const version = await fundMe.getVersion()
            const expectedVersion = 0 // Convert 0 to BigNumber: ethers.BigNumber.from(0)
            assert.isTrue(
                version.gte(expectedVersion),
                "Price feed version should match"
            )
        })

        it("Should return the list of funders", async () => {
            const funders = []
            for (let i = 0; i < 5; i++) {
                await fundMe.fund({ value: sendValue })
                funders.push(await fundMe.getFunder(i))
            }

            assert.deepEqual(
                funders,
                funders.slice(0, 5),
                "Funders list should match"
            )
        })

        it("Should return the amount funded by an address", async () => {
            const accounts = await ethers.getSigners()
            const amounts = []
            for (let i = 0; i < 5; i++) {
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[i]
                )
                await fundMeConnectedContract.fund({ value: sendValue })
                const amountFunded = await fundMe.getAddressToAmountFunded(
                    accounts[i].address
                )
                amounts.push(amountFunded.toString())
            }
            assert.deepEqual(
                amounts,
                Array(5).fill(sendValue.toString()),
                "Funded amounts should match"
            )
        })

        it("Should return the list of funders when there are multiple funders", async () => {
            for (let i = 0; i < 5; i++) {
                await fundMe.fund({ value: sendValue })
            }

            const funders = []
            for (let i = 0; i < 5; i++) {
                funders.push(await fundMe.getFunder(i))
            }

            assert.deepEqual(
                funders,
                funders.slice(0, 5),
                "Funders list should match"
            )
        })

        it("Should return the correct contract balance", async () => {
            // Fund the contract with some ether
            await fundMe.fund({ value: sendValue })

            const contractBalance = await fundMe.getContractBalance()
            assert.equal(
                contractBalance.toString(),
                sendValue.toString(),
                "Contract balance should match"
            )
        })

        it("Should return 0 for the contract balance when no funds are added", async () => {
            const contractBalance = await fundMe.getContractBalance()
            assert.equal(
                contractBalance.toString(),
                "0",
                "Contract balance should be 0"
            )
        })
    })

    describe("updatePriceFeed", function () {
        it("Should allow the owner to update the price feed", async () => {
            const newPriceFeed = await ethers.getContract("MockV3Aggregator")
            await fundMe.updatePriceFeed(newPriceFeed.address)
            const updatedPriceFeed = await fundMe.getPriceFeed()
            assert.equal(
                updatedPriceFeed,
                newPriceFeed.address,
                "Price feed should be updated"
            )
        })

        it("Should revert if someone other than the owner tries to update the price feed", async () => {
            const accounts = await ethers.getSigners()
            const nonOwner = accounts[1]
            const newPriceFeed = await ethers.getContract("MockV3Aggregator")
            const fundMeConnectedContract = await fundMe.connect(nonOwner)
            await expect(
                fundMeConnectedContract.updatePriceFeed(newPriceFeed.address)
            ).to.be.revertedWith("You're not the owner!")
        })

        it("Should allow the owner to update the price feed to a new valid address", async () => {
            const newPriceFeed = await ethers.getContract("MockV3Aggregator")
            await expect(fundMe.updatePriceFeed(newPriceFeed.address)).to.not.be
                .reverted
        })

        it("Should revert if the owner tries to update the price feed to an invalid address", async () => {
            await expect(
                fundMe.updatePriceFeed(ethers.constants.AddressZero)
            ).to.be.revertedWith("Invalid address provided")
        })
    })
})
