// TODO replace with our own from lib and remove
import {REEF_ADDRESS, REEF_TOKEN, reefTokenWithAmount, Token} from "../../token/token";
import {BigNumber, FixedNumber, utils} from "ethers";
import {defer, from, map, mergeScan, Observable, of, shareReplay, startWith, tap} from "rxjs";
import {zenToRx} from "../../graphql";
import {getReefCoinBalance} from "../../account/accounts";
import {getIconUrl} from "../../utils";
import {sortReefTokenFirst, toPlainString} from "../util/util";
import {Provider} from "@reef-defi/evm-provider";
import {CONTRACT_DATA_GQL, SIGNER_TOKENS_GQL} from "../../graphql/signerTokens.gql";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "../model/feedbackDataModel";
import {ApolloClient} from "@apollo/client";
import {ReefSigner} from "../../account/ReefAccount";

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

// eslint-disable-next-line camelcase
function toTokensWithContractDataFn(tokenBalances: { token_address: string; balance: number }[]): (tkns: Token[]) => { tokens: FeedbackDataModel<Token>[], contractData: Token[] } {
    return (cData: Token[]) => {
        const tkns: FeedbackDataModel<Token>[] = tokenBalances
            .map((tBalance) => {
                const cDataTkn = cData.find(
                    (cd) => cd.address === tBalance.token_address,
                ) as Token;
                return cDataTkn ? toFeedbackDM({
                    ...cDataTkn,
                    balance: BigNumber.from(toPlainString(tBalance.balance)),
                } as Token, FeedbackStatusCode.COMPLETE_DATA, 'Contract data set')
                    : toFeedbackDM({
                    address: tBalance.token_address,
                    balance: tBalance.balance
                } as Token, FeedbackStatusCode.PARTIAL_DATA, 'Loading contract data');
            });

        return {tokens: tkns, contractData: cData};
    };
}

// const tokenBalancesWithContractDataCache = (apollo: ApolloClient<any>) => (
const tokenBalancesWithContractDataCache_fbk = (apollo: any) => (
    state: { tokens: FeedbackDataModel<Token>[]; contractData: Token[] },
    // eslint-disable-next-line camelcase
    tokenBalances: { token_address: string; balance: number }[],
) => {
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

const resolveEmptyIconUrls = (tokens: FeedbackDataModel<Token>[]) =>
    tokens.map((t) =>
        t.data.iconUrl ? t : (t.data.iconUrl= t.data.iconUrl || getIconUrl(t.data.address))&&t
        );

// adding shareReplay is messing up TypeScriptValidateTypes
// noinspection TypeScriptValidateTypes
export const loadSignerTokens_fbk = ([apollo, signer]: [ApolloClient<any>, ReefSigner]): Observable<FeedbackDataModel<Token>[] | null> => {
    return (!signer
        ? of(null)
        : zenToRx(
            apollo.subscribe({
                query: SIGNER_TOKENS_GQL,
                variables: {accountId: signer.address},
                fetchPolicy: 'network-only',
            }),
        ).pipe(
            map((res: any) => (res.data && res.data.token_holder
                ? res.data.token_holder
                : throw new Error('No result from SIGNER_TOKENS_GQL'))),
            // eslint-disable-next-line camelcase
            mergeScan(tokenBalancesWithContractDataCache_fbk(apollo), {
                tokens: [],
                contractData: [reefTokenWithAmount()],
            }),
            map(({tokens}) => resolveEmptyIconUrls(tokens)),
            map(sortReefTokenFirst)
        ));
};

export const setReefBalanceFromSigner = ([tokens, selSigner]: [FeedbackDataModel<Token>[] | null, ReefSigner]): FeedbackDataModel<Token>[] => {
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


/*
// adding shareReplay is messing up TypeScriptValidateTypes
// noinspection TypeScriptValidateTypes
export const loadSignerTokens = ([apollo, signer, provider]): Token[] | null => (!signer
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
*/

