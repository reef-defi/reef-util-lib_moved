// TODO replace with our own from lib and remove
import {REEF_ADDRESS, REEF_TOKEN, reefTokenWithAmount, Token} from '../../token/token';
import {BigNumber} from 'ethers';
import {catchError, defer, from, map, mergeScan, Observable, of, shareReplay, startWith} from 'rxjs';
import {zenToRx} from '../../graphql';
import {getIconUrl} from '../../utils';
import {sortReefTokenFirst, toPlainString} from '../util/util';
import {CONTRACT_DATA_GQL, SIGNER_TOKENS_GQL} from '../../graphql/signerTokens.gql';
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from '../model/feedbackDataModel';
import {ApolloClient} from '@apollo/client';
import {ReefSigner} from '../../account/ReefAccount';

// eslint-disable-next-line camelcase
const fetchTokensData = (
    // apollo: ApolloClient<any>,
    apollo: any,
    missingCacheContractDataAddresses: string[],
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
    ));

function toTokensWithContractDataFn(tokenBalances: { token_address: string; balance: number }[]): (tokens: Token[]) => { tokens: FeedbackDataModel<Token>[], contractData: Token[] } {
    return (cData: Token[]) => {
        const tokens: FeedbackDataModel<Token>[] = tokenBalances
            .map((tBalance) => {
                const cDataTkn = cData.find((cd) => cd.address === tBalance.token_address);
                const balance = BigNumber.from(toPlainString(tBalance.balance));
                return cDataTkn ? toFeedbackDM({
                        ...cDataTkn,
                        balance,
                    }, FeedbackStatusCode.COMPLETE_DATA, 'Contract data set')
                    : toFeedbackDM({
                        balance,
                        address: tBalance.token_address,
                        name: undefined,
                        iconUrl: '',
                        symbol: '',
                        decimals: 0
                    }, FeedbackStatusCode.PARTIAL_DATA, 'Loading contract data');
            });

        return {tokens, contractData: cData};
    };
}

const tokenBalancesWithContractDataCache_fbk = (apollo: any) => (
    state: { tokens: FeedbackDataModel<Token>[]; contractData: Token[] },
    // eslint-disable-next-line camelcase
    tokenBalances: { token_address: string; balance: number }[],
    _: number
): Observable<{ tokens: FeedbackDataModel<Token>[]; contractData: Token[]; }> => {
    const missingCacheContractDataAddresses = tokenBalances
        .filter(
            (tb) => !state.contractData.some((cd) => cd.address === tb.token_address),
        )
        .map((tb) => tb.token_address);

    const contractDataPromise = missingCacheContractDataAddresses.length
        ? fetchTokensData(apollo, missingCacheContractDataAddresses)
            .then((newTokens) => newTokens.concat(state.contractData))
        : Promise.resolve(state.contractData);

    return defer(() => from(contractDataPromise)).pipe(
        map((tokens: Token[]) => toTokensWithContractDataFn(tokenBalances)(tokens)),
        startWith(toTokensWithContractDataFn(tokenBalances)(state.contractData)),
        shareReplay(1)
    );
};

const resolveEmptyIconUrls = (tokens: FeedbackDataModel<Token>[]): FeedbackDataModel<Token>[] =>
    tokens.map((t) => {
      if (t.data.iconUrl) {
        return t;
      }
      t.data.iconUrl = getIconUrl(t.data.address);
      return t;
    });

// adding shareReplay is messing up TypeScriptValidateTypes
// noinspection TypeScriptValidateTypes
export const loadSignerTokens_fbk = ([apollo, signer]: [ApolloClient<any>, ReefSigner]): Observable<FeedbackDataModel<Token>[] | undefined> => {
    return (!signer
        ? of(undefined)
        : zenToRx(
            apollo.subscribe({
                query: SIGNER_TOKENS_GQL,
                variables: {accountId: signer.address},
                fetchPolicy: 'network-only',
            }),
        ).pipe(
            map((res: any) => {
                if (res.data && res.data.token_holder) {
                    return res.data.token_holder;
                }
                throw new Error('No result from SIGNER_TOKENS_GQL');
            }),
            // eslint-disable-next-line camelcase
            mergeScan(tokenBalancesWithContractDataCache_fbk(apollo), {
                tokens: [],
                contractData: [reefTokenWithAmount()],
            }),
            map(({tokens}) => resolveEmptyIconUrls(tokens)),
            map(sortReefTokenFirst),
            catchError(() => {
                return of([])
            }),
        ));
};

export const setReefBalanceFromSigner = ([tokens, selSigner]: [FeedbackDataModel<Token>[] | undefined, ReefSigner | undefined]): FeedbackDataModel<Token>[] => {
    const signerTkns = tokens ? tokens : [];
    if (selSigner?.balance) {
        const reefT = signerTkns.find((t) => t.data.address === REEF_ADDRESS);
        if (reefT) {
            reefT.data.balance = selSigner.balance;
        } else {
            signerTkns.unshift(toFeedbackDM({
                ...REEF_TOKEN,
                balance: selSigner.balance
            }, FeedbackStatusCode.COMPLETE_DATA));
        }
    }
    return signerTkns;
};
