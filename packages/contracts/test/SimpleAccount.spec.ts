import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";

describe("SimpleAccount", () => {
  describe("Management", () => {
    it("Can get the contract version", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

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

    it("owner (and only owner) can upgrade the account", async () => {});

    it("owner can transfer the ownership of the account", async () => {});
  });

  describe("Execution", () => {
    // can execute a function call
    // can batch execute a function calls
    // can execute a function by providing a signature
    // can batch execute a function calls by providing signatures
  });
});
