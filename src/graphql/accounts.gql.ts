import {gql} from "@apollo/client";

export const EVM_ADDRESS_UPDATE_GQL = gql`
  subscription query($accountIds: [String!]!) {
    accounts(where: {id_in: $accountIds}, orderBy: timestamp_DESC) {
      id
      evmAddress 
   }
  }
`;
