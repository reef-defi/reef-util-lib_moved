import {gql} from "@apollo/client";

export const CONTRACT_DATA_GQL = gql`
  subscription contract_data_query($addresses: [String!]!) {
    verifiedContracts(where: {id_in: $addresses}, limit:300) {
    id
    contractData
  }
  }
`;
export const CONTRACT_ABI_GQL = gql`
  subscription contract_data_query($address: String!) {
    verifiedContracts(where: {id_eq: $address}, limit:1) {
    id
    compiledData
  }
  }
`;