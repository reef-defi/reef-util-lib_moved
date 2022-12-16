import {ApolloClient} from "@apollo/client";
import {ContractType, NFT, Token, TokenTransfer} from "../../token/tokenModel";
import {ReefAccount} from "../../account/accountModel";
import {firstValueFrom, from, map, Observable, of, race, switchMap, take, tap, timer} from "rxjs";
import {resolveNftImageLinks} from "../../token/nftUtil";
import {BigNumber} from "ethers";
import {getExtrinsicUrl, getIconUrl} from "../../utils";
import {Network} from "../../network/network";
import {zenToRx} from "../../graphql";
import {TRANSFER_HISTORY_GQL} from "../../graphql/transferHistory.gql";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "../model/feedbackDataModel";
import {getAccountSigner, getReefAccountSigner} from "../../account/accountSignerUtils";
import {Provider, Signer} from "@reef-defi/evm-provider";
import {toPlainString} from "./tokenUtil";
import {_NFT_IPFS_RESOLVER_FN} from "./nftUtils";
import {accountsJsonSigningKeySubj} from "../account/setAccounts";

const resolveTransferHistoryNfts = (tokens: (Token | NFT)[], signer: Signer): Observable<(Token | NFT)[]> => {
    const nftOrNull: (NFT|null)[] = tokens.map((tr) => ('contractType' in tr && (tr.contractType === ContractType.ERC1155 || tr.contractType === ContractType.ERC721) ? tr : null));
    if (!nftOrNull.filter((v) => !!v).length) {
        return of(tokens);
    }
    return of(nftOrNull)
        .pipe(
            switchMap((nfts:(NFT | null)[]) => resolveNftImageLinks(nfts, signer, _NFT_IPFS_RESOLVER_FN)),
            map((nftOrNullResolved: (NFT | null)[]) => {
                const resolvedNftTransfers: (Token | NFT)[] = [];
                nftOrNullResolved.forEach((nftOrN, i) => {
                    resolvedNftTransfers.push(nftOrN || tokens[i]);
                });
                return resolvedNftTransfers;
            }),
        );
};

/*const resolveTransferHistoryNfts_fdm$ = (tokens: (Token | NFT)[], signer: Signer): Observable<FeedbackDataModel<FeedbackDataModel<Token | NFT>[]>> => {
    const nftOrNull: (NFT|null)[] = tokens.map((tr) => ('contractType' in tr && (tr.contractType === ContractType.ERC1155 || tr.contractType === ContractType.ERC721) ? tr : null));
    if (!nftOrNull.filter((v) => !!v).length) {
        return of(toFeedbackDM(tokens.map(t=>toFeedbackDM(t, FeedbackStatusCode.COMPLETE_DATA)), FeedbackStatusCode.COMPLETE_DATA, 'No nft tokens'));
    }
    return of(nftOrNull)
        .pipe(
            switchMap((nfts:(NFT | null)[]) => resolveNftImageLinks$(nfts, sig, _NFT_IPFS_RESOLVER_FN)),
            map((nftOrNullResolved: FeedbackDataModel<NFT | null>[]) => {
                const resolvedNftTransfers: (Token | NFT)[] = [];
                nftOrNullResolved.forEach((nftOrN, i) => {
                    resolvedNftTransfers.push(nftOrN || tokens[i]);
                });
                return resolvedNftTransfers;
            }),
        );
};*/

const toTransferToken = (transfer): Token|NFT => (transfer.token.verified_contract.type === ContractType.ERC20 ? {
        address: transfer.token_address,
        balance: BigNumber.from(toPlainString(transfer.amount)),
        name: transfer.token.verified_contract.contract_data.name,
        symbol: transfer.token.verified_contract.contract_data.symbol,
        decimals:
        transfer.token.verified_contract.contract_data.decimals,
        iconUrl:
            transfer.token.verified_contract.contract_data.icon_url
            || getIconUrl(transfer.token_address),
    } as Token
    : {
        address: transfer.token_address,
        balance: BigNumber.from(toPlainString(transfer.amount)),
        name: transfer.token.verified_contract.contract_data.name,
        symbol: transfer.token.verified_contract.contract_data.symbol,
        decimals: 0,
        iconUrl: '',
        nftId: transfer.nft_id,
        contractType: transfer.token.verified_contract.type,
    } as NFT);

