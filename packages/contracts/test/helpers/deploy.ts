import { Interface, Signer } from "ethers";
import { ethers } from "hardhat";
import { SimpleAccountFactory } from "../../typechain-types";

interface DeployedContracts {
  simpleAccountFactory: SimpleAccountFactory;
  deployer: Signer;
}

let cachedDeployment: DeployedContracts | undefined = undefined;

export async function getOrDeployContracts(
  forceDeploy = false
): Promise<DeployedContracts> {
  // Return cached deployment if available and force deploy is not requested
  if (!forceDeploy && cachedDeployment !== undefined) {
    return cachedDeployment;
  }

  const [deployer] = await ethers.getSigners();

  // Deploy the implementation contract
  const Contract = await ethers.getContractFactory("SimpleAccountFactory");
  const implementation = await Contract.deploy();
  await implementation.waitForDeployment();
  let tx = await implementation.deploymentTransaction();
  let receipt = await ethers.provider.getTransactionReceipt(tx!.hash);
  const implementationAddress = receipt?.contractAddress;

  if (!implementationAddress) {
    throw new Error("SimpleAccountFactory deployment failed");
  }

  // Deploy the proxy contract
  const proxyFactory = await ethers.getContractFactory("AAProxy");
  const proxy = await proxyFactory.deploy(
    implementationAddress,
    getInitializerData(Contract.interface, [])
  );
  await proxy.waitForDeployment();
  tx = await proxy.deploymentTransaction();
  receipt = await ethers.provider.getTransactionReceipt(tx!.hash);
  const proxyAddress = receipt?.contractAddress;

  if (!proxyAddress) {
    throw new Error("SimpleAccountFactory proxy deployment failed");
  }

  const simpleAccountFactory = await ethers.getContractAt(
    "SimpleAccountFactory",
    proxyAddress
  );

  // Cache the deployment
  cachedDeployment = {
    simpleAccountFactory,
    deployer,
  };

  return cachedDeployment;
}

function getInitializerData(contractInterface: Interface, args: any[]) {
  const initializer = "initialize";
  const fragment = contractInterface.getFunction(initializer);
  if (!fragment) {
    throw new Error(`Contract initializer not found`);
  }
  return contractInterface.encodeFunctionData(fragment, args);
}
