import {ApolloClient} from "@apollo/client";
import {ContractType, NFT, Token, TokenTransfer} from "../../token/tokenModel";
import {ReefAccount, ReefSigner} from "../../account/accountModel";
import {from, map, Observable, of, switchMap} from "rxjs";
import {resolveNftImageLinks} from "../../token/nftUtil";
import {BigNumber} from "ethers";
import {getExtrinsicUrl, getIconUrl} from "../../utils";
import {Network} from "../../network/network";
import {zenToRx} from "../../graphql";
import {TRANSFER_HISTORY_GQL} from "../../graphql/transferHistory.gql";
import {FeedbackDataModel} from "../model/feedbackDataModel";
import {getReefAccountSigner} from "../../account/accountSignerUtils";
import {Provider, Signer} from "@reef-defi/evm-provider";
import {toPlainString} from "./tokenUtil";
import {_NFT_IPFS_RESOLVER_FN} from "./nftUtils";

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

export const loadTransferHistory = ([apollo, signer, network, provider]:[ApolloClient<any>, FeedbackDataModel<ReefAccount>, Network, Provider]) => (!signer
    ? []
    : zenToRx(
        apollo.subscribe({
            query: TRANSFER_HISTORY_GQL,
            variables: { accountId: signer.data.address },
            fetchPolicy: 'network-only',
        }),
    )
        .pipe(
            map((res: any) => (res.data && res.data.transfer ? res.data.transfer : undefined)),
            map((resData: any) => toTokenTransfers(resData, signer.data, network)),
            switchMap((transfers: TokenTransfer[]) => {
                const tokens = transfers.map((tr: TokenTransfer) => tr.token);
                return from(getReefAccountSigner(signer!.data, provider))
                    .pipe(
                        switchMap((sig: Signer|undefined)=>sig?resolveTransferHistoryNfts(tokens, sig):[]),
                        map((resolvedTokens: (Token | NFT)[]) => resolvedTokens.map((resToken: Token | NFT, i) => ({
                            ...transfers[i],
                            token: resToken,
                        }))),
                    );
            }),
        ));

