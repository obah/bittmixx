//A
//users can deposit
// -- on deposit, amount, commitment are provided
//users can withdraw
// -- on withdraw, amount_to_withdraw, amount_deposited, nullifier_hash, reciever, proof, roothash
// are provided
//users can transfer {this should happen offchain, work on later}
// -- on transfer, amount_deposited, amount_to_transfer, nullifier_hash, reciever are provided
//users can claim(withdraw a transfer) {work on later}
// -- on claim, amount, nullifier hash are provided

use starknet::ContractAddress;

#[starknet::interface]
pub trait IBittMixx<TContractState> {
    fn deposit(ref self: TContractState, amount: u256, commitment: felt252);
    fn withdraw(ref self: TContractState, amount: u256, recipient: ContractAddress);
    // fn withdraw(
//     ref self: TContractState,
//     amount_to_withdraw: u256,
//     amount_deposited: u256,
//     nullifier_hash: felt252,
//     recipient: ContractAddress,
//     proof: Span<felt252>,
//     roothash: felt252,
// );
}

#[starknet::contract]
pub mod BittMixx {
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::*;
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::IBittMixx;
    //account for the 3 tokens - btc, eth and strk
    //also include reentrancy from openzeppelin

    pub const FELT_STRK_CONTRACT: felt252 =
        0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d;
    const MIN_STRK_DEPOSIT: u256 = 10000000000000000000; //10 STRK

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        StrkDeposited: StrkDeposited,
        StrkWithdrawn: StrkWithdrawn,
    }

    #[derive(Drop, starknet::Event)]
    struct StrkDeposited {
        amount: u256,
        #[key]
        commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct StrkWithdrawn {
        amount: u256,
        amount_left: u256,
        #[key]
        recipient: ContractAddress,
    }   

    #[storage]
    struct Storage { //verifier contract here later
        // strk_balance: u256,
        commitments: Map<felt252, bool>,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl BittmixxImpl of IBittMixx<ContractState> {
        fn deposit(ref self: ContractState, amount: u256, commitment: felt252) {
            let is_commitment_used = self.commitments.entry(commitment).read();
            assert!(!is_commitment_used, "Commitment already used!");

            assert!(amount >= MIN_STRK_DEPOSIT, "Deposit amount too low!");

            let strk_contract_address = FELT_STRK_CONTRACT.try_into().unwrap();
            let strk_dispatcher = IERC20Dispatcher { contract_address: strk_contract_address };

            let caller_balance = strk_dispatcher.balance_of(get_caller_address());
            assert!(caller_balance >= amount, "Insufficient balance");

            strk_dispatcher.transfer_from(get_caller_address(), get_contract_address(), amount);

            self.emit(StrkDeposited { amount, commitment });
        }

        fn withdraw(ref self: ContractState, amount: u256, recipient: ContractAddress) {
            let strk_contract_address = FELT_STRK_CONTRACT.try_into().unwrap();
            let strk_dispatcher = IERC20Dispatcher { contract_address: strk_contract_address };

            strk_dispatcher.transfer(recipient, amount);

            self.emit(StrkWithdrawn { amount, amount_left: amount, recipient });
        }
    }
}

