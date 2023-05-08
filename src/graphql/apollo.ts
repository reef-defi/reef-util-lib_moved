import {ApolloClient, ApolloLink, HttpLink, InMemoryCache, split,} from '@apollo/client';
import {
    combineLatestWith,
    distinctUntilChanged,
    map,
    merge,
    Observable,
    ReplaySubject, scan,
    shareReplay, startWith,
    Subject, tap,
} from 'rxjs';
import {getMainDefinition} from '@apollo/client/utilities';
import {Observable as ZenObservable} from 'zen-observable-ts';
import {GraphQLWsLink} from "@apollo/client/link/subscriptions";
import {createClient} from "graphql-ws";
import {onError} from "@apollo/client/link/error";
import {RetryLink} from "@apollo/client/link/retry";


const apolloUrlsSubj = new ReplaySubject<{ ws: string; http: string }>(1);
export const apolloClientSubj = new ReplaySubject<ApolloClient<any>>(1);
const apolloWsConnStateSubj = new Subject<{
    value: string, timestamp: number,
    err?: {
        clientErr?: { value: any, timestamp: number }, clientLinkErr?: { value: any, timestamp: number }
    }
}>();
const apolloWsConnErrSubj = new Subject<{
    clientErr?: { value: any, timestamp: number },
    clientLinkErr?: { value: any, timestamp: number }
}>();

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
        apolloWsConnErrSubj.next({clientLinkErr: {value: networkError, timestamp: (new Date()).getTime()}});
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
            keepAlive: 10000,
        });
        wsClient.on("error", (e) => {
            console.log('GQL WS ERROR', e);
            apolloWsConnErrSubj.next({clientErr: {value: e, timestamp: (new Date()).getTime()}});
        });
        wsClient.on("closed", (e) => {
            console.log('GQL WS CLOSED', e);
            apolloWsConnStateSubj.next({value: 'closed', timestamp: (new Date()).getTime()})
        });
        wsClient.on("connecting", () => {
            console.log('GQL WS CONNECTING');
            apolloWsConnStateSubj.next({value: 'connecting', timestamp: (new Date()).getTime()})
        });
        wsClient.on("opened", (e) => {
            console.log('GQL WS OPENED', e);
            apolloWsConnStateSubj.next({value: 'opened', timestamp: (new Date()).getTime()})
        });
        wsClient.on("connected", (e) => {
            console.log('GQL WS CONNECTED', e);
            apolloWsConnStateSubj.next({value: 'connected', timestamp: (new Date()).getTime()})
        });
        // wsClient.on("message", (e) => {
        //     console.log('GQL WS MSG', e.type);
        //     apolloWsConnStateSubj.next({value: 'message', timestamp: (new Date()).getTime()})
        // });
        const wsLink = new GraphQLWsLink(wsClient
        );

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

export const apolloClientWsConnState$ = apolloWsConnStateSubj.pipe(
    combineLatestWith(apolloWsConnErrSubj.asObservable().pipe(startWith({
        clientErr: undefined,
        clientLinkErr: undefined
    }))),
    scan((coll, [state, err]) => {
        const clientErr = err?.clientErr ? err.clientErr : {};
        const clientLinkErr = err?.clientLinkErr ? err.clientLinkErr : {};
        console.log('GQL states=', clientErr, clientLinkErr, state);
        return {
            ...state,
            err: {
                ...clientErr,
                ...clientLinkErr
            }
        };
    }, {}),
    startWith('starting gql ws state'),
    shareReplay(1)
);

export const zenToRx = <T>(zenObservable: ZenObservable<T>): Observable<T> => new Observable((observer) => zenObservable.subscribe((v) => observer.next(v), (err) => console.log('Apollo subscribe ERR=', err)));
