  import { ethers } from "./ethers-5.6.esm.min.js";
  import { abi, contractAddress } from "./constants.js";

  const connectButton = document.getElementById("connectButton");
  const withdrawButton = document.getElementById("withdrawButton");
  const fundButton = document.getElementById("fundButton");
  const balanceButton = document.getElementById("balanceButton");
  const updatePriceFeedButton = document.getElementById("updatePriceFeedButton");
  connectButton.onclick = connect;
  withdrawButton.onclick = withdraw;
  fundButton.onclick = fund;
  balanceButton.onclick = getBalance;
  updatePriceFeedButton.onclick = updatePriceFeed;

  async function connect() {
    if (typeof window.ethereum !== "undefined") {
      try {
        await ethereum.request({ method: "eth_requestAccounts" });
      } catch (error) {
        console.log(error);
      }
      connectButton.innerHTML = "Connected";
      const accounts = await ethereum.request({ method: "eth_accounts" });
      console.log(accounts);
    } else {
      connectButton.innerHTML = "Please install MetaMask";
    }
  }

  async function withdraw() {
    const ethAmountW = document.getElementById("ethAmountW").value; // Get the withdrawal amount from the input field
    console.log(`Withdrawing ${ethAmountW}...`);
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      try {
        // Get the contract balance
        const contractBalance = await contract.getContractBalance();
        
        // Check if the withdrawal amount is greater than the contract balance
        if (ethers.utils.parseEther(ethAmountW).gt(contractBalance)) {
          alert("There is not enough amount to withdraw.");
        } else {
          const transactionResponse = await contract.withdraw(ethers.utils.parseEther(ethAmountW));
          await listenForTransactionMine(transactionResponse, provider);
        }
      } catch (error) {
        console.log(error);
      }
    } else {
      // Handle the case when MetaMask is not installed
      console.log("Please install MetaMask");
    }
  }



  async function fund() {
    const ethAmount = document.getElementById("ethAmount").value;
  
    // Validate the input
    if (!ethAmount || parseFloat(ethAmount) <= 0) {
      alert("Please enter a valid ETH amount.");
      return;
    }
  
    const transactionStatus = document.getElementById("transactionStatus");
  
    try {
      transactionStatus.textContent = "Transaction Status: Initiating...";
  
      if (typeof window.ethereum !== "undefined") {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(contractAddress, abi, signer);
  
        const transactionResponse = await contract.fund({
          value: ethers.utils.parseEther(ethAmount),
        });
  
        console.log("Transaction sent, waiting for confirmation...");
        transactionStatus.textContent = "Transaction Status: Confirming...";
  
        await transactionResponse.wait(); // Wait for transaction confirmation
  
        console.log("Transaction confirmed!");
        transactionStatus.textContent = "Transaction Status: Confirmed";
  
        // You can add more logging or update UI here
  
        alert("Funding successful!");
      } else {
        console.error("Please install MetaMask");
        transactionStatus.textContent = "Transaction Status: Failed";
        alert("Funding failed. Please try again.");
      }
    } catch (error) {
      console.error("Error while funding:", error);
      transactionStatus.textContent = "Transaction Status: Failed";
      alert("Funding failed. Please try again.");
    }
  }
  
  async function getBalance() {
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, abi, provider);
      try {
        const balance = await contract.getContractBalance();
        const balanceAmount = document.getElementById("balanceAmount");
        balanceAmount.textContent = ethers.utils.formatEther(balance) + " ETH";
      } catch (error) {
        console.log(error);
      }
    } else {
      balanceButton.innerHTML = "Please install MetaMask";
    }
  }



  async function updatePriceFeed() {
    const newPriceFeedAddress = document.getElementById("newPriceFeedAddress").value;
    if (!newPriceFeedAddress) {
      alert("Please enter a valid new Price Feed address.");
      return;
    }
  
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
  
      try {
        const transactionResponse = await contract.updatePriceFeed(newPriceFeedAddress);
        await listenForTransactionMine(transactionResponse, provider);
        alert("Price Feed updated successfully.");
      } catch (error) {
        console.log(error);
        alert("Error updating Price Feed: " + error.message);
      }
    } else {
      alert("Please install MetaMask");
    }
  }  

  function listenForTransactionMine(transactionResponse, provider) {
    console.log(`Mining ${transactionResponse.hash}`);
    return new Promise((resolve, reject) => {
      try {
        provider.once(transactionResponse.hash, (transactionReceipt) => {
          console.log(
            `Completed with ${transactionReceipt.confirmations} confirmations. `
          );
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function listenForEvents() {
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, abi, provider);

      // Listen for the FundContribution event
      contract.on("FundContribution", (funder, amount) => {
        console.log("FundContribution Event:", funder, amount);
        updateUIForFundContribution(funder, amount);
      });

      // Listen for the FundsWithdrawn event
      contract.on("FundsWithdrawn", (owner, amount) => {
        console.log("FundsWithdrawn Event:", owner, amount);
        updateUIForFundsWithdrawn(owner, amount);
      });

      // Listen for the PriceFeedUpdated event
      contract.on("PriceFeedUpdated", (previousPriceFeed, newPriceFeed) => {
        console.log("PriceFeedUpdated Event:", previousPriceFeed, newPriceFeed);
        updateUIForPriceFeedUpdated(previousPriceFeed, newPriceFeed);
      });
    }
  }

  // Example functions to update the UI based on events
  function updateUIForFundContribution(funder, amount) {
    const fundContributionDiv = document.getElementById("fundContribution");
    fundContributionDiv.innerHTML = `Funder: ${funder}, Amount: ${ethers.utils.formatEther(amount)} ETH`;
  }

  function updateUIForFundsWithdrawn(owner, amount) {
    const fundsWithdrawnDiv = document.getElementById("fundsWithdrawn");
    fundsWithdrawnDiv.innerHTML = `withdrawer Owner: ${owner}, Withdrawn Amount: ${ethers.utils.formatEther(amount)} ETH`;
  }

  function updateUIForPriceFeedUpdated(previousPriceFeed, newPriceFeed) {
    const priceFeedUpdatedDiv = document.getElementById("priceFeedUpdated");
    priceFeedUpdatedDiv.innerHTML = `Price Feed Updated: ${newPriceFeed}`;
  }

  if (window.ethereum) {
    listenForEvents();
  } else {
    console.error("Please install MetaMask or use a compatible Ethereum wallet.");
  }
// *************************************************************
// Function to update the balance
async function updateBalance() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    try {
      const balance = await contract.getContractBalance();
      const balanceAmount = document.getElementById("balanceAmount");
      balanceAmount.textContent = ethers.utils.formatEther(balance) + " ETH";
    } catch (error) {
      console.log(error);
    }
  }
}

// Call updateBalance every 10 seconds (adjust the interval as needed)
setInterval(updateBalance, 10000); // 10 seconds

