import {debounceTime, startWith, Subject} from "rxjs";

export const reloadTokens = () => {forceTokenValuesReloadSubj.next(true); console.log('force lib reload tokens')}
const forceTokenValuesReloadSubj = new Subject<boolean>();
export const forceReloadTokens$ = forceTokenValuesReloadSubj.pipe(
    // debounceTime(3000),
    startWith(true)
)
