use dep::poseidon::poseidon2::Poseidon2::hash;

mod merkle_root;

fn main(
    root_hash: pub Field,
    nullifier_hash: pub Field,
    recipient_address: pub Field,
    nullifier: Field,
    secret: Field,
    merkle_proof: [Field; 32],
    is_even: [bool; 32],
    amount: Field,
) {
    let commitment: Field = hash([nullifier, secret, amount], 3);

    let computed_nullifier_hash: Field = hash([nullifier], 1);

    assert(computed_nullifier_hash == nullifier_hash, "Invalid nullifier hash");

    let computed_merkle_root = merkle_root::compute_merkle_root(commitment, merkle_proof, is_even);

    assert(computed_merkle_root == root_hash, "Invalid merkle proof");
}
