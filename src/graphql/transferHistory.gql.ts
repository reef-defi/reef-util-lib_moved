import {gql} from "@apollo/client";

export const TRANSFER_HISTORY_GQL = gql`
  subscription query($accountId: String!) {
    transfer(
      where: {
        _or: [
          { to_address: { _eq: $accountId } }
          { from_address: { _eq: $accountId } }
        ]
        _and: { success: { _eq: true } }
      }
      limit: 10
      order_by: { timestamp: desc }
    ) {
      amount
      success
      token_address
      from_address
      to_address
      timestamp
      nft_id
      token {
        address
        verified_contract {
          name
          type
          contract_data
        }
      }
      extrinsic{
        block_id
        index
        hash
      }
    }
  }
`;
