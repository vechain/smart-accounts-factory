// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./SimpleAccount.sol";

/**
 * @title SimpleAccountFactory
 * @notice Factory contract for smart accounts.
 * @dev A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 *
 * ---------- Version 2 ----------
 * - Added createAccountWithSalt and getAccountAddressWithSalt methods to allow for multiple accounts per owner.
 * - Added version() method to allow for versioning.
 * - Use new SimpleAccount implementation.
 * WARNING: when we upgraded this version we did not reinitialize the factory, so the account implementation is still v1
 *
 * ---------- Version 3 ----------
 * - Deploy v3 of SimpleAccount implementation (with reinitialization).
 * - Added accountImplementationVersion() method to know current version of the account implementation.
 * - Added event ContractReinitialized(uint256 version) to reinitialization of the factory.
 */
contract SimpleAccountFactory is UUPSUpgradeable, AccessControlUpgradeable {
    event AccountCreated(SimpleAccount account, address owner, uint256 salt);
    event ContractReinitialized(uint256 version);

    SimpleAccount public accountImplementation;

    // ---------- Initialization ---------- //

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        accountImplementation = new SimpleAccount();
    }

    function initializeV3(address newImplementation) public reinitializer(3) {
        // Instead of deploying a new implementation, use the provided one, to avoid out of gas errors
        accountImplementation = SimpleAccount(payable(newImplementation));
        emit ContractReinitialized(3);
    }

    // ---------- Authorizers ---------- //

    /**
     * @dev Authorize the upgrade of the account
     * @param newImplementation the address of the new implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ---------- Setters ---------- //

    /**
     * @dev Create an account, and return its address.
     * Returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address even after account creation
     *
     * Notice: the salt is calculated internally from the owner address,
     * so the same owner will always get the same address.
     */
    function createAccount(address owner) public returns (SimpleAccount ret) {
        uint256 salt = uint256(uint160(owner));
        address addr = getAccountAddress(owner);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }

        emit AccountCreated(ret, owner, salt);

        ret = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );
    }

    /**
     * @dev Create an account, and return its address.
     * Returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address even after account creation
     */
    function createAccountWithSalt(
        address owner,
        uint256 salt
    ) public returns (SimpleAccount ret) {
        address addr = getAccountAddress(owner);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }

        emit AccountCreated(ret, owner, salt);

        ret = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );
    }

    // ---------- Getters ---------- //

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAccountAddress(address owner) public view returns (address) {
        uint256 salt = uint256(uint160(owner));
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(SimpleAccount.initialize, (owner))
                        )
                    )
                )
            );
    }

    /**
     * @dev Calculate the counterfactual address of this account as it would be returned by createAccountWithSalt()
     */
    function getAccountAddressWithSalt(
        address owner,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(SimpleAccount.initialize, (owner))
                        )
                    )
                )
            );
    }

    /**
     * @dev Get the version of the factory
     * @return the version of the factory
     */
    function version() public pure returns (string memory) {
        return "3";
    }

    /// @notice Returns the current version of the account implementation
    function accountImplementationVersion()
        public
        view
        returns (string memory)
    {
        return SimpleAccount(payable(address(accountImplementation))).version();
    }
}
