use starknet::ContractAddress;

#[starknet::interface]
pub trait IBittMixx<TContractState> {
    fn deposit(
        ref self: TContractState,
        amount: u256,
        commitment: felt252,
        token_address: ContractAddress,
        is_transfer: bool,
    );
    fn withdraw(
        ref self: TContractState,
        amount: u256,
        nullifier_hash: felt252,
        recipient: ContractAddress,
        proof: Span<felt252>,
        root_hash: felt252,
        token_address: ContractAddress,
        is_transfer: bool,
    );
    //transfer funds, just sets nullifier/commitment as used and then doesnt change any balance

}

#[starknet::contract]
pub mod BittMixx {
    use core::array::ArrayTrait;
    use core::hash::HashStateTrait;
    use core::num::traits::Pow;
    use core::poseidon::PoseidonTrait;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{*, StoragePathEntry};
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use crate::honk_verifier::{
        IUltraStarknetZKHonkVerifierDispatcher, IUltraStarknetZKHonkVerifierDispatcherTrait,
    };
    use super::IBittMixx;

    //also include reentrancy from openzeppelin

    const ROOT_MAX_SIZE: u8 = 30;
    const TREE_DEPTH: u32 = 31;
    const MIN_STRK_DEPOSIT: u256 = 10000000000000000000; //10 STRK
    const MIN_BTC_DEPOSIT: u256 = 10000000000000000000; //10 BTC
    const MIN_ETH_DEPOSIT: u256 = 10000000000000000000; //10 ETH

    const FELT_STRK_CONTRACT: ContractAddress =
        0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
        .try_into()
        .unwrap();
    const FELT_BTC_CONTRACT: ContractAddress =
        0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
        .try_into()
        .unwrap(); //TODO: replace with actual BTC contract address
    const FELT_ETH_CONTRACT: ContractAddress =
        0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
        .try_into()
        .unwrap(); //TODO: replace with actual ETH contract address
    enum Token {
        STRK,
        BTC,
        ETH,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BittMixxDeposited: BittMixxDeposited,
        BittMixxWithdrawn: BittMixxWithdrawn,
        BittMixxTansferDeposit: BittMixxTransferDeposit,
        BittMixxTansferWithdrawal: BittMixxTransferWithdrawal,
    }

