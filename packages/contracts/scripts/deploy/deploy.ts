import { ContractsConfig } from "@repo/config/contracts";
import { Interface } from "ethers";
import { ethers, network } from "hardhat";

export async function deployAll(config: ContractsConfig): Promise<{
  simpleAccountFactory: string;
  // feeDelegation: string;
}> {
  const [deployer, owner] = await ethers.getSigners();

  console.log(
    `Deploying on ${network.name}  with account ${deployer.address}...`
  );

  // Deploy the v1 implementation contract
  const Contract = await ethers.getContractFactory("SimpleAccountFactory");
  const implementation = await Contract.deploy();
  await implementation.waitForDeployment();
  let tx = await implementation.deploymentTransaction();
  let receipt = await ethers.provider.getTransactionReceipt(tx!.hash);
  const implementationAddress = receipt?.contractAddress;
  console.log(
    `SimpleAccountFactory implementation deployed to ${implementationAddress}`
  );
  if (!implementationAddress)
    throw new Error("SimpleAccountFactory deployment failed");

  // Deploy the proxy contract, link it to the implementation and call the initializer
  const proxyFactory = await ethers.getContractFactory("AAProxy");
  const proxy = await proxyFactory.deploy(
    implementationAddress,
    getInitializerData(Contract.interface, [])
  );
  await proxy.waitForDeployment();
  tx = await proxy.deploymentTransaction();
  receipt = await ethers.provider.getTransactionReceipt(tx!.hash);
  const proxyAddress = receipt?.contractAddress;
  console.log(`SimpleAccountFactory proxy: ${proxyAddress}`);

  if (!proxyAddress)
    throw new Error("SimpleAccountFactory proxy deployment failed");

  return {
    simpleAccountFactory: proxyAddress,
  };
}

export function getInitializerData(contractInterface: Interface, args: any[]) {
  const initializer = "initialize";
  const fragment = contractInterface.getFunction(initializer);
  if (!fragment) {
    throw new Error(`Contract initializer not found`);
  }
  return contractInterface.encodeFunctionData(fragment, args);
}
