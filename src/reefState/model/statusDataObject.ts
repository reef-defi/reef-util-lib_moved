import {Observable, skipWhile} from "rxjs";

export enum FeedbackStatusCode {
    // not using 0
    _,
    LOADING,
    PARTIAL_DATA_LOADING,
    // from here on data won't load anymore
    MISSING_INPUT_VALUES,
    NOT_SET,
    ERROR,
    //
    COMPLETE_DATA,

}

export interface FeedbackStatus {
    code: FeedbackStatusCode;
    message?: string;
    propName?: string;
    oldData?: any;
}

export class StatusDataObject<T> {
    data: T;
    private _status: FeedbackStatus[];

    constructor(data: T, status: FeedbackStatus[]) {
        this.data = data;
        this._status = status;
    }

    getStatus(propName?: string): FeedbackStatus[] {
        const statusArr = this._status;
        if (!propName) {
            /*if (statusArr.length === 1) {
                return statusArr[0];
            }
            // all have same code
            let itemCode = statusArr[0].code;
            if (!statusArr.some(fs => fs.code !== itemCode)) {
                return {code: itemCode};
            }*/
            return statusArr;
        }

        return statusArr.filter(s => (s.propName === propName));
    }

    hasStatus(status: FeedbackStatusCode | FeedbackStatusCode[], propName?: string): boolean {
        const checkStatArr = Array.isArray(status) ? status : [status];
        return checkStatArr.some((stat) => {
            const stats = this.getStatus(propName);
            return stats.find(s => s?.code === stat);
        });
    }

    setStatus(statArr: FeedbackStatus[]) {
        this._status = statArr;
    }

    getStatusList(): FeedbackStatus[] {
        return this._status;
    }

    toJson() {
        return JSON.stringify({data: this.data, status: this._status});
    }
}

function createFeedBackStatus(statCode: FeedbackStatusCode | undefined, message?: string, propName?: string): FeedbackStatus {
    const code = statCode ? statCode as FeedbackStatusCode : FeedbackStatusCode.COMPLETE_DATA;
    return {code, message, propName};
}

// TODO test with different params
function createStatusFromCode(statCode?: FeedbackStatusCode | FeedbackStatusCode[] | FeedbackStatus[], message?: string, propName?: string): FeedbackStatus[] {
    let status: FeedbackStatus[] = [];
    if (!statCode) {
        return status;
    }
    if (Array.isArray(statCode) && statCode.length) {
        if ((statCode as FeedbackStatus[])[0]?.code == null) {
            statCode.forEach(sc => status.push(createFeedBackStatus(sc as FeedbackStatusCode)));
        } else {
            return statCode as FeedbackStatus[];
        }
    } else if ((statCode as any)?.code == null) {
        status.push(createFeedBackStatus(statCode as FeedbackStatusCode, message, propName));
    }

    return status;
}

export const toFeedbackDM = <T>(data: T, statCode?: FeedbackStatusCode | FeedbackStatusCode[] | FeedbackStatus[], message?: string, propName?: string): StatusDataObject<T> => {
    return new StatusDataObject<T>(data, createStatusFromCode(statCode, message, propName));
};

export const isFeedbackDM = (value: StatusDataObject<any> | any): boolean => {
    return (value instanceof StatusDataObject);
    // return value?.data && value.getStatus() != null && value.getStatus().code != null;
}

export const collectFeedbackDMStatus = (items: StatusDataObject<any>[]): FeedbackStatusCode[] => {
    return items.reduce((state: FeedbackStatusCode[], curr) => {
        curr.getStatusList().forEach((stat) => {
            if (state.indexOf(stat.code) < 0) {
                state.push(stat.code);
            }
        });
        return state;
    }, [])
}

export const findMinStatusCode = (feedbackDMs: (StatusDataObject<any> | undefined)[]): FeedbackStatusCode => {
    const statListArr = feedbackDMs.reduce((stListArr: (FeedbackStatus | undefined)[], sdo: StatusDataObject<any> | undefined) => {
        const sdoStats = sdo ? sdo.getStatusList() : [undefined];
        return stListArr.concat(sdoStats);
    }, []);

    const statCodes = statListArr.map(st => st?.code);
    const minStat = statCodes.reduce((s: FeedbackStatusCode, v: FeedbackStatusCode | undefined) => {
        if (v == null) {
            v = FeedbackStatusCode.NOT_SET;
        }
        return v < s ? v : s;
    }, FeedbackStatusCode.COMPLETE_DATA);
    return minStat as FeedbackStatusCode;
}

export function skipBeforeStatus$ <T>(observable: Observable<StatusDataObject<T>>, status: FeedbackStatusCode):Observable<StatusDataObject<T>> {
    return observable.pipe(skipWhile(t => !t.hasStatus(status)));
}
