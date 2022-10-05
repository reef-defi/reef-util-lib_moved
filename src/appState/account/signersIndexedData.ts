import {gql} from "@apollo/client";
import {catchError, combineLatest, map, of, scan, shareReplay, startWith, switchMap} from "rxjs";
import {apolloClientInstance$, zenToRx} from "../../graphql";
import {filter} from "rxjs/operators";
import {signersWithUpdatedChainDataBalances$} from "./signersWithUpdatedChainDataBalances";
import {ReefSigner} from "../../account/ReefAccount";
import {signersLocallyUpdatedData$} from "./signersLocallyUpdatedData";
import {signersRegistered$} from "./signersFromJson";

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

const indexedAccountValues$ = combineLatest([
    apolloClientInstance$,
    signersRegistered$,
])
    .pipe(
        switchMap(([apollo, signers]) => (!signers
            ? []
            : zenToRx(
                apollo.subscribe({
                    query: EVM_ADDRESS_UPDATE_GQL,
                    variables: {accountIds: signers.map((s: any) => s.address)},
                    fetchPolicy: 'network-only',
                }),
            ))),
        map((result: any): AccountEvmAddrData[] => result.data.account),
        filter((v) => !!v),
        startWith([]),
    );

export const signersWithUpdatedIndexedData$ = combineLatest([
    signersWithUpdatedChainDataBalances$,
    signersLocallyUpdatedData$,
    indexedAccountValues$,
])
    .pipe(
        scan(
            (
                state: {
                    lastlocallyUpdated: ReefSigner[];
                    lastIndexed: AccountEvmAddrData[];
                    lastSigners: ReefSigner[];
                    signers: ReefSigner[];
                },
                [signers, locallyUpdated, indexed],
            ) => {
                let updateBindValues: AccountEvmAddrData[] = [];
                if (state.lastlocallyUpdated !== locallyUpdated) {
                    updateBindValues = locallyUpdated.map((updSigner) => ({
                        address: updSigner.address,
                        isEvmClaimed: updSigner.isEvmClaimed,
                    }));
                } else if (state.lastIndexed !== indexed) {
                    updateBindValues = indexed.map((updSigner: AccountEvmAddrData) => ({
                        address: updSigner.address,
                        isEvmClaimed: !!updSigner.evm_address,
                    }));
                } else {
                    updateBindValues = state.lastSigners.map((updSigner) => ({
                        address: updSigner.address,
                        isEvmClaimed: updSigner.isEvmClaimed,
                    }));
                }
                updateBindValues.forEach((updVal: AccountEvmAddrData) => {
                    const signer = signers.find((sig) => sig.address === updVal.address);
                    if (signer) {
                        signer.isEvmClaimed = !!updVal.isEvmClaimed;
                    }
                });
                return {
                    signers,
                    lastlocallyUpdated: locallyUpdated,
                    lastIndexed: indexed,
                    lastSigners: signers,
                };
            },
            {
                signers: [],
                lastlocallyUpdated: [],
                lastIndexed: [],
                lastSigners: [],
            },
        ),
        map(({signers}) => signers),
        shareReplay(1),
        catchError((err) => {
            console.log('signersWithUpdatedData$ ERROR=', err.message);
            return of(null);
        }),
    );
