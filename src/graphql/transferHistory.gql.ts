import {gql} from "@apollo/client";

export const TRANSFER_HISTORY_GQL = gql`
  subscription query($accountId: String!) {
    transfers(
        where: {
            OR: [
                {from: {id_eq: $accountId}}, 
                {to: {id_eq: $accountId}}
                ]
        }, limit: 10, orderBy: timestamp_DESC) 
    {
        timestamp
        amount
        feeAmount
        fromEvmAddress
        id
        nftId
        success
        type
        toEvmAddress
        token{
          id
          name
          type
          contractData
        }
        extrinsic{
          id
          block{
            id
            height
            hash
          }
        }
        from{
          id
          evmAddress
        }
        to{
          id
          evmAddress
        }
    }
  }
`;
/*
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
*/
