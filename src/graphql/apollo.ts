import {ApolloClient, ApolloLink, HttpLink, InMemoryCache, split,} from '@apollo/client';
import {distinctUntilChanged, map, merge, Observable, ReplaySubject, shareReplay, Subject,} from 'rxjs';
import {getMainDefinition} from '@apollo/client/utilities';
import {Observable as ZenObservable} from 'zen-observable-ts';
import {GraphQLWsLink} from "@apollo/client/link/subscriptions";
import {createClient} from "graphql-ws";
import {onError} from "@apollo/client/link/error";
import {RetryLink} from "@apollo/client/link/retry";
import {getCollectedWsStateValue$, WsConnectionState} from "../reefState/ws-connection-state";


const apolloUrlsSubj = new ReplaySubject<{ ws: string; http: string }>(1);
export const apolloClientSubj = new ReplaySubject<ApolloClient<any>>(1);
const apolloWsConnStateSubj = new Subject<WsConnectionState>();
export const apolloClientWsConnState$ = getCollectedWsStateValue$(apolloWsConnStateSubj);


export const setApolloUrls = (urls: { ws: string; http: string }): void => {
    apolloUrlsSubj.next(urls);
};
const errorLink = onError(({graphQLErrors, networkError, operation, forward}) => {
    if (graphQLErrors)
        graphQLErrors.forEach(({message, locations, path}) =>
            console.log(
                `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
            )
        );
    if (networkError) {
        console.log(`[ApolloGQL Network error]: ${networkError}`);
        // apolloWsConnErrSubj.next({clientLinkErr: {value: networkError, timestamp: (new Date()).getTime()}});
    }
});

const retryLink = new RetryLink();

const splitLink$ = apolloUrlsSubj.pipe(
    map((urls: { ws: string; http: string }) => {
        const httpLink = new HttpLink({
            uri: urls.http,
        });
        let wsClient = createClient({
            url: urls.ws,
        });
        wsClient.on("error", (e) => {
            console.log('GQL WS ERROR', e);
            apolloWsConnStateSubj.next({
                isConnected: false,
                status: {value: 'error', timestamp: (new Date()).getTime(), data: e}
            });
        });
        wsClient.on("closed", (e) => {
            console.log('GQL WS CLOSED', e);
            apolloWsConnStateSubj.next({
                isConnected: false,
                status: {value: 'disconnected', timestamp: (new Date()).getTime(), data: e}
            });
        });
        wsClient.on("connecting", () => {
            console.log('GQL WS CONNECTING');
            apolloWsConnStateSubj.next({
                isConnected: false,
                status: {value: 'connecting', timestamp: (new Date()).getTime(), data: undefined}
            });
        });
        wsClient.on("opened", (e) => {
            console.log('GQL WS OPENED', e);
            apolloWsConnStateSubj.next({
                isConnected: true,
                status: {value: 'connected', timestamp: (new Date()).getTime(), data: e}
            });
        });
        wsClient.on("connected", (e) => {
            console.log('GQL WS CONNECTED', e);
            apolloWsConnStateSubj.next({
                isConnected: true,
                status: {value: 'connected', timestamp: (new Date()).getTime(), data: e}
            });
        });
        // wsClient.on("message", (e) => {
        //     console.log('GQL WS MSG', e.type);
        //     apolloWsConnStateSubj.next({value: 'message', timestamp: (new Date()).getTime()})
        // });

        const wsLink = new GraphQLWsLink(wsClient);

        return split(
            ({query}) => {
                const definition = getMainDefinition(query);

                return (
                    definition.kind === 'OperationDefinition'
                    && definition.operation === 'subscription'
                );
            },
            wsLink,
            httpLink
        );
    }),
    shareReplay(1),
);
const apolloLinksClientInstance$: Observable<ApolloClient<any>> = splitLink$.pipe(
    map(
        (splitLink) => new ApolloClient({
            cache: new InMemoryCache(),
            link: ApolloLink.from([retryLink, errorLink, splitLink]),
        }),
    ),
    shareReplay(1),
);
export const apolloClientInstance$: Observable<ApolloClient<any>> = merge(apolloLinksClientInstance$, apolloClientSubj).pipe(
    distinctUntilChanged(),
    shareReplay(1),
);

export const zenToRx = <T>(zenObservable: ZenObservable<T>): Observable<T> => new Observable((observer) => zenObservable.subscribe((v) => observer.next(v), (err) => console.log('Apollo subscribe ERR=', err)));
