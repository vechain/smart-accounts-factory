import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";
import { createSmartAccountThroughFactory } from "./helpers/common";

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

    it("owner (and only owner) can upgrade the account", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);

      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      expect(await smartAccount.version()).to.equal("3");

      // let' deploy a new implementation
      const Contract = await ethers.getContractFactory("SimpleAccountV2");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      await smartAccount.upgradeToAndCall(
        await implementation.getAddress(),
        "0x"
      );

      expect(await smartAccount.version()).to.equal("2");

      // another user cannot upgrade the account
      const anotherUser = otherAccounts[0];

      await expect(
        smartAccount
          .connect(anotherUser)
          .upgradeToAndCall(await implementation.getAddress(), "0x")
      ).to.be.reverted;
    });

    it("owner can transfer the ownership of the account", async () => {
      const { deployer, otherAccounts } = await getOrDeployContracts(true);

      const { smartAccount } = await createSmartAccountThroughFactory(deployer);

      expect(await smartAccount.owner()).to.equal(await deployer.getAddress());

      const newOwner = otherAccounts[0];

      await smartAccount.transferOwnership(await newOwner.getAddress());

      expect(await smartAccount.owner()).to.equal(await newOwner.getAddress());
    });
  });

  describe("Execution", () => {
    it.skip("can execute a function call", async () => {});

    it.skip("can batch execute a function calls", async () => {});

    it.skip("can execute a function by providing a signature", async () => {});

    it.skip("can batch execute a function calls by providing signatures", async () => {});
  });
});
