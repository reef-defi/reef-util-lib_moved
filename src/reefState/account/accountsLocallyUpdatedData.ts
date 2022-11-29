import {catchError, map, mergeScan, Observable, of, shareReplay, startWith, switchMap, withLatestFrom} from "rxjs";
import {ReefAccount} from "../../account/accountModel";
import {filter} from "rxjs/operators";
import {replaceUpdatedSigners, updateSignersEvmBindings} from "./accountStateUtil";
import {updateSignersSubj} from "./setAccounts";
import {availableAddresses$} from "./availableAddresses";
import {selectedProvider$} from "../providerState";
import {Provider} from "@reef-defi/evm-provider";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "../model/feedbackDataModel";

export const accountsLocallyUpdatedData$: Observable<FeedbackDataModel<FeedbackDataModel<ReefAccount>[]>> = updateSignersSubj.pipe(
    filter((reloadCtx: any) => !!reloadCtx.updateActions.length),
    withLatestFrom(availableAddresses$, selectedProvider$),
    mergeScan(
        (
            state: {
                all: FeedbackDataModel<ReefAccount>[];
                allUpdated: FeedbackDataModel<ReefAccount>[];
                lastUpdated: FeedbackDataModel<ReefAccount>[];
            },
            [updateCtx, signersInjected, provider]: [any, ReefAccount[], Provider],
        ): any => {
            const allSignersLatestUpdates = replaceUpdatedSigners(
                signersInjected.map(s=>toFeedbackDM(s, FeedbackStatusCode.COMPLETE_DATA)),
                state.allUpdated,
            );
            return of(updateCtx.updateActions || [])
                .pipe(
                    switchMap((updateActions) => updateSignersEvmBindings(
                        updateActions,
                        provider,
                        allSignersLatestUpdates
                    )
                        .then((lastUpdated) => ({
                            all: replaceUpdatedSigners(
                                allSignersLatestUpdates,
                                lastUpdated,
                                true,
                            ),
                            allUpdated: replaceUpdatedSigners(
                                state.allUpdated,
                                lastUpdated,
                                true,
                            ),
                            lastUpdated,
                        }))),
                );
        },
        {
            all: [],
            allUpdated: [],
            lastUpdated: [],
        },
    ),
    filter((val: any) => !!val.lastUpdated.length),
    map((val: any): any => val.all),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    startWith(toFeedbackDM([], FeedbackStatusCode.LOADING)),
    shareReplay(1)
);

/*export const onTxUpdateResetSigners = (
    txUpdateData: TxStatusUpdate,
    updateActions: UpdateAction[],
): void => {
    if (txUpdateData?.isInBlock || txUpdateData?.error) {
        const delay = txUpdateData.txTypeEvm ? 2000 : 0;
        setTimeout(() => reloadSignersSubj.next({ updateActions }), delay);
    }
};*/
