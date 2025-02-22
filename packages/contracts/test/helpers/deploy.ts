import { Signer } from "ethers";
import { ethers } from "hardhat";
import { SimpleAccountFactory } from "../../typechain-types";
import { deployAndUpgrade } from "../../scripts/helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

interface DeployedContracts {
  simpleAccountFactory: SimpleAccountFactory;
  deployer: Signer;
  otherAccounts: HardhatEthersSigner[];
}

let cachedDeployment: DeployedContracts | undefined = undefined;

export async function getOrDeployContracts(
  forceDeploy = false
): Promise<DeployedContracts> {
  // Return cached deployment if available and force deploy is not requested
  if (!forceDeploy && cachedDeployment !== undefined) {
    return cachedDeployment;
  }

  const [deployer, ...otherAccounts] = await ethers.getSigners();

  // Deploy the V3 version of SimpleAccount separately because we will need it
  // when reinitializing the SimpleAccountFactory v3
  const SimpleAccount = await ethers.getContractFactory("SimpleAccount");
  const simpleAccountImpl = await SimpleAccount.deploy();
  await simpleAccountImpl.waitForDeployment();

  const smartAccountFactory = (await deployAndUpgrade(
    [
      "SimpleAccountFactoryV1",
      "SimpleAccountFactoryV2",
      "SimpleAccountFactory",
    ],
    [[], [], [await simpleAccountImpl.getAddress()]],
    {
      versions: [undefined, 2, 3],
      logOutput: false,
    }
  )) as SimpleAccountFactory;

  // Cache the deployment
  cachedDeployment = {
    simpleAccountFactory: smartAccountFactory,
    deployer,
    otherAccounts,
  };

  return cachedDeployment;
}
