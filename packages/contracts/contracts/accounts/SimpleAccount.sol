// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "../core/Helpers.sol";
import "./callback/TokenCallbackHandler.sol";
import "../core/UserOperationLib.sol";

/**
 * @title Minimal smart account.
 * @notice This is a minimal smart account that can have a single owner, and execute transactions on behalf of the owner,
 * through a direct call or through a signature.
 * @dev Can be upgraded by the owner.
 *
 * ---------- Version 2 ----------
 * - Added version() method to allow for versioning.
 * - Added transferOwnership method to allow for ownership transfer of the smart account.
 *
 * ---------- Version 3 ----------
 * - Added execute multiple transactions with authorization, to sign all clauses at once.
 */
contract SimpleAccount is
    Initializable,
    TokenCallbackHandler,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using UserOperationLib for PackedUserOperation;

    address public owner;

    event SimpleAccountInitialized(address indexed owner);

    // ---------- Initializer ---------- //

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the account with the owner
     * @param anOwner the owner (signer) of this account
     */
    function initialize(address anOwner) public virtual initializer {
        _initialize(anOwner);
        __EIP712_init("Wallet", "1");
        __UUPSUpgradeable_init();
    }

    /**
     * @dev Internal function to initialize the account
     * @param anOwner the owner (signer) of this account
     */
    function _initialize(address anOwner) internal virtual {
        owner = anOwner;
        emit SimpleAccountInitialized(owner);
    }

    // ---------- Modifiers and Authorization ---------- //

    /**
     * @dev Modifier to check if the caller is the owner
     */
    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    /**
     * @dev Internal function to check if the caller is the owner
     */
    function _onlyOwner() internal view {
        //directly from EOA owner, or through the account itself (which gets redirected through execute())
        require(
            msg.sender == owner || msg.sender == address(this),
            "only owner"
        );
    }

    /**
     * @dev Require the function call went through owner
     */
    function _requireFromOwner() internal view {
        require(msg.sender == owner, "account: not Owner or EntryPoint");
    }

    /**
     * @dev Authorize the upgrade of the account
     * @param newImplementation the address of the new implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal view override {
        (newImplementation);
        _onlyOwner();
    }

    // ---------- Setters ---------- //

    /**
     * @dev Execute a transaction (called directly from owner)
     * @param dest destination address to call
     * @param value the value to pass in this call
     * @param func the calldata to pass in this call
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromOwner();
        _call(dest, value, func);
    }

    /**
     * @dev execute a transaction (called directly from owner) authorized via signatures
     * @param to destination address to call
     * @param value the value to pass in this call
     * @param data the calldata to pass in this call
     * @param validAfter unix timestamp after which the signature will be accepted
     * @param validBefore unix timestamp until the signature will be accepted
     * @param signature the signed type4 signature
     */
    function executeWithAuthorization(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 validAfter,
        uint256 validBefore,
        bytes calldata signature
    ) external payable {
        _validateAuthorization(
            to,
            value,
            data,
            validAfter,
            validBefore,
            signature
        );
        _call(to, value, data);
    }

    /**
     * @dev execute multiple transactions (called directly from owner) authorized via signatures
     * @dev to reduce gas consumption for trivial case (no value), use a zero-length array to mean zero value
     * @param to an array of destination addresses
     * @param value an array of values to pass to each call. can be zero-length for no-value calls
     * @param data an array of calldata to pass to each call
     * @param validAfter an array of unix timestamps after which the signature will be accepted
     * @param validBefore an array of unix timestamps until the signature will be accepted
     * @param signatures an array of signed type4 signatures
     */
    function executeBatchWithAuthorization(
        address[] calldata to,
        uint256[] calldata value,
        bytes[] calldata data,
        uint256[] calldata validAfter,
        uint256[] calldata validBefore,
        bytes[] calldata signatures
    ) external payable {
        // Check array lengths match
        require(
            to.length == value.length &&
                value.length == data.length &&
                data.length == validAfter.length &&
                validAfter.length == validBefore.length &&
                validBefore.length == signatures.length,
            "Array lengths mismatch"
        );

        // Execute each authorized transaction
        for (uint256 i = 0; i < to.length; i++) {
            _validateAuthorization(
                to[i],
                value[i],
                data[i],
                validAfter[i],
                validBefore[i],
                signatures[i]
            );
            _call(to[i], value[i], data[i]);
        }
    }

    /**
     * @dev execute a sequence of transactions
     * @dev to reduce gas consumption for trivial case (no value), use a zero-length array to mean zero value
     * @param dest an array of destination addresses
     * @param value an array of values to pass to each call. can be zero-length for no-value calls
     * @param func an array of calldata to pass to each call
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external {
        _requireFromOwner();
        require(
            dest.length == func.length &&
                (value.length == 0 || value.length == func.length),
            "wrong array lengths"
        );
        if (value.length == 0) {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], 0, func[i]);
            }
        } else {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], value[i], func[i]);
            }
        }
    }

    /**
     * @dev Transfer ownership of the account
     * @param newOwner the new owner of the account
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _requireFromOwner();
        owner = newOwner;
    }

    /**
     * @dev Validate a single authorization
     */
    function _validateAuthorization(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 validAfter,
        uint256 validBefore,
        bytes calldata signature
    ) internal view {
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "ExecuteWithAuthorization(address to,uint256 value,bytes data,uint256 validAfter,uint256 validBefore)"
                ),
                to,
                value,
                keccak256(data),
                validAfter,
                validBefore
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        address recoveredAddress = ECDSA.recover(digest, signature);
        require(recoveredAddress == owner, "Invalid signer");
    }

    // ---------- Internal ---------- //

    /**
     * @dev Implement template method of BaseAccount
     * @param userOp the user operation to validate
     * @param userOpHash the hash of the user operation
     * @return validationData the validation data
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual returns (uint256 validationData) {
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        if (owner != ECDSA.recover(hash, userOp.signature))
            return SIG_VALIDATION_FAILED;
        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @dev Internal function to call a target
     * @param target the target address to call
     * @param value the value to pass in this call
     * @param data the calldata to pass in this call
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    // ---------- Getters ---------- //

    /**
     * @dev Get the version of the account
     * @return the version of the account
     */
    function version() public pure returns (string memory) {
        return "3";
    }

    // ---------- Fallback ---------- //

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
