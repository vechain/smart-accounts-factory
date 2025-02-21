import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";

describe("SimpleAccount", () => {
  it("Can get the contract version", async () => {
    const { simpleAccountFactory, deployer } = await getOrDeployContracts(true);

    const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
      await deployer.getAddress()
    );

    await simpleAccountFactory.createAccount(await deployer.getAddress());

    const account = await ethers.getContractAt(
      "SimpleAccount",
      smartAccountAddress
    );

    const version = await account.version();

    expect(version).to.equal("3");
  });
});