    #[derive(Drop, starknet::Event)]
    struct BittMixxDeposited {
        amount: u256,
        #[key]
        commitment: felt252,
        #[key]
        leaf_index: u32,
        time: u64,
        #[key]
        token_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct BittMixxWithdrawn {
        amount: u256,
        #[key]
        recipient: ContractAddress,
        #[key]
        token_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct BittMixxTransferDeposit {
        amount: u256,
        #[key]
        commitment: felt252,
        #[key]
        leaf_index: u32,
        time: u64,
        #[key]
        token_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct BittMixxTransferWithdrawal {
        amount: u256,
        #[key]
        recipient: ContractAddress,
        #[key]
        token_address: ContractAddress,
    }

    #[storage]
    struct Storage {
        next_leaf_index: u32,
        current_root_index: u32,
        verifier_address: ContractAddress,
        cached_subtrees: Map<u32, felt252>,
        roots: Map<u256, felt252>,
        commitments: Map<felt252, bool>,
        nullifier_hashes: Map<felt252, bool>,
        balances: Map<ContractAddress, u256>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, verifier_address: ContractAddress) {
        self.verifier_address.write(verifier_address);
        self.roots.entry(0).write(get_zero_leaf(TREE_DEPTH));
    }

    #[abi(embed_v0)]
    impl BittmixxImpl of IBittMixx<ContractState> {
        fn deposit(
            ref self: ContractState,
            amount: u256,
            commitment: felt252,
            token_address: ContractAddress,
            is_transfer: bool,
        ) {
            let is_commitment_used = self.commitments.entry(commitment).read();

            assert!(!is_commitment_used, "Commitment already used!");

            assert!(is_valid_token(token_address), "Unsupported token address!");

            let min_amount = get_token_min_amount(token_address);

            assert!(amount >= min_amount, "Deposit amount too low!");

            let inserted_leaf_index = insert_leaf(ref self, commitment);
            self.commitments.entry(commitment).write(true);

            if is_transfer {
                self
                    .emit(
                        BittMixxTransferDeposit {
                            amount,
                            commitment,
                            leaf_index: inserted_leaf_index,
                            time: get_block_timestamp(),
                            token_address,
                        },
                    );
            } else {
                let token_dispatcher = IERC20Dispatcher { contract_address: token_address };

                let caller_balance = token_dispatcher.balance_of(get_caller_address());
                assert!(caller_balance >= amount, "Insufficient balance");

                token_dispatcher
                    .transfer_from(get_caller_address(), get_contract_address(), amount);

                let token_balance = self.balances.entry(token_address).read();
                self.balances.entry(token_address).write(token_balance + amount);

                self
                    .emit(
                        BittMixxDeposited {
                            amount,
                            commitment,
                            leaf_index: inserted_leaf_index,
                            time: get_block_timestamp(),
                            token_address,
                        },
                    );
            }
        }

        fn withdraw(
            ref self: ContractState,
            amount: u256,
            nullifier_hash: felt252,
            recipient: ContractAddress,
            proof: Span<felt252>,
            root_hash: felt252,
            token_address: ContractAddress,
            is_transfer: bool,
        ) {
            assert!(!is_known_root(@self, root_hash), "Invalid root hash");

            // let mut public_inputs = array![];
            // public_inputs.append(root_hash);
            // public_inputs.append(nullifier_hash);
            // public_inputs.append(recipient.into());

            let verifier_dispatcher = IUltraStarknetZKHonkVerifierDispatcher {
                contract_address: self.verifier_address.read(),
            };

            //this is wrong proof(merkle proof).
            //check garaga docs on how to get proof with hints and public inputs
            assert!(
                verifier_dispatcher.verify_ultra_starknet_zk_honk_proof(proof).is_some(),
                "Invalid Proof",
            );

            assert!(!self.nullifier_hashes.entry(nullifier_hash).read(), "Nullifier Hash Used");

            self.nullifier_hashes.entry(nullifier_hash).write(true);

            if is_transfer {
                self.emit(BittMixxTransferWithdrawal { amount, recipient, token_address });
            } else {
                let strk_contract_address = token_address.try_into().unwrap();
                let strk_dispatcher = IERC20Dispatcher { contract_address: strk_contract_address };
                strk_dispatcher.transfer(recipient, amount);

                let token_balance = self.balances.entry(token_address).read();
                self.balances.entry(token_address).write(token_balance - amount);

                self.emit(BittMixxWithdrawn { amount, recipient, token_address });
            }
        }
    }

    fn insert_leaf(ref self: ContractState, commitment: felt252) -> u32 {
        let next_leaf_index = self.next_leaf_index.read();
        assert!(next_leaf_index < 2_u32.pow(TREE_DEPTH), "Leaf out of bounds");

        let mut current_leaf_index = next_leaf_index;
        let mut current_hash = commitment;
        let mut left_leaf = 0;
        let mut right_leaf = 0;

        for i in 0..TREE_DEPTH {
            if current_leaf_index % 2 == 0 {
                left_leaf = current_hash;
                right_leaf = get_zero_leaf(i);
                self.cached_subtrees.entry(i).write(current_hash);
            } else {
                left_leaf = self.cached_subtrees.entry(i).read();
                right_leaf = current_hash;
            }

            let mut state = PoseidonTrait::new();
            state = state.update(left_leaf);
            state = state.update(right_leaf);
            current_hash = state.finalize();

            current_leaf_index = current_leaf_index / 2;
        }

        let current_root_index = (self.current_root_index.read() + 1) % ROOT_MAX_SIZE.into();
        self.current_root_index.write(current_root_index);
        self.roots.entry(current_root_index.into()).write(current_hash);
        self.next_leaf_index.write(self.next_leaf_index.read() + 1);

        next_leaf_index
    }

    fn is_known_root(self: @ContractState, root: felt252) -> bool {
        if root == 0 {
            return false;
        }

        let current_index = self.current_root_index.read();
        let mut i = current_index;

        while i == current_index {
            if root == self.roots.entry(i.into()).read() {
                return true;
            }

            if i == 0 {
                i = ROOT_MAX_SIZE.into();
            }

            i -= 1;
        }

        false
    }


    fn get_token_min_amount(token_address: ContractAddress) -> u256 {
        if token_address == FELT_STRK_CONTRACT {
            MIN_STRK_DEPOSIT
        } else if token_address == FELT_ETH_CONTRACT {
            MIN_ETH_DEPOSIT
        } else if token_address == FELT_BTC_CONTRACT {
            MIN_BTC_DEPOSIT
        } else {
            MIN_BTC_DEPOSIT
        }
    }

    fn is_valid_token(token_address: ContractAddress) -> bool {
        token_address == FELT_STRK_CONTRACT
            || token_address == FELT_ETH_CONTRACT
            || token_address == FELT_BTC_CONTRACT
    }

    fn get_zero_leaf(_depth: u32) -> felt252 {
        match _depth {
            0 => 0x7554b99b848ff915c72eac90896aed27aaa91c261555e9e44be24657ee608a9,
            1 => 0x2ea7dc6626e3fad5b66fb926858b984127fa9dda7648312dd7064d062a24d22,
            2 => 0xa959be1b2b3ee8c311bed4cd2f229de7a63f0a2dc4aa4210f19323bb21406,
            3 => 0x7822ace87349b2adef2c6ca2596a7db832b400e67f1bf86188420681aef6ef6,
            4 => 0x3a0bb4aa8de0d028770db036be9457a3f6f26756fea057d5ef8fee17cbdc055,
            5 => 0x7ea750e861f38562c7f72e207f2231df9b7727d4b4f5192567b8a6e2b38f959,
            6 => 0x180fc05d21fa9295e6dae7fcfdef06a06884917f6e838a7241bd59b5f1ab5b4,
            7 => 0x4998e0fdb04e781f8d1026d15c20e87b0325aa3ecc4f366818508e8e9e6a5d8,
            8 => 0x19c5abdbe636b2596b44183913bde2c1c57a78495e805e6d983437f6c8aac72,
            9 => 0x5b69adc3e341b1f4e36e62753b77ddcbab86c2cb719533fd5f295c7a6fda770,
            10 => 0x3dd38373769ba36e495d2d0b85a5cde962dc33c7d9fcbf436df0cca73664b38,
            11 => 0x45fcaf8f71bc0c672acce73015841d8bb6b9f93c33154fe0dc6e7aed1562a17,
            12 => 0x784c51b780562ae9b467416107809bade1266fed37d6e1d958e586316d7ef87,
            13 => 0x6f232f90818dd4d4cc72c6cbe3d85970e213acf86ea6af8ab413b7059190d47,
            14 => 0x66440b67d8db85cacaec0e22c260f8e11aea2fade4783c7b1f0a652c86ef648,
            15 => 0x4e1a56b8c17ffc4c866c561bea7e826237e5668cf1bc1b52023c0f14f481c67,
            16 => 0x13d5fdff4c5576d404e59c0c532e25f099ec12a4c1976aa320a0aa1b598333,
            17 => 0x4ff2a3e592792df1cafbd211a6ba7e6b532f95181a5c0e2a198d7983f12248d,
            18 => 0x6e0e2711cd83623c42df0baa166d83c9d548093d76b4a5354393a63d2a2fadd,
            19 => 0x58ac1a7d24ddfcdd50ed28936ba67287f6c059d9e6a317ac65b9bd9ea6b5452,
            20 => 0x1a60143d89152defa494251d32fab178896d1c16c1e0ed3211383db28630474,
            21 => 0x1740c233ac95868df3fbdf344abf8cd7a578c30e66b39d0730424d4dd405ccf,
            22 => 0x5153f228e51beae5826e09039193dd5964cde17aa40e3455f1f656896da7273,
            23 => 0x523d18a65fa29180502ad030427c90799fff2d76d5d491906709efca91a6f5b,
            24 => 0x225a531d8095144e0ae99550462c96b5799846566fecfe5a968e317d077540d,
            25 => 0x6acf1972d3551f4e117446365aa9a0f8ba4386aecbf5ae4d6e6656bcde99dca,
            26 => 0x381be93bc040ec0af5555f61f75f0f740e1a0bd1ac38d6a150bd298f4020737,
            27 => 0xd8384c1015a4aa24c31faf29b0ce60a625e9f3c55a5ee61d123cb5fea2f9b5,
            28 => 0x1b1baca8e5accee543cee56eb979807b0e25c2b6b44bdfa302fe939ef7985ad,
            29 => 0x5d2db6c0f536b68d97c232027811785dbc12b03c65d65abb6e7d674188254ca,
            30 => 0x2947216af433dca22823668b485406b4a2480c1d009557703771ee517ca3f92,
            31 => 0x5dc143b94d93bfa68b3e23e92eb85f3128a65471753b51acf66e5387f2882d2,
            _ => panic!("Invalid tree depth!"),
        }
    }
}

