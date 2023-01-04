import {catchError, combineLatest, from, map, Observable, of, switchMap} from "rxjs";
import {BigNumber} from "ethers";
import {ContractType, ERC1155ContractData, ERC721ContractData, NFT} from "../../token/tokenModel";
import {zenToRx} from "../../graphql";
import {ipfsUrlResolverFn, resolveNftImageLinks$} from "../../token/nftUtil";
import {ReefAccount} from "../../account/accountModel";
import {
    collectFeedbackDMStatus,
    FeedbackDataModel,
    FeedbackStatusCode,
    isFeedbackDM,
    toFeedbackDM
} from "../model/feedbackDataModel";
import {SIGNER_NFTS_GQL} from "../../graphql/signerNfts.gql";
import {getReefAccountSigner} from "../../account/accountSignerUtils";
import {Provider} from "@reef-defi/evm-provider";
import {instantProvider$} from "../providerState";

export let _NFT_IPFS_RESOLVER_FN: ipfsUrlResolverFn | undefined;
export const setNftIpfsResolverFn = (val?: ipfsUrlResolverFn) => {
    _NFT_IPFS_RESOLVER_FN = val;
};

export interface VerifiedNft {
    token: {
        id: string;
        type: ContractType.ERC1155 | ContractType.ERC721;
    };
    balance: string;
    nftId: string;
}

const parseTokenHolderArray = (resArr: VerifiedNft[]): NFT[] => resArr
    .map(({
              balance,
              nftId,
              token:{id:address, type:contractType},
          }) => {

        return ({
            contractType,
            balance: BigNumber.from(balance),
            nftId,
            symbol:'',
            decimals: 0,
            address,
            iconUrl: '',
            name: '',
        } as NFT)
    });

export const loadSignerNfts = ([apollo, signer]: [any, FeedbackDataModel<ReefAccount>]): Observable<FeedbackDataModel<FeedbackDataModel<NFT>[]>> => (
    !signer || !apollo
        ? of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES, 'Signer not set'))
        : zenToRx(
        apollo.subscribe({
            query: SIGNER_NFTS_GQL,
            variables: {
                accountId: (signer.data as ReefAccount).address,
            },
            fetchPolicy: 'network-only',
        }),
        )
            .pipe(
                map((res: any) => {
                        if (res?.data?.tokenHolders) {
                            return res.data.tokenHolders as VerifiedNft[];
                        }

                        if (isFeedbackDM(res)) {
                            return res;
                        }
                        throw new Error('Could not load data.');
                    }
                ),
                map((res: VerifiedNft[]) =>parseTokenHolderArray(res)),
                // TODO handle FDM- map((res: VerifiedNft[]|FeedbackDataModel<NFT[]>) => isFeedbackDM(res)?res:parseTokenHolderArray(res)),
                switchMap((nftArr: NFT[]) => combineLatest([
                        of(nftArr), instantProvider$
                    ]).pipe(
                    switchMap((nftsAndProvider: [(NFT | null)[] | NFT[], Provider | undefined]) => {
                        const [nfts, provider] = nftsAndProvider;

                        if (!provider) {
                            return of(nfts.map(nft => toFeedbackDM(nft, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Provider not connected.')));
                        }
                        const sig$ = from(getReefAccountSigner(signer.data, provider));

                        return sig$.pipe(
                            switchMap((sig) => {
                                if (!sig) {
                                    return of(nfts.map(nft => toFeedbackDM(nft, FeedbackStatusCode.MISSING_INPUT_VALUES, 'Could not create Signer.')));
                                }
                                return resolveNftImageLinks$(nfts, sig, _NFT_IPFS_RESOLVER_FN);
                            })
                        );
                    }),
                    map((feedbackNfts: FeedbackDataModel<NFT>[]): FeedbackDataModel<FeedbackDataModel<NFT>[]> => {
                        const codes = collectFeedbackDMStatus(feedbackNfts);
                        const message = codes.some(c => c === FeedbackStatusCode.PARTIAL_DATA_LOADING) ? 'Resolving nft urls.' : '';
                        return toFeedbackDM(feedbackNfts, codes, message);
                    })
                    )
                ),
                catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message)))
            ));
