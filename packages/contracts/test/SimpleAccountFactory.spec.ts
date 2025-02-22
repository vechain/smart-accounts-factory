import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

describe("SimpleAccountFactory", () => {
  describe("Deployment", () => {
    it("Can get the contract version", async () => {
      const { simpleAccountFactory } = await getOrDeployContracts(true);
      const version = await simpleAccountFactory.version();
      expect(version).to.equal("3");
    });
  });

  describe("Contract upgradeablity", () => {
    it("Contract can be upgraded correctly by admin", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("SimpleAccountFactory");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      const currentImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      const DEFAULT_ADMIN_ROLE =
        await simpleAccountFactory.DEFAULT_ADMIN_ROLE();

      expect(
        await simpleAccountFactory.hasRole(
          DEFAULT_ADMIN_ROLE,
          await deployer.getAddress()
        )
      ).to.eql(true);

      await expect(
        simpleAccountFactory
          .connect(deployer)
          .upgradeToAndCall(await implementation.getAddress(), "0x")
      ).to.not.be.reverted;

      const newImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      expect(newImplAddress.toUpperCase()).to.not.eql(
        currentImplAddress.toUpperCase()
      );
      expect(newImplAddress.toUpperCase()).to.eql(
        (await implementation.getAddress()).toUpperCase()
      );
    });

    it("Non admin cannot upgrade the contract", async () => {
      const { simpleAccountFactory, deployer, otherAccounts } =
        await getOrDeployContracts(true);

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("SimpleAccountFactory");
      const implementation = await Contract.deploy();
      await implementation.waitForDeployment();

      const currentImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      const DEFAULT_ADMIN_ROLE =
        await simpleAccountFactory.DEFAULT_ADMIN_ROLE();

      expect(
        await simpleAccountFactory.hasRole(
          DEFAULT_ADMIN_ROLE,
          await otherAccounts[0].getAddress()
        )
      ).to.eql(false);

      await expect(
        simpleAccountFactory
          .connect(otherAccounts[0])
          .upgradeToAndCall(await implementation.getAddress(), "0x")
      ).to.be.reverted;

      const newImplAddress = await getImplementationAddress(
        ethers.provider,
        await simpleAccountFactory.getAddress()
      );

      expect(newImplAddress.toUpperCase()).to.eql(
        currentImplAddress.toUpperCase()
      );
    });

    it("cannot initialize or reinitialize the contract", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

      // contract is already initialized in getOrDeployContracts
      await expect(simpleAccountFactory.initialize()).to.be.reverted;

      await expect(
        simpleAccountFactory
          .connect(deployer)
          .initializeV3(await deployer.getAddress())
      ).to.be.reverted;
    });

    it.skip("can successfully upgrade to v3 (storage should be preserved and SimpleAccount should be updated)", async () => {});
  });

  describe("SimpleAccount creation", () => {
    it("Can create a SimpleAccount", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);

      const smartAccountOwner = otherAccounts[0];

      const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
        await smartAccountOwner.getAddress()
      );

      const smartAccountContract = await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      );

      // Check that there's no code at the address before deployment
      const codeBefore = await ethers.provider.getCode(smartAccountAddress);
      expect(codeBefore).to.equal("0x");

      await simpleAccountFactory.createAccount(
        await smartAccountOwner.getAddress()
      );

      // Check that there is code at the address after deployment
      const codeAfter = await ethers.provider.getCode(smartAccountAddress);
      expect(codeAfter).to.not.equal("0x");
      expect(codeAfter.length).to.be.greaterThan(2);

      const owner = await smartAccountContract.owner();

      expect(owner).to.equal(await smartAccountOwner.getAddress());
    });

    it("Can get implementation address", async () => {
      const { simpleAccountFactory } = await getOrDeployContracts(true);

      const implementationAddress =
        await simpleAccountFactory.accountImplementation();
      expect(implementationAddress).to.not.equal("0x");
    });

    it("Can deposit money even if account is not created yet", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);

      const smartAccountOwner = otherAccounts[0];

      const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
        await smartAccountOwner.getAddress()
      );

      // Ensure contract is not deployed yet
      const codeBefore = await ethers.provider.getCode(smartAccountAddress);
      expect(codeBefore).to.equal("0x");

      const balanceBefore =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceBefore).to.equal(0);

      // Send ETH directly instead of calling deposit
      await otherAccounts[0].sendTransaction({
        to: smartAccountAddress,
        value: ethers.parseEther("1"),
      });

      const balanceAfter =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceAfter).to.equal(ethers.parseEther("1"));

      // let's deploy the account now
      await simpleAccountFactory.createAccount(
        await smartAccountOwner.getAddress()
      );

      const balanceAfter2 =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceAfter2).to.equal(ethers.parseEther("1"));

      // check that owner can move those funds by calling execute
      const smartAccountContract = await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      );
      const tx = await smartAccountContract
        .connect(smartAccountOwner)
        .execute(
          await smartAccountOwner.getAddress(),
          ethers.parseEther("1"),
          "0x"
        );
      await tx.wait();

      const balanceAfter3 =
        await ethers.provider.getBalance(smartAccountAddress);
      expect(balanceAfter3).to.equal(ethers.parseEther("0"));
    });

    it("Can create an account with salt", async () => {
      const { simpleAccountFactory, otherAccounts } =
        await getOrDeployContracts(true);

      const smartAccountOwner = otherAccounts[0];

      const smartAccountAddress =
        await simpleAccountFactory.getAccountAddressWithSalt(
          await smartAccountOwner.getAddress(),
          2
        );

      const codeBefore = await ethers.provider.getCode(smartAccountAddress);
      expect(codeBefore).to.equal("0x");

      await simpleAccountFactory.createAccountWithSalt(
        await smartAccountOwner.getAddress(),
        2
      );

      const codeAfter = await ethers.provider.getCode(smartAccountAddress);
      expect(codeAfter).to.not.equal("0x");
      expect(codeAfter.length).to.be.greaterThan(2);

      const smartAccountContract = await ethers.getContractAt(
        "SimpleAccount",
        smartAccountAddress
      );
      const owner = await smartAccountContract.owner();
      expect(owner).to.equal(await smartAccountOwner.getAddress());
    });
  });

  describe("SimpleAccount management", () => {
    it("Can get the account address", async () => {
      const { simpleAccountFactory, deployer } =
        await getOrDeployContracts(true);

      const smartAccountAddress = await simpleAccountFactory.getAccountAddress(
        await deployer.getAddress()
      );

      expect(smartAccountAddress).to.not.equal("0x");
    });

    it("Can get the current simpleaccount implementation address and version", async () => {
      const { simpleAccountFactory } = await getOrDeployContracts(true);

      const implementationAddress =
        await simpleAccountFactory.accountImplementation();
      expect(implementationAddress).to.not.equal("0x");

      const version = await simpleAccountFactory.accountImplementationVersion();
      expect(version).to.not.equal("0x");
    });
  });

  describe("SimpleAccount upgrade", () => {
    it.skip("Can upgrade the account through the factory", async () => {});
  });
});
