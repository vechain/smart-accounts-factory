import {
  Button,
  HStack,
  Text,
  useClipboard,
  Icon,
  ButtonProps,
  ImageProps,
  TextProps,
} from "@chakra-ui/react";
import React, { useEffect } from "react";
import { AddressIcon } from "./AddressIcon";

import { FaCheck, FaCopy } from "react-icons/fa6";
import { FaWallet } from "react-icons/fa";
import { humanAddress } from "../utils";

interface IAddressButton extends ButtonProps {
  address: string;
  showAddressIcon?: boolean;
  showCopyIcon?: boolean;
  showInfoIcon?: boolean;
  addressTextProps?: TextProps;
  buttonSize?: string;
  imageProps?: ImageProps;
  showFullAddress?: boolean;
  charAtStart?: number;
  charAtEnd?: number;
}
export const AddressButton: React.FC<IAddressButton> = ({
  address,
  showAddressIcon = true,
  showCopyIcon = true,
  showInfoIcon = false,
  addressTextProps = {},
  buttonSize = "md",
  imageProps = {},
  showFullAddress = false,
  charAtStart = 6,
  charAtEnd = 4,
  ...props
}) => {
  const { onCopy, hasCopied, setValue } = useClipboard(address);

  const { onClick, ...otherProps } = props;

  const onClickHandler = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    if (onClick) onClick(e);
    if (showCopyIcon) onCopy();
  };

  useEffect(() => {
    setValue(address);
  }, [address, setValue]);

  const spacing = ["xs", "sm"].includes(buttonSize) ? 2 : 4;

  return (
    <Button
      data-cy={`address-button-${address}`}
      size={buttonSize}
      colorScheme={"gray"}
      onClick={onClickHandler}
      {...(showAddressIcon && { paddingLeft: 0 })}
      paddingY={0}
      px={0}
      variant="outline"
      {...otherProps}
    >
      <HStack
        justify={"flex-start"}
        spacing={spacing}
        h="full"
        roundedLeft={"md"}
      >
        {showInfoIcon && (
          <Icon
            data-cy="address-button-info-icon"
            aria-label="View details"
            as={FaWallet}
          />
        )}
        {showAddressIcon && (
          <AddressIcon address={address} roundedLeft={"md"} {...imageProps} />
        )}
        <Text {...addressTextProps}>
          {showFullAddress
            ? address
            : humanAddress(address, charAtStart, charAtEnd)}
        </Text>
        {showCopyIcon && (
          <Icon
            data-cy="address-button-copy-icon"
            aria-label="Copy Address"
            as={hasCopied ? FaCheck : FaCopy}
          />
        )}
      </HStack>
    </Button>
  );
};

export const AddressButtonGhostVariant = (props: IAddressButton) => (
  <AddressButton
    buttonSize="sm"
    variant={"ghost"}
    imageProps={{
      rounded: "full",
      boxSize: "20px",
    }}
    addressTextProps={{
      fontSize: "md",
      fontWeight: 500,
    }}
    {...props}
  />
);
