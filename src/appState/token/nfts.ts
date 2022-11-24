import {catchError, combineLatest, finalize, from, map, merge, NEVER, Observable, of, switchMap, tap} from "rxjs";
import {BigNumber} from "ethers";
import {ERC1155ContractData, ERC721ContractData, NFT} from "../../token/token";
import {zenToRx} from "../../graphql";
import {resolveNftImageLinks$} from "../../token/nftUtil";
import {_NFT_IPFS_RESOLVER_FN} from "../util/util";
import {ReefAccount} from "../../account/ReefAccount";
import {
    collectFeedbackDMStatus,
    FeedbackDataModel,
    FeedbackStatusCode,
    isFeedbackDM,
    toFeedbackDM
} from "../model/feedbackDataModel";
import {SIGNER_NFTS_GQL} from "../../graphql/signerNfts.gql";
import {getReefAccountSigner} from "../../account/accounts";
import {Provider} from "@reef-defi/evm-provider";
import {instantProvider$} from "../providerState";

export interface VerifiedNft {
    token_address: string;
    balance: string;
    nft_id: string;
    info: { symbol: string };
    contract: {
        verified_contract: {
            type: 'ERC1155' | 'ERC721';
            contract_data: ERC1155ContractData | ERC721ContractData;
        }
    }
}

const parseTokenHolderArray = (resArr: VerifiedNft[]): NFT[] => resArr
    .map(({
              balance,
              nft_id: nftId,
              info: {symbol},
              token_address,
              contract: {
                  verified_contract: {
                      contract_data,
                      type
                  }
              },
          }) => {

        return ({
            contractType: type,
            balance: BigNumber.from(balance),
            nftId,
            symbol,
            decimals: 0,
            data: contract_data,
            address: token_address,
            iconUrl: '',
            name: contract_data.type === 'ERC721' ? contract_data.name : '',
        } as NFT)
    });


export const loadSignerNfts = ([apollo, signer]:[any, FeedbackDataModel<ReefAccount>]): Observable<FeedbackDataModel<FeedbackDataModel<NFT>[]>> => (
    !signer||!apollo
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
                if (res?.data?.token_holder) {
                    return res.data.token_holder as VerifiedNft[];
                }

                if(isFeedbackDM(res)){
                    return res;
                }
                    throw new Error('Could not load data.');
                }
            ),
            map((res: VerifiedNft[] | undefined) => parseTokenHolderArray(res || [])),
            switchMap((nftArr: NFT[]) => combineLatest([
                of(nftArr), instantProvider$
                ]).pipe(
                switchMap( (nftsAndProvider:[(NFT|null)[]|NFT[], Provider|undefined]) => {
                    const [nfts,provider] = nftsAndProvider;

                    if(!provider) {
                        return of(nfts.map(nft => toFeedbackDM(nft, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Provider not connected.')));
                    }
                    const sig$ = from( getReefAccountSigner(signer.data, provider));

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
