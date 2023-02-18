// TODO replace with our own from lib and remove
import {REEF_ADDRESS, REEF_TOKEN, Token, TokenBalance} from "../../token/tokenModel";
import {BigNumber} from "ethers";
import {catchError, defer, from, map, mergeScan, Observable, of, shareReplay, startWith, take, tap} from "rxjs";
import {zenToRx} from "../../graphql";
import {CONTRACT_DATA_GQL, SIGNER_TOKENS_GQL} from "../../graphql/signerTokens.gql";
import {
    collectFeedbackDMStatus,
    FeedbackDataModel,
    FeedbackStatusCode,
    isFeedbackDM,
    toFeedbackDM
} from "../model/feedbackDataModel";
import {ApolloClient} from "@apollo/client";
import {ReefAccount} from "../../account/accountModel";
import {sortReefTokenFirst, toPlainString} from "./tokenUtil";
import {getIconUrl} from "../../token/getIconUrl";
import {reefTokenWithAmount} from "../../token";

// eslint-disable-next-line camelcase
const fetchTokensData = (
    // apollo: ApolloClient<any>,
    apollo: any,
    missingCacheContractDataAddresses: string[],
): Observable<Token[]> => {
    const distinctAddr = missingCacheContractDataAddresses.reduce((distinctAddrList: string[], curr: string) => {
        if (distinctAddrList.indexOf(curr) < 0) {
            distinctAddrList.push(curr);
        }
        return distinctAddrList;
    }, []);
    return zenToRx(apollo
        .subscribe({
            query: CONTRACT_DATA_GQL,
            variables: {addresses: distinctAddr},
            fetchPolicy: 'network-only',
        })).pipe(
            take(1),
            map((verContracts:any) => verContracts.data.verifiedContracts.map(
                // eslint-disable-next-line camelcase
                (vContract: { id: string; contractData: any }) => {
                    return ({
                        address: vContract.id,
                        iconUrl: '',
                        decimals: vContract.contractData?.decimals||18,
                        name: vContract.contractData?.name,
                        symbol: vContract.contractData?.symbol,
                        balance:BigNumber.from(0)
                    } as Token);},
            )),
        catchError(err => {
            console.log('fetchTokensData ERROR=', err);
            return of([]);
        })
    )
};

// eslint-disable-next-line camelcase
function toTokensWithContractDataFn(tokenBalances: TokenBalance[]): (tkns: Token[]) => { tokens: FeedbackDataModel<Token | TokenBalance>[], contractData: Token[] } {
    return (cData: Token[]) => {
        const tokens: FeedbackDataModel<Token | TokenBalance>[] = tokenBalances
            .map((tBalance) => {
                const cDataTkn = cData.find(
                    (cd) => cd.address === tBalance.address,
                ) as Token;
                return cDataTkn ? toFeedbackDM({
                        ...cDataTkn,
                        balance: BigNumber.from(toPlainString(tBalance.balance)),
                    } as Token, FeedbackStatusCode.COMPLETE_DATA, 'Contract data set')
                    : toFeedbackDM({...tBalance} as TokenBalance, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Loading contract data');
            });

        return {tokens, contractData: cData};
    };
}

const tokenBalancesWithContractDataCache_fbk = (apollo: any) => (
    state: { tokens: FeedbackDataModel<Token | TokenBalance>[]; contractData: Token[] },
    // eslint-disable-next-line camelcase
    tokenBalances: TokenBalance[],
): Observable<{ tokens: FeedbackDataModel<Token | TokenBalance> [], contractData: Token[] }> => {
    const missingCacheContractDataAddresses = tokenBalances
        .filter(
            (tb) => !state.contractData.some((cd) => cd.address === tb.address),
        )
        .map((tb) => tb.address);
    const contractData$ = missingCacheContractDataAddresses.length
        ? fetchTokensData(apollo, missingCacheContractDataAddresses)
            .pipe(map((newTokens) => {
                return newTokens ? newTokens.concat(state.contractData) : state.contractData})
            ) : of(state.contractData);

    return contractData$.pipe(
        map((tokenContractData: Token[]) => toTokensWithContractDataFn(tokenBalances)(tokenContractData)),
        startWith(toTokensWithContractDataFn(tokenBalances)(state.contractData)),
        catchError(err => {
            console.log('tokenBalancesWithContractDataCache_fbk ERROR=', err.message);
            return of({tokens:[], contractData:state.contractData});
        }),
        shareReplay(1)
    );
};

/*let addReefTokenBalance = async (
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
};*/

const resolveEmptyIconUrls = (tokens: FeedbackDataModel<Token | TokenBalance>[]) =>
    tokens.map((tkn) => {
            if (!!tkn.data.iconUrl) {
                return tkn;
            } else {
                tkn.data.iconUrl = getIconUrl(tkn.data.address);
                return tkn;
            }
        }
    );

// adding shareReplay is messing up TypeScriptValidateTypes
// noinspection TypeScriptValidateTypes
export const loadAccountTokens_fbk = ([apollo, signer]: [ApolloClient<any>, FeedbackDataModel<ReefAccount>]): Observable<FeedbackDataModel<FeedbackDataModel<Token | TokenBalance>[]>> => {
    return (!signer
        ? of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES, 'Signer not set'))
        : zenToRx(
            apollo.subscribe({
                query: SIGNER_TOKENS_GQL,
                variables: {accountId: signer.data.address},
                fetchPolicy: 'network-only',
            }),
        ).pipe(
            map((res: any): TokenBalance[] => {
                if (res?.data?.tokenHolders) {
                    return res.data.tokenHolders.map(th => ({
                        address: th.token.id,
                        balance: th.balance
                    } as TokenBalance));
                }

                if(isFeedbackDM(res)){
                    return res;
                }
                throw new Error('No result from SIGNER_TOKENS_GQL');
            }),
            // eslint-disable-next-line camelcase
            mergeScan(tokenBalancesWithContractDataCache_fbk(apollo), {
                tokens: [],
                contractData: [reefTokenWithAmount()],
            }),
            map((tokens_cd: { tokens: FeedbackDataModel<Token | TokenBalance>[] }) => resolveEmptyIconUrls(tokens_cd.tokens)),
            map(sortReefTokenFirst),
            map((tkns: FeedbackDataModel<Token | TokenBalance>[]) => toFeedbackDM(tkns, collectFeedbackDMStatus(tkns))),
            catchError(err => {
                console.log('loadAccountTokens ERROR=', err.message);
                return of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message));
            }),
            shareReplay(1)
        ));
};

export const setReefBalanceFromAccount = ([tokens, selSigner]: [FeedbackDataModel<FeedbackDataModel<Token | TokenBalance>[]>, FeedbackDataModel<ReefAccount> | undefined]): FeedbackDataModel<FeedbackDataModel<Token | TokenBalance>[]> => {
    if (!selSigner) {
        return toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES);
    }
    const signerTkns = tokens ? tokens.data : [];
    if (selSigner.data.balance) {
        const reefT = signerTkns.find((t) => t.data.address === REEF_ADDRESS);
        if (reefT) {
            reefT.data.balance = selSigner.data.balance;
        } else {
            signerTkns.unshift(toFeedbackDM({
                ...REEF_TOKEN,
                balance: selSigner.data.balance
            }, FeedbackStatusCode.COMPLETE_DATA));
        }
    }
    return toFeedbackDM(signerTkns, tokens.getStatusList());
};
