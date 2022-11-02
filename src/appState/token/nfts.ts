import {catchError, map, Observable, of, shareReplay, startWith, switchMap, tap} from "rxjs";
import {BigNumber} from "ethers";
import {ERC1155ContractData, ERC721ContractData, NFT} from "../../token/token";
import {zenToRx} from "../../graphql";
import {resolveNftImageLinks$} from "../../token/nftUtil";
import {_NFT_IPFS_RESOLVER_FN} from "../util/util";
import {ReefSigner} from "../../account/ReefAccount";
import {
    collectFeedbackDMStatus,
    FeedbackDataModel,
    FeedbackStatusCode,
    isFeedbackDM,
    toFeedbackDM
} from "../model/feedbackDataModel";
import {SIGNER_NFTS_GQL} from "../../graphql/signerNfts.gql";

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


export const loadSignerNfts = ([apollo, signer]): Observable<FeedbackDataModel<FeedbackDataModel<NFT>[]>> => (!signer
    ? of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES, 'Signer not set'))
    : zenToRx(
        apollo.subscribe({
            query: SIGNER_NFTS_GQL,
            variables: {
                accountId: (signer as ReefSigner).address,
            },
            fetchPolicy: 'network-only',
        }),
    )
        .pipe(
            map((res: any) => {
                    if (!res || !res.data || !res.data.token_holder) {
                        throw new Error('Could not load data.');
                    }
                    return res.data.token_holder as VerifiedNft[];
                }
            ),
            map((res: VerifiedNft[] | undefined) => parseTokenHolderArray(res || [])),
            switchMap((nftArr: NFT[]) => of(nftArr).pipe(
                switchMap(nfts => {
                    return resolveNftImageLinks$(nfts, signer.signer, _NFT_IPFS_RESOLVER_FN) as Observable<FeedbackDataModel<NFT>[]>
                }),
                map((feedbackNfts: FeedbackDataModel<NFT>[]): FeedbackDataModel<FeedbackDataModel<NFT>[]> => {
                    const codes = collectFeedbackDMStatus(feedbackNfts);
                    const message = codes.some(c => c === FeedbackStatusCode.PARTIAL_DATA_LOADING) ? 'Resolving nft urls.' : '';
                    return toFeedbackDM(feedbackNfts, codes, message);
                })
                )
            ),
            //map(data => isFeedbackDM(data) ? data : toFeedbackDM(data as NFT[])),
            catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message)))
        ));
