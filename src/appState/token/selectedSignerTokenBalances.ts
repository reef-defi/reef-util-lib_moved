// TODO replace with our own from lib and remove
import {gql} from "@apollo/client";
import {reefTokenWithAmount, Token} from "../../token/token";
import {BigNumber, FixedNumber, utils} from "ethers";
import {catchError, combineLatest, map, mergeScan, Observable, of, shareReplay, startWith, switchMap} from "rxjs";
import {apolloClientInstance$, zenToRx} from "../../graphql";
import {selectedSigner$} from "../account/selectedSigner";
import {currentProvider$} from "../providerState";
import {getReefCoinBalance} from "../../account/accounts";
import {getIconUrl} from "../../utils";
import {sortReefTokenFirst, toPlainString} from "../util/util";
import {Provider} from "@reef-defi/evm-provider";

const SIGNER_TOKENS_GQL = gql`
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


const CONTRACT_DATA_GQL = gql`
  query contract_data_query($addresses: [String!]!) {
    verified_contract(where: { address: { _in: $addresses } }) {
      address
      contract_data
    }
  }
`;

// eslint-disable-next-line camelcase
const fetchTokensData = (
    // apollo: ApolloClient<any>,
    apollo: any,
    missingCacheContractDataAddresses: string[],
    state: { tokens: Token[]; contractData: Token[] },
): Promise<Token[]> => apollo
    .query({
        query: CONTRACT_DATA_GQL,
        variables: {addresses: missingCacheContractDataAddresses},
    })
    // eslint-disable-next-line camelcase
    .then((verContracts) => verContracts.data.verified_contract.map(
        // eslint-disable-next-line camelcase
        (vContract: { address: string; contract_data: any }) => ({
            address: vContract.address,
            iconUrl: vContract.contract_data.token_icon_url,
            decimals: vContract.contract_data.decimals,
            name: vContract.contract_data.name,
            symbol: vContract.contract_data.symbol,
        } as Token),
    ))
    .then((newTokens) => newTokens.concat(state.contractData));

// eslint-disable-next-line camelcase
// const tokenBalancesWithContractDataCache = (apollo: ApolloClient<any>) => (
const tokenBalancesWithContractDataCache = (apollo: any) => (
    state: { tokens: Token[]; contractData: Token[] },
    // eslint-disable-next-line camelcase
    tokenBalances: { token_address: string; balance: number }[],
) => {
    const missingCacheContractDataAddresses = tokenBalances
        .filter(
            (tb) => !state.contractData.some((cd) => cd.address === tb.token_address),
        )
        .map((tb) => tb.token_address);
    const contractDataPromise = missingCacheContractDataAddresses.length
        ? fetchTokensData(apollo, missingCacheContractDataAddresses, state)
        : Promise.resolve(state.contractData);

    return contractDataPromise.then((cData: Token[]) => {
        const tkns = tokenBalances
            .map((tBalance) => {
                const cDataTkn = cData.find(
                    (cd) => cd.address === tBalance.token_address,
                ) as Token;
                return {
                    ...cDataTkn,
                    balance: BigNumber.from(toPlainString(tBalance.balance)),
                };
            })
            .filter((v) => !!v);
        return {tokens: tkns, contractData: cData};
    });
};

// adding shareReplay is messing up TypeScriptValidateTypes
// noinspection TypeScriptValidateTypes
const loadSignerTokens = ([apollo, signer, provider]): Token[] | null => (!signer
    ? []
    : zenToRx(
        apollo.subscribe({
            query: SIGNER_TOKENS_GQL,
            variables: {accountId: signer.address},
            fetchPolicy: 'network-only',
        }),
    ).pipe(
        map((res: any) => (res.data && res.data.token_holder
            ? res.data.token_holder
            : undefined)),
        // eslint-disable-next-line camelcase
        switchMap(
            async (
                // eslint-disable-next-line camelcase
                tokenBalances: { token_address: string; balance: number }[],
            ) => {
                const reefTkn = reefTokenWithAmount();
                const reefTokenResult = tokenBalances.find(
                    (tb) => tb.token_address === reefTkn.address,
                );

                const reefBalance = await getReefCoinBalance(
                    signer.address,
                    provider as Provider,
                );
                if (!reefTokenResult) {
                    tokenBalances.push({
                        token_address: reefTkn.address,
                        balance: parseInt(utils.formatUnits(reefBalance, 'wei'), 10),
                    });
                    return Promise.resolve(tokenBalances);
                }

                reefTokenResult.balance = FixedNumber.fromValue(reefBalance).toUnsafeFloat();
                return Promise.resolve(tokenBalances);
            },
        ),
        // eslint-disable-next-line camelcase
        mergeScan(tokenBalancesWithContractDataCache(apollo), {
            tokens: [],
            contractData: [reefTokenWithAmount()],
        }),
        map((val: { tokens: Token[] }) => val.tokens.map((t) => ({
            ...t,
            iconUrl: t.iconUrl || getIconUrl(t.address),
        }))),
        map(sortReefTokenFirst),
        startWith(null)
    ));
export const selectedSignerTokenBalances$: Observable<Token[] | null> = combineLatest([
    apolloClientInstance$,
    selectedSigner$,
    currentProvider$,
]).pipe(
    switchMap(loadSignerTokens),
    catchError(((err) => {
        console.log('selectedSignerTokenBalances$ ERROR=', err.message);
        return of(null);
    })),
    shareReplay(1)
);
