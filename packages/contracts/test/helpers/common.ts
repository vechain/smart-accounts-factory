import { ethers } from "hardhat";
import { getOrDeployContracts } from "./deploy";
import { Signer } from "ethers";

export const createSmartAccountThroughFactory = async (owner: Signer) => {
  const { simpleAccountFactory } = await getOrDeployContracts(false);

  const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
    await owner.getAddress()
  );

  await simpleAccountFactory.createAccount(await owner.getAddress());

  const smartAccount = await ethers.getContractAt(
    "SimpleAccount",
    smartAccountAddress
  );

  return { smartAccount, smartAccountAddress };
};
