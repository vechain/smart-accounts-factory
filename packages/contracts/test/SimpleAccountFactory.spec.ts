import { expect } from "chai";
import { getOrDeployContracts } from "./helpers/deploy";
import { ethers } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { deployProxy, upgradeProxy } from "../scripts/helpers/";
import {
  SimpleAccount,
  SimpleAccountFactory,
  SimpleAccountFactoryV1,
  SimpleAccountFactoryV2,
} from "../typechain-types";

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

    it("can successfully upgrade to v3 (storage should be preserved and SimpleAccount should be updated)", async () => {
      const [deployer, ...otherAccounts] = await ethers.getSigners();

      // Deploy V1 factory
      const simpleAccountFactory = (await deployProxy(
        "SimpleAccountFactoryV1",
        [] // initialize with no args
      )) as SimpleAccountFactoryV1;

      // Create first account (V1)
      const owner1 = otherAccounts[0];
      await simpleAccountFactory.createAccount(await owner1.getAddress());
      const account1Address = await simpleAccountFactory.getAccountAddress(
        await owner1.getAddress()
      );
      const account1 = (await ethers.getContractAt(
        "SimpleAccount",
        account1Address
      )) as SimpleAccount;
      // should be reverted because version was not available in V1
      await expect(account1.version()).to.be.reverted;

      // Upgrade factory to V2
      const simpleAccountFactoryV2 = (await upgradeProxy(
        "SimpleAccountFactoryV1",
        "SimpleAccountFactoryV2",
        await simpleAccountFactory.getAddress(),
        [] // no initialization needed for V2
      )) as SimpleAccountFactoryV2;
      expect(await simpleAccountFactoryV2.version()).to.equal("2");

      // Create second account (should still be V1)
      const owner2 = otherAccounts[1];
      await simpleAccountFactoryV2.createAccount(await owner2.getAddress());
      const account2Address = await simpleAccountFactoryV2.getAccountAddress(
        await owner2.getAddress()
      );
      const account2 = (await ethers.getContractAt(
        "SimpleAccount",
        account2Address
      )) as SimpleAccount;
      // should be reverted because version was not available in V1
      await expect(account2.version()).to.be.reverted;

      // Upgrade factory to V3
      const SmartAccountV3 = await ethers.getContractFactory("SimpleAccount");
      const smartAccountV3 = await SmartAccountV3.deploy();
      await smartAccountV3.waitForDeployment();

      const simpleAccountFactoryV3 = (await upgradeProxy(
        "SimpleAccountFactoryV2",
        "SimpleAccountFactory",
        await simpleAccountFactoryV2.getAddress(),
        [await smartAccountV3.getAddress()], // V3 initialization args
        { version: 3 } // specify V3 initialization
      )) as SimpleAccountFactory;
      expect(await simpleAccountFactoryV3.version()).to.equal("3");

      const latestAccountImplementation =
        await simpleAccountFactoryV3.accountImplementation();
      expect(latestAccountImplementation).to.equal(
        await smartAccountV3.getAddress()
      );
      expect(
        await simpleAccountFactoryV3.accountImplementationVersion()
      ).to.equal("3");

      // Create third account (should be V3)
      const owner3 = otherAccounts[2];
      await simpleAccountFactoryV3.createAccount(await owner3.getAddress());
      const account3Address = await simpleAccountFactoryV3.getAccountAddress(
        await owner3.getAddress()
      );
      const account3 = (await ethers.getContractAt(
        "SimpleAccount",
        account3Address
      )) as SimpleAccount;
      expect(await account3.version()).to.equal("3");

      // Upgrade account1 to V3 using signature
      const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
      const upgradeData = account1.interface.encodeFunctionData(
        "upgradeToAndCall",
        [latestAccountImplementation, "0x"]
      );

      const domain = {
        name: "Wallet",
        version: "1",
        chainId: Number(chainId),
        verifyingContract: account1Address,
      };

      const types = {
        ExecuteWithAuthorization: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
        ],
      };

      // Upgrade first account
      const message1 = {
        to: account1Address,
        value: ethers.parseEther("0"),
        data: upgradeData,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 60,
      };

      const signature1 = await owner1.signTypedData(domain, types, message1);
      await account1.executeWithAuthorization(
        message1.to,
        message1.value,
        message1.data,
        message1.validAfter,
        message1.validBefore,
        signature1
      );
      expect(await account1.version()).to.equal("3");

      // Upgrade second account similarly
      domain.verifyingContract = account2Address;
      const message2 = {
        to: account2Address,
        value: ethers.parseEther("0"),
        data: upgradeData,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 60,
      };

      const signature2 = await owner2.signTypedData(domain, types, message2);
      await account2.executeWithAuthorization(
        message2.to,
        message2.value,
        message2.data,
        message2.validAfter,
        message2.validBefore,
        signature2
      );
      expect(await account2.version()).to.equal("3");
    });
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
});
