import {ApolloClient} from "@apollo/client";
import {ContractType, NFT, Token, TokenTransfer} from "../../token/tokenModel";
import {ReefAccount} from "../../account/accountModel";
import {from, map, Observable, of, switchMap} from "rxjs";
import {resolveNftImageLinks} from "../../token/nftUtil";
import {BigNumber} from "ethers";
import {Network} from "../../network/network";
import {zenToRx} from "../../graphql";
import {TRANSFER_HISTORY_GQL} from "../../graphql/transferHistory.gql";
import {StatusDataObject} from "../model/statusDataObject";
import {getReefAccountSigner} from "../../account/accountSignerUtils";
import {Provider, Signer} from "@reef-defi/evm-provider";
import {toPlainString} from "./tokenUtil";
import {_NFT_IPFS_RESOLVER_FN} from "./nftUtils";
import {getIconUrl} from "../../token/getIconUrl";
import {getExtrinsicUrl} from "../../token/transactionUtil";

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

/*const resolveTransferHistoryNfts_sdo$ = (tokens: (Token | NFT)[], signer: Signer): Observable<FeedbackDataModel<FeedbackDataModel<Token | NFT>[]>> => {
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

const toTransferToken = (transfer): Token|NFT => (transfer.token.type === ContractType.ERC20 ? {
        address: transfer.token.id,
        balance: BigNumber.from(toPlainString(transfer.amount)),
        name: transfer.token.name,
        symbol: transfer.token.contractData?.symbol,
        decimals: transfer.token.contractData?.decimals||18,
        iconUrl:
            transfer.token.contractData?.iconUrl
            || getIconUrl(transfer.token.id),
    } as Token
    : {
        address: transfer.token.id,
        balance: BigNumber.from(toPlainString(transfer.amount)),
        name: transfer.token.name,
        symbol: '',
        decimals: 0,
        iconUrl: '',
        nftId: transfer.nftId,
        contractType: transfer.token.type,
    } as NFT);

const toTokenTransfers = (resTransferData: any[], signer: ReefAccount, network: Network): TokenTransfer[] => resTransferData.map((transferData): TokenTransfer => ({
    from: transferData.from?.id,
    to: transferData.to.id,
    inbound:
        transferData.to.evmAddress === signer.evmAddress
        || transferData.to.id === signer.address,
    timestamp: transferData.timestamp,
    token: toTransferToken(transferData),
    url: getExtrinsicUrl(transferData.extrinsic.id, network),
    extrinsic: { blockId: transferData.extrinsic.block.id, blockHeight: transferData.extrinsic.block.height, id: transferData.extrinsic.id, index: transferData.extrinsic.index },
    success: transferData.success,
}));

/*export const loadTransferHistory_sdo = ([apollo, signer, network, provider]:[ApolloClient<any>, FeedbackDataModel<ReefAccount>, Network, Provider]): FeedbackDataModel<FeedbackDataModel<TokenTransfer>[]> => (!signer
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
                        const [tokenTransferArrOrSDO, provider] = transfersAndProvider;

                        if (isFeedbackDM(tokenTransferArrOrSDO)) {
                            return tokenTransferArrOrSDO;
                        }
                        const tokenTransferArr = tokenTransferArrOrSDO as TokenTransfer[];

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
                                return resolveTransferHistoryNfts_sdo$(tokens, sig);
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

export const loadTransferHistory = ([apollo, account, network, provider]:[ApolloClient<any>, StatusDataObject<ReefAccount>, Network, Provider]): Observable<TokenTransfer[]> => (!account
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
                if (res?.data?.transfers) {
                    return res.data.transfers;
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
                                })
                        )),
                    );
            }),
        ));
