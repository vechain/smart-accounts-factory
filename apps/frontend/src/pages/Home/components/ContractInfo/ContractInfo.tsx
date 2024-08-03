import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  HStack,
  Heading,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { AddressButtonGhostVariant } from "../../../../components";
import {
  useAccountCreatedEvents,
  useCreateAccount,
  useGetAccountAddress,
} from "../../../../hooks";
import { EnvConfig } from "@repo/config/contracts";
import { useWallet } from "@vechain/dapp-kit-react";
import { useCallback } from "react";

type ContractAddressAndBalanceCardProps = {
  title: string;
  address: string;
  env: EnvConfig;
};

export const ContractInfo = ({
  title,
  address,
  env,
}: ContractAddressAndBalanceCardProps) => {
  const { account } = useWallet();
  const toast = useToast();

  const { data: accountsCreatedEvents, isLoading: isLoadingCreatedAccoounts } =
    useAccountCreatedEvents(env);

  const { data: accountAddress } = useGetAccountAddress(account ?? "", env);

  const createAccountMutation = useCreateAccount({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account created",
        status: "success",
        duration: 9000,
        isClosable: true,
      });
    },
  });

  const onCreateAccount = useCallback(() => {
    createAccountMutation.sendTransaction({ owner: account ?? "", env });
  }, [createAccountMutation, account, env]);

  return (
    <Card w="full" borderRadius={"2xl"} p={2}>
      <CardHeader>
        <Heading size={"sm"}>{title}</Heading>
      </CardHeader>
      <CardBody>
        <VStack spacing={4}>
          <HStack w="full" justify={"space-between"}>
            <Text fontSize="md" wordBreak={"break-word"} fontWeight={600}>
              Address
            </Text>
            <AddressButtonGhostVariant address={address} />
          </HStack>

          <HStack w="full" justify={"space-between"}>
            <Text fontSize="md" fontWeight={600}>
              Accounts Created
            </Text>
            <Text fontSize="md" fontWeight={600}>
              {isLoadingCreatedAccoounts
                ? "Loading..."
                : accountsCreatedEvents?.created.length}
            </Text>
          </HStack>
        </VStack>
      </CardBody>
      <CardFooter>
        <Button
          w="full"
          colorScheme="blue"
          variant="outline"
          onClick={onCreateAccount}
          isDisabled={!account || !!accountAddress}
        >
          {accountAddress ? "Account already created" : "Create Account"}
        </Button>
      </CardFooter>
    </Card>
  );
};
