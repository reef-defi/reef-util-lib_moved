import {web3Enable, web3FromSource} from "@reef-defi/extension-dapp";
import {InjectedExtension} from "@reef-defi/extension-inject/types";
import {setCurrentAddress} from "../src/reefState/account/setAccounts";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";
import {availableAddresses$} from "../src/reefState/account/availableAddresses";
import {initReefState} from "../src/reefState/initReefState";
import {
    currentNFTs$,
    currentTokenBalances$,
    currentTokenPrices$
} from "../src/reefState/tokenState.rx";
import {firstValueFrom, race, skipWhile, tap} from "rxjs";
import {FeedbackDataModel, FeedbackStatusCode} from "../src/reefState/model/feedbackDataModel";
import {fetchPools$} from "../src/pools/pools";
import {REEF_ADDRESS} from "../src/token/tokenModel";
import {currentAccountAddressChange$} from "../src/reefState/account/currentAccountAddressChange";
import {currentProvider$} from "../src/reefState/providerState";
import {accountsWithUpdatedIndexedData$} from "../src/reefState/account/accountsIndexedData";
import {currentAccount$} from "../src/reefState";
import {AVAILABLE_NETWORKS} from "../src/network";

const TEST_ACCOUNTS = [{"address": "5GKKbUJx6DQ4rbTWavaNttanWAw86KrQeojgMNovy8m2QoXn", "name":"acc1", "meta": {"source": "reef"}},
    {"address": "5G9f52Dx7bPPYqekh1beQsuvJkhePctWcZvPDDuhWSpDrojN", "name":"acc2", "meta": {"source": "reef"}}
];

async function testNfts() {
    await changeCurrentAddress();
    let nfts = await firstValueFrom(currentNFTs$);
    console.assert(nfts.hasStatus(FeedbackStatusCode.LOADING), 'Nfts not cleared when changing signer stat=' + nfts.getStatus().map(v=>v.code))
    console.log("resolve nft urls");
    nfts = await firstValueFrom(currentNFTs$.pipe(skipWhile((nfts)=>nfts.hasStatus(FeedbackStatusCode.LOADING))));
    console.assert(nfts.hasStatus(FeedbackStatusCode.PARTIAL_DATA_LOADING), 'Nft data should not be complete yet.')

    nfts = await firstValueFrom(currentNFTs$.pipe(
        // tap(v => console.log('Waiting for nft complete data')),
        skipWhile((nfts: FeedbackDataModel<any>) => {
            return !(nfts.hasStatus(FeedbackStatusCode.COMPLETE_DATA) && nfts.getStatusList().length===1)
        }))
    );

    console.assert(!nfts.data.find(nft => !nft.hasStatus(FeedbackStatusCode.COMPLETE_DATA)), 'Nft data not complete')
    console.log(`END test nfts=`, nfts);
}

async function changeCurrentAddress(): Promise<string> {
    const allSig = await firstValueFrom(availableAddresses$);
    console.assert(allSig.length>1, 'Need more than 1 signer.')
    const currSig = await firstValueFrom(currentAccountAddressChange$);
    const newSig = allSig.find(sig => sig.address !== currSig.data.address);
    setCurrentAddress(newSig?.address);
    return newSig?.address!;
}

async function testAppStateTokens() {
    const currSig = await firstValueFrom(currentAccountAddressChange$);
    const address = await changeCurrentAddress();
    console.assert(currSig.data.address !== address, 'Address passed in should be different');
    let tknsLoading = await firstValueFrom(currentTokenBalances$);
    console.assert(tknsLoading && tknsLoading.data?.length === 0, 'Tokens balances loading');
    console.assert(tknsLoading.hasStatus(FeedbackStatusCode.LOADING), 'Tokens not cleared when changing signer')
    let tknsBalsCompl = await firstValueFrom(currentTokenBalances$.pipe(skipWhile(v => !v.hasStatus(FeedbackStatusCode.COMPLETE_DATA))));
    let completePrices$ = currentTokenPrices$.pipe(skipWhile(tkns => !tkns.hasStatus(FeedbackStatusCode.COMPLETE_DATA)));
    const tknPricesCompl = await firstValueFrom(completePrices$);
    console.log(`token bal=`, tknsBalsCompl);
    console.assert(tknsBalsCompl.data.length, 'Tokens should load');
    console.assert(tknPricesCompl.data.length, 'Tokens should load');
    console.assert(tknsBalsCompl.hasStatus(FeedbackStatusCode.COMPLETE_DATA), 'State should be complete');
    console.assert(tknPricesCompl.hasStatus(FeedbackStatusCode.COMPLETE_DATA), 'State should be complete');
    console.assert(tknsBalsCompl.data?.length === tknPricesCompl.data.length, 'Token prices and balances not same length');


    tknsBalsCompl.data.forEach((tkn) => {
        let sameAddressesLen = tknsBalsCompl.data?.filter(t => t.data.address === tkn.data.address).length;
        console.assert(sameAddressesLen === 1, `${sameAddressesLen} duplicates = ${tkn.data.address}`);
    });

    console.log("END testAppStateTokens");

}

