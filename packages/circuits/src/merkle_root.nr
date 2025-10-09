use dep::poseidon::poseidon2::Poseidon2::hash;

pub(crate) fn compute_merkle_root(
    leaf: Field,
    merkle_proof: [Field; 32],
    is_even: [bool; 32],
) -> Field {
    let mut current_hash: Field = leaf;

    for i in 0..32 {
        let (left, right) = if is_even[i] {
            (current_hash, merkle_proof[i])
        } else {
            (merkle_proof[i], current_hash)
        };

        current_hash = hash([left, right], 2);
    }

    current_hash
}
