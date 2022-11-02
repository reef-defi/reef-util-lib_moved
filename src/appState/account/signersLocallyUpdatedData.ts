import {catchError, map, mergeScan, Observable, of, shareReplay, startWith, switchMap, withLatestFrom} from "rxjs";
import {ReefSigner} from "../../account/ReefAccount";
import {filter} from "rxjs/operators";
import {replaceUpdatedSigners, updateSignersEvmBindings} from "./accountStateUtil";
import {reloadSignersSubj} from "./setAccounts";
import {signersRegistered$} from "./signersFromJson";
import {TxStatusUpdate} from "../../utils";
import {UpdateAction} from "../model/updateStateModel";

export const signersLocallyUpdatedData$: Observable<ReefSigner[]> = reloadSignersSubj.pipe(
    filter((reloadCtx: any) => !!reloadCtx.updateActions.length),
    withLatestFrom(signersRegistered$),
    mergeScan(
        (
            state: {
                all: ReefSigner[];
                allUpdated: ReefSigner[];
                lastUpdated: ReefSigner[];
            },
            [updateCtx, signersInjected]: [any, ReefSigner[]],
        ): any => {
            const allSignersLatestUpdates = replaceUpdatedSigners(
                signersInjected,
                state.allUpdated,
            );
            return of(updateCtx.updateActions || [])
                .pipe(
                    switchMap((updateActions) => updateSignersEvmBindings(
                        updateActions,
                        allSignersLatestUpdates,
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
    startWith([]),
    catchError((err) => {
        console.log('signersLocallyUpdatedData$ ERROR=', err.message);
        return of([]);
    }),
    shareReplay(1),
);

export const onTxUpdateResetSigners = (
    txUpdateData: TxStatusUpdate,
    updateActions: UpdateAction[],
): void => {
    if (txUpdateData?.isInBlock || txUpdateData?.error) {
        const delay = txUpdateData.txTypeEvm ? 2000 : 0;
        setTimeout(() => reloadSignersSubj.next({ updateActions }), delay);
    }
};
