import { ethers } from "./ethers.js";
let provider = new ethers.providers.Web3Provider(web3.currentProvider);

document.getElementById("w-node-f7bcde35c9d1-d7d16cbb").addEventListener ("click", getBlockNumber, false);

function getBlockNumber() {
  provider.getBlockNumber().then((f) => {
    alert(f);
  })
}
