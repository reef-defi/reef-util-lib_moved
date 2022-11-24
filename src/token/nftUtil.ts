import {
    catchError,
    combineLatest, finalize,
    forkJoin,
    map,
    Observable,
    of,
    startWith,
    switchMap,
    tap,
    withLatestFrom
} from 'rxjs';
import {Contract} from 'ethers';
import axios from 'axios';
import {Signer} from '@reef-defi/evm-provider';
import {getContractTypeAbi, NFT, NFTMetadata} from "./token";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "../appState/model/feedbackDataModel";

const extractIpfsHash = (ipfsUri: string): string | null => {
    const ipfsProtocol = 'ipfs://';
    if (ipfsUri?.startsWith(ipfsProtocol)) {
        return ipfsUri.substring(ipfsProtocol.length);
    }
    return null;
};

const toIpfsProviderUrl = (ipfsUriStr: string, ipfsUrlResolver?: ipfsUrlResolverFn): string | null => {
    const ipfsHash = extractIpfsHash(ipfsUriStr);
    if (ipfsHash) {
        return !ipfsUrlResolver ? `https://cloudflare-ipfs.com/ipfs/${ipfsHash}` : ipfsUrlResolver(ipfsHash);
    }
    return null;
};

const resolveUriToUrl = (uri: string, nft: NFT, ipfsUrlResolver?: ipfsUrlResolverFn): string => {
    const ipfsUrl = toIpfsProviderUrl(uri, ipfsUrlResolver);
    if (ipfsUrl) {
        return ipfsUrl;
    }

    const idPlaceholder = '{id}';
    if (nft.nftId != null && uri.indexOf(idPlaceholder) > -1) {
        let replaceValue = nft.nftId;
        try {
            replaceValue = parseInt(nft.nftId, 10)
                .toString(16)
                .padStart(64, '0');
        } catch (e) {
        }
        return uri.replace(idPlaceholder, replaceValue);
    }
    console.log("RRRRR=",uri);
    return uri;
};

const resolveImageData = (metadata: NFTMetadata, nft: NFT, ipfsUrlResolver?: ipfsUrlResolverFn): NFTMetadata => {
    const imageUriVal: string = metadata?.image ? metadata.image : metadata.toString();
    return {
        iconUrl: resolveUriToUrl(imageUriVal, nft, ipfsUrlResolver),
        name: metadata.name,
        mimetype: metadata.mimetype
    };
};

export const getResolveNftPromise = async (nft: NFT | null, signer: Signer, ipfsUrlResolver?: ipfsUrlResolverFn): Promise<NFT | null> => {
    if (!nft) {
        return Promise.resolve(null);
    }
    try {
        // throw new Error('Test234')
        const contractTypeAbi = getContractTypeAbi(nft.contractType);
        const contract = new Contract(nft.address, contractTypeAbi, signer);
        const uriPromise = (contractTypeAbi as any).some((fn) => fn.name === 'uri') ? contract.uri(nft.nftId)
            : contract.tokenURI(nft.nftId).catch(reason => console.log('error getting contract uri'));

        return await uriPromise
            .then((metadataUri) => resolveUriToUrl(metadataUri, nft, ipfsUrlResolver))
            .then(axios.get)
            .then((jsonStr) => resolveImageData(jsonStr.data, nft, ipfsUrlResolver))
            .then((nftUri) => ({...nft, ...nftUri}));
    } catch (e: any) {
        console.log("ERROR getResolveNftPromise=", e);
        throw new Error(e.message);
    }
};

export const resolveNftImageLinks = (nfts: (NFT | null)[], signer: Signer, ipfsUrlResolver?: ipfsUrlResolverFn): Observable<(NFT | null)[]> => (nfts?.length ? forkJoin(nfts.map((nft) => getResolveNftPromise(nft, signer, ipfsUrlResolver))) : of([]));

export const resolveNftImageLinks$ = (nfts: (NFT | null)[]|NFT[], signer: Signer, ipfsUrlResolver?: ipfsUrlResolverFn): Observable<(FeedbackDataModel<(NFT | null)>[])> | Observable<(FeedbackDataModel<(NFT)>[])> => {
    if (!nfts || !signer) {
        return of([]);
    }
    const resolveObsArr: Observable<FeedbackDataModel<NFT | null>>[] = nfts.map(
        (nft: NFT | null) => of(nft).pipe(
            switchMap((nft: NFT | null) => getResolveNftPromise(nft, signer, ipfsUrlResolver)),
            map((resNft: NFT | null) => toFeedbackDM(resNft, FeedbackStatusCode.COMPLETE_DATA, 'Url resolved')),
            catchError(err => {
                console.log("ERROR resolving nft img=", err);
                return of(toFeedbackDM(nft, FeedbackStatusCode.MISSING_INPUT_VALUES, 'Url resolve error.', 'iconUrl'));
            }),
            startWith(toFeedbackDM(nft, FeedbackStatusCode.PARTIAL_DATA_LOADING, 'Resolving url.', 'iconUrl'))
        )
    );
    return combineLatest(
        resolveObsArr
    )
    // .pipe(tap(v=>console.log('NFTS TAP', v)));
};


export type ipfsUrlResolverFn = (ipfsHash) => string;
