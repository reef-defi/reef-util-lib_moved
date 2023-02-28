import {Observable, Subject} from "rxjs";
import {TransactionStatusEvent} from "../../transaction";

export const addTransactionStatusSubj = new Subject<TransactionStatusEvent>()
export const transactionStatus$: Observable<any[]> = addTransactionStatusSubj.pipe(

)