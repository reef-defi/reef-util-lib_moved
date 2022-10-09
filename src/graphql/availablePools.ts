import {gql} from "@apollo/client";

export const AVAILABLE_REEF_POOLS_GQL = gql`
subscription pools_query ($hasTokenAddress: String!) {
    verified_pool (
      where: {
        _or: [
          { token_1: { _eq:$hasTokenAddress} }
          { token_2: { _eq:$hasTokenAddress} }
        ]
        _and: [
          # volume not null
          {volume: {} }
        ]
      }
      order_by: {
        #volume_aggregate: {sum: {amount_1: desc}}
        supply_aggregate: { sum: { supply: desc } } 
      }
      ){
      address
      pool_decimal
      token_1
      token_2
      name_1
      name_2
      symbol_1
      symbol_2
      decimal_1
      decimal_2
      supply(limit: 1, order_by: { timeframe: desc }) {
        total_supply
      }      
      volume_aggregate {
        aggregate{
            sum {
              amount_1
              amount_2
            }
            max {
              timeframe
            }
        }
      }
    }
  }
`;
