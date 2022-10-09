import {gql} from "@apollo/client";

export const SIGNER_NFTS_GQL = gql`
  subscription query($accountId: String) {
    token_holder(
    order_by: { balance: desc }
    where: {
      _and: [{ nft_id: { _is_null: false } }, { signer: { _eq: $accountId } }, {balance: {_gt: 0}}]
      type: { _eq: "Account" }
    }
  ) {
    token_address
    balance
    nft_id
    info
    contract {
      verified_contract {
        type
        contract_data
      }
    }
  }
 }`;