const toTokenTransfers = (resTransferData: any[], signer: ReefAccount, network: Network): TokenTransfer[] => resTransferData.map((transferData): TokenTransfer => ({
    from: transferData.from_address,
    to: transferData.to_address,
    inbound:
        transferData.to_address === signer.evmAddress
        || transferData.to_address === signer.address,
    timestamp: transferData.timestamp,
    token: toTransferToken(transferData),
    url: getExtrinsicUrl(transferData.extrinsic.hash, network),
    extrinsic: { blockId: transferData.extrinsic.block_id, hash: transferData.extrinsic.hash, index: transferData.extrinsic.index },
}));

/*export const loadTransferHistory_fdm = ([apollo, signer, network, provider]:[ApolloClient<any>, FeedbackDataModel<ReefAccount>, Network, Provider]): FeedbackDataModel<FeedbackDataModel<TokenTransfer>[]> => (!signer
    ? of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES, 'Signer not set'))
    : zenToRx(
        apollo.subscribe({
            query: TRANSFER_HISTORY_GQL,
            variables: { accountId: signer.data.address },
            fetchPolicy: 'network-only',
        }),
    )
        .pipe(
                map((res: any) => {
                        if (res?.data?.transfer) {
                            return res.data.transfer as any[];
                        }

                        if (isFeedbackDM(res)) {
                            return res;
                        }
                        throw new Error('Could not load data.');
                    }
                ),
                map((resData: any) => isFeedbackDM(resData)?resData:toTokenTransfers(resData, signer.data, network)),
                switchMap((transfersArr: TokenTransfer[]|FeedbackDataModel<any>) => combineLatest([
                        of(transfersArr), instantProvider$
                    ]).pipe(
                    switchMap((transfersAndProvider: [TokenTransfer[]|FeedbackDataModel<any>, Provider | undefined]) => {
                        const [tokenTransferArrOrFDM, provider] = transfersAndProvider;

                        if (isFeedbackDM(tokenTransferArrOrFDM)) {
                            return tokenTransferArrOrFDM;
                        }
                        const tokenTransferArr = tokenTransferArrOrFDM as TokenTransfer[];

                        if (!provider) {
                            let tkns = tokenTransferArr.map(nft => toFeedbackDM(nft, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Provider not connected.'));
                            return of(toFeedbackDM(tkns, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Provider not set'));
                        }
                        const sig$ = from(getReefAccountSigner(signer.data, provider));

                        return sig$.pipe(
                            switchMap((sig) => {
                                if (!sig) {
                                    let tkns = tokenTransferArr.map(transfers => toFeedbackDM(transfers, FeedbackStatusCode.MISSING_INPUT_VALUES, 'Could not create Signer.'));
                                    return of(toFeedbackDM(tkns, FeedbackStatusCode.MISSING_INPUT_VALUES, 'Signer not created'));
                                }
                                const tokens = tokenTransferArr.map((tr: TokenTransfer) => tr.token);
                                return resolveTransferHistoryNfts_fdm$(tokens, sig);
                            }),
                            map((resolvedTokens: FeedbackDataModel<FeedbackDataModel<Token | NFT>[]>) => {
                                return ... TODO return correct type
                                resolvedTokens.map((resToken: Token | NFT, i) => ({
                                    ...tokenTransferArr[i],
                                    token: resToken,
                                }))
                            }),
                        );
                    }),
                    )
                ),
            catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message)))
        );*/

export const loadTransferHistory = ([apollo, account, network, provider]:[ApolloClient<any>, FeedbackDataModel<ReefAccount>, Network, Provider]): Observable<TokenTransfer[]> => (!account
    ? of([])
    : zenToRx(
        apollo.subscribe({
            query: TRANSFER_HISTORY_GQL,
            variables: { accountId: account.data.address },
            fetchPolicy: 'network-only',
        }),
    )
        .pipe(
            map((res: any) => {
                // res.data && res.data.transfer ? res.data.transfer : undefined
                if (res?.data?.transfer) {
                    return res.data.transfer;
                }
                throw new Error('Could not load data.');
            }),
            map((resData: any) => toTokenTransfers(resData, account.data, network)),
            switchMap((transfers: TokenTransfer[]): Observable<TokenTransfer[]> => {
                const tokens = transfers.map((tr: TokenTransfer) => tr.token);
                const sig$ = from(getReefAccountSigner(account.data, provider));

                return from(sig$)
                    .pipe(
                        switchMap((sig: Signer|undefined)=>(sig?resolveTransferHistoryNfts(tokens, sig):[])),
                        map((resolvedTokens: (Token | NFT)[]) => resolvedTokens.map((resToken: Token | NFT, i) => ({
                            ...transfers[i],
                            token: resToken,
                        }))),
                    );
            }),
        ));
