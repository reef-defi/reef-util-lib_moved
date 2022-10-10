import {gql} from "@apollo/client";

export const SIGNER_TOKENS_GQL = gql`
  subscription tokens_query($accountId: String!) {
    token_holder(
      order_by: { balance: desc }
      where: {
        _and: [
          { nft_id: { _is_null: true } }
          { token_address: { _is_null: false } }
          { signer: { _eq: $accountId } }
        ]
      }
    ) {
      token_address
      balance
    }
  }
`;


export const CONTRACT_DATA_GQL = gql`
  query contract_data_query($addresses: [String!]!) {
    verified_contract(where: { address: { _in: $addresses } }) {
      address
      contract_data
    }
  }
`;
