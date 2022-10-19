export enum FeedbackStatusCode {
    _,
    NOT_SET,
    LOADING,
    PARTIAL_DATA,
    RESOLVING_NFT_URL,
    RESOLVING_NFT_URL_ERROR,
    ERROR,
    COMPLETE_DATA,
}

export interface FeedbackStatus {
    code: FeedbackStatusCode;
    message?: string;
    propName?: string;
    oldData?: any;
}

export class FeedbackDataModel<T> {
    data: T;
    private _status: FeedbackStatus[];

    constructor(data: T, status: FeedbackStatus[]) {
        this.data = data;
        this._status = status;
    }

    getStatus(propName?: string): FeedbackStatus {
        const isStatArr = Array.isArray(this._status);
        const statusArr = this._status;
        if (!propName) {
            if (statusArr.length === 1) {
                return statusArr[0];
            }
            // all have same code
            let itemCode = statusArr[0].code;
            if (!statusArr.some(fs => fs.code !== itemCode)) {
                return {code: itemCode};
            }
        }

        const stat = statusArr.find(s => (!s.propName && !propName) || (s.propName === propName));
        return stat ? stat : {code: FeedbackStatusCode.NOT_SET};
    }

    hasStatus(status: FeedbackStatusCode, propName?: string): boolean {
        const stat = this.getStatus(propName);
        return stat?.code === status;
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

function createFeedBackStatus(statCode: FeedbackStatusCode | undefined, message?: string, propName?: string) {
    const code = statCode ? statCode as FeedbackStatusCode : FeedbackStatusCode.COMPLETE_DATA;
    return {code, message, propName};
}

function createStatusFromCode(statCode?: FeedbackStatusCode | FeedbackStatusCode[] | FeedbackStatus[], message?: string, propName?: string) {
    let status = [];
    if (!statCode) {
        return status;
    }
    if (Array.isArray(statCode) && statCode.length) {
        if ((statCode as FeedbackStatus[])[0]?.code == null) {
            statCode.forEach(sc => status.push(createFeedBackStatus(sc as FeedbackStatusCode)));
        }else {
            return statCode;
        }
    } else if ((statCode as FeedbackStatus)?.code == null) {
        status.push(createFeedBackStatus(statCode as FeedbackStatusCode, message, propName));
    }

    return status;
}

export const toFeedbackDM = <T>(data: T, statCode?: FeedbackStatusCode | FeedbackStatusCode[] | FeedbackStatus[], message?: string, propName?: string): FeedbackDataModel<T> => {
    return new FeedbackDataModel<T>(data, createStatusFromCode(statCode, message, propName));
};

export const isFeedbackDM = (value: any): boolean => {
    return value?.data && value.getStatus() != null && value.getStatus().code != null;
}

export const collectFeedbackDMStatus = (items: FeedbackDataModel<any>[]): FeedbackStatusCode[] => {
    return items.reduce((state: FeedbackStatusCode[], curr) => {
        curr.getStatusList().forEach((stat) => {
            if (state.indexOf(stat.code) < 0) {
                state.push(stat.code);
            }
        });
        return state;
    }, [])
}

// export const unwrapFeedbackDM = (value: FeedbackDataModel<T>): T => value.data;

// export const getStatus = (status: FeedbackStatus | FeedbackStatus[], propName?: string): FeedbackStatus | undefined => {
//     if (Array.isArray(status)) {
//         return status.find(s => s.propName === propName);
//     }
//     if (propName) {
//         return undefined;
//     }
//     return status;
// }