async function testAvailablePools(tokens, signer, factoryAddr) {
    // const availablePools = await firstValueFrom(availableReefPools$);
    fetchPools$(tokens, signer?.signer, factoryAddr).subscribe(value => {
        console.log("fetchPools$=", value);
    });

    console.log("END testAvailablePools");
}

async function testAppStateSigners(accounts: any) {

    const sigJson = await firstValueFrom(availableAddresses$);
    console.assert(sigJson.length === 2, 'Number of signers');
    console.assert(accounts[0].address === sigJson[0].address, 'Accounts not the same');
    console.log("END testAppStateSigners");
}

async function testAppStateSelectedSigner(address1: string, address2: string) {

    setCurrentAddress(address1);
    const selSig = await firstValueFrom(currentAccount$);
    console.assert(selSig?.data.address === address1, 'Selected signer not the same as current address.');

    console.assert(address1 !== address2, 'Address not different');
    setCurrentAddress(address2);
    const selSig1 = await firstValueFrom(currentAccount$);
    const selSigAddrCh = await firstValueFrom(currentAccountAddressChange$);
    console.assert(selSig1?.data.address === address2, 'Selected signer 2 not the same as current address.');
    console.assert(selSigAddrCh?.data.address === address2, 'Selected signer addr ch. 2 not the same as current address.');
    console.log("END testAppStateSelectedSigner");

}

async function testBalancesProgressStatus() {
    await changeCurrentAddress();
    console.log("waiting for tokens to load");
    const tokens = await firstValueFrom(currentTokenBalances$.pipe(skipWhile(t => t.hasStatus(FeedbackStatusCode.LOADING))));
    console.log("token balances=", tokens);

    console.assert(tokens.data?.length > 1, 'There should be at least 2 tokens');
    console.assert(tokens.data.some(t => !t.hasStatus(FeedbackStatusCode.COMPLETE_DATA)), 'Not all tokens should have complete data');
    console.assert(tokens.data!.find(t => t.hasStatus(FeedbackStatusCode.COMPLETE_DATA))?.data.address === REEF_ADDRESS, 'Reef should be complete at first');

    console.log("waiting for tokens to complete");
    const tokensCompl = await firstValueFrom(currentTokenBalances$.pipe(skipWhile(t => !t.hasStatus(FeedbackStatusCode.COMPLETE_DATA))));
    console.assert(tokensCompl.hasStatus(FeedbackStatusCode.COMPLETE_DATA),'Tokens not complete');
    console.log("END testTokenBalances=", tokensCompl);
}

async function testProvider() {
    const provider = await firstValueFrom(currentProvider$);
    console.log("provider set=", await provider.api.isReadyOrError);
}

async function testInitSelectedAddress() {
    const allSig = await firstValueFrom(availableAddresses$);
    const selSig = await firstValueFrom(currentAccount$);
    console.assert(allSig.length && selSig?.data.address && allSig[0].address===selSig.data.address, 'TODO First signer should be selected by default');
    // TODO set signer when initializing and remove
    if (!selSig) {
        setCurrentAddress(allSig[0].address);
    }
}

async function testSigners() {
    const sig = await firstValueFrom(race(currentProvider$,availableAddresses$));
    console.log("available addr=",sig);
    const indexedSigners = await firstValueFrom(accountsWithUpdatedIndexedData$);
    console.log("sigFromJson=",indexedSigners);
    accountsWithUpdatedIndexedData$.subscribe(v=>console.log('RESSSS',v))
    const sigCompl = await firstValueFrom(accountsWithUpdatedIndexedData$.pipe(
        // tap(v=>console.log('SSSSS', v.getStatusList())),
        skipWhile(t => !t.hasStatus(FeedbackStatusCode.COMPLETE_DATA))));
    console.log("sig complete=",sigCompl);

}

async function initTest() {
    const extensions: InjectedExtension[] = await web3Enable('Test lib');
    const reefExt = await web3FromSource(REEF_EXTENSION_IDENT);
    const accounts = TEST_ACCOUNTS;
    // const accounts = await reefExt.accounts.get();
    // const accountsWMeta = toInjectedAccountsWithMeta(accounts, REEF_EXTENSION_IDENT);
    await initReefState({
        network: AVAILABLE_NETWORKS.testnet,
        jsonAccounts: {accounts: TEST_ACCOUNTS, injectedSigner: reefExt.signer}
    });
    console.log("START ALL");
    await testSigners();
    await testProvider();
    await testInitSelectedAddress();
    setCurrentAddress(TEST_ACCOUNTS[0].address);
    await testBalancesProgressStatus();
    await testAppStateSigners(accounts);
    await testAppStateSelectedSigner(accounts[0].address, accounts[1].address);
    await testAppStateTokens();
    await testAppStateTokens();
    await testNfts();
    await testNfts();

    console.log("END ALL");
    // await testAvailablePools(tokens, signer, dexConfig.testnet.factoryAddress);

}

window.addEventListener('load', initTest);
