import {map, Observable, of, startWith, switchMap} from "rxjs";
import {BigNumber} from "ethers";
import {ERC1155ContractData, ERC721ContractData, NFT} from "../../token/token";
import {zenToRx} from "../../graphql";
import {resolveNftImageLinks} from "../../token/nftUtil";
import {_NFT_IPFS_RESOLVER_FN} from "../util/util";
import {ReefSigner} from "../../account/ReefAccount";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "../model/feedbackDataModel";
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

export const loadSignerNfts = ([apollo, signer]): Observable<FeedbackDataModel<NFT[]>> => (!signer
    ? of(toFeedbackDM([] as NFT[], FeedbackStatusCode.COMPLETE_DATA, 'Signer not set'))
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
            map((res: any) => (res && res.data && res.data.token_holder
                ? res.data.token_holder as VerifiedNft[]
                : undefined)),
            map((res: VerifiedNft[] | undefined) => parseTokenHolderArray(res || [])),
            switchMap((nfts: NFT[]) => (resolveNftImageLinks(nfts, signer.signer, _NFT_IPFS_RESOLVER_FN) as Observable<NFT[]>)),
            map(data => toFeedbackDM(data as NFT[])),
            startWith(toFeedbackDM([] as NFT[], FeedbackStatusCode.LOADING))
        ));

