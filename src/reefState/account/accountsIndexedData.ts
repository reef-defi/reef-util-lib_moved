import {gql} from "@apollo/client";
import {catchError, combineLatest, map, Observable, of, scan, shareReplay, startWith, switchMap} from "rxjs";
import {apolloClientInstance$, zenToRx} from "../../graphql";
import {accountsWithUpdatedChainDataBalances$} from "./accountsWithUpdatedChainDataBalances";
import {ReefAccount} from "../../account/accountModel";
import {accountsLocallyUpdatedData$} from "./accountsLocallyUpdatedData";
import {availableAddresses$} from "./availableAddresses";
import {FeedbackDataModel, FeedbackStatusCode, isFeedbackDM, toFeedbackDM} from "../model/feedbackDataModel";
import {getAddressesErrorFallback} from "./errorUtil";

const EVM_ADDRESS_UPDATE_GQL = gql`
  subscription query($accountIds: [String!]!) {
    account(
      where: { address: { _in: $accountIds } }
      order_by: { timestamp: asc, address: asc }
    ) {
      address
      evm_address
    }
  }
`;

// eslint-disable-next-line camelcase
interface AccountEvmAddrData {
    address: string;
    // eslint-disable-next-line camelcase
    evm_address?: string;
    isEvmClaimed?: boolean;
}

export const indexedAccountValues$: Observable<FeedbackDataModel<AccountEvmAddrData[]>> = combineLatest([
    apolloClientInstance$,
    availableAddresses$,
])
    .pipe(
        switchMap(([apollo, signers]) => (!signers
            ? of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES, 'Signer not set'))
            : zenToRx(
                apollo.subscribe({
                    query: EVM_ADDRESS_UPDATE_GQL,
                    variables: {accountIds: signers.map((s: any) => s.address)},
                    fetchPolicy: 'network-only',
                }),
            ))),
        map((result: any): FeedbackDataModel<AccountEvmAddrData[]> => {
            if (result?.data?.account) {
                return toFeedbackDM(result.data.account as AccountEvmAddrData[], FeedbackStatusCode.COMPLETE_DATA, 'Indexed evm address loaded');
            }
            if (isFeedbackDM(result)) {
                return result;
            }
            throw new Error('No result from EVM_ADDRESS_UPDATE_GQL');
        }),
        catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
        startWith(toFeedbackDM([], FeedbackStatusCode.LOADING)),
        shareReplay(1)
    );

export const accountsWithUpdatedIndexedData$ = combineLatest([
    accountsWithUpdatedChainDataBalances$,
    accountsLocallyUpdatedData$,
    indexedAccountValues$,
])
    .pipe(
        scan(
            (
                state: {
                    lastlocallyUpdated: FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>;
                    lastIndexed: FeedbackDataModel<AccountEvmAddrData[]>;
                    lastSigners: FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>;
                    signers: FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>;
                },
                [accountsWithChainBalance, locallyUpdated, indexed]: [FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>, FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>, FeedbackDataModel<AccountEvmAddrData[]>],
            ) => {
                let updateBindValues: FeedbackDataModel<AccountEvmAddrData>[] = [];
                if (state.lastlocallyUpdated !== locallyUpdated) {
                    updateBindValues = locallyUpdated.data.map((updSigner) => toFeedbackDM({
                        address: updSigner.data.address,
                        isEvmClaimed: updSigner.data.isEvmClaimed,
                    }, updSigner.getStatusList()));
                } else if (state.lastIndexed !== indexed) {
                    updateBindValues = indexed.data.map((updSigner: AccountEvmAddrData) => toFeedbackDM({
                        address: updSigner.address,
                        isEvmClaimed: !!updSigner.evm_address,
                    }, indexed.getStatusList()));
                } else {
                    updateBindValues = state.lastSigners.data.map((updSigner) => toFeedbackDM({
                        address: updSigner.data.address,
                        isEvmClaimed: updSigner.data.isEvmClaimed,
                    }, updSigner.getStatusList()));
                }
                updateBindValues.forEach((updVal: FeedbackDataModel<AccountEvmAddrData>) => {
                    const signer = accountsWithChainBalance.data.find((sig) => sig.data.address === updVal.data.address);
                    if (signer) {
                        let isEvmClaimedPropName = 'isEvmClaimed';
                        const resetEvmClaimedStat = signer.getStatusList().filter(stat => stat.propName != isEvmClaimedPropName);
                        updVal.getStatusList().forEach(updStat => {
                            resetEvmClaimedStat.push({propName: isEvmClaimedPropName, code: updStat.code})
                        });
                        if (updVal.hasStatus(FeedbackStatusCode.COMPLETE_DATA)) {
                            signer.data.isEvmClaimed = !!updVal.data.isEvmClaimed;
                        }
                        signer.setStatus(resetEvmClaimedStat);
                    }
                });
                return {
                    signers: accountsWithChainBalance,
                    lastlocallyUpdated: locallyUpdated,
                    lastIndexed: indexed,
                    lastSigners: accountsWithChainBalance,
                };
            },
            {
                signers: toFeedbackDM([], FeedbackStatusCode.LOADING),
                lastlocallyUpdated: toFeedbackDM([], FeedbackStatusCode.LOADING),
                lastIndexed: toFeedbackDM([], FeedbackStatusCode.LOADING),
                lastSigners: toFeedbackDM([], FeedbackStatusCode.LOADING),
            },
        ),
        map((values: { signers: FeedbackDataModel<FeedbackDataModel<ReefAccount>[]> }) => values.signers),
        catchError(err => getAddressesErrorFallback(err, 'Error signers updated data =')),
        shareReplay(1)
    );
