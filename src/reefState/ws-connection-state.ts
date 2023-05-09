import {scan, shareReplay, startWith, Subject} from "rxjs";

type ConnState = "error" | "connecting" | "connected" | "disconnected";

export interface WsConnectionState {
    isConnected: boolean;
    status: { value: ConnState, timestamp: number, data?: any };
    lastErr?: { value: ConnState, timestamp: number, data?: any };
}

export function getCollectedWsStateValue$(fromSubj: Subject<WsConnectionState>) {
    return fromSubj.pipe(
        scan((state: WsConnectionState, curr: WsConnectionState): WsConnectionState => {
            if (curr.status.value === "error") {
                return {isConnected: curr.isConnected, status: curr.status, lastErr: curr.status}
            }
            return {isConnected: curr.isConnected, status: curr.status, lastErr: state.lastErr};
        }, {isConnected: false, status: {value: 'disconnected', timestamp: (new Date()).getTime()}}),
        startWith({
            isConnected: false,
            status: {value: 'disconnected', timestamp: (new Date()).getTime()}
        } as WsConnectionState),
        shareReplay(1)
    );
}
