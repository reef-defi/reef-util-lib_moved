import {toInjectedAccountsWithMeta} from '../src/appState/util/util'
import {availableNetworks, selectedSignerTokenBalances$} from "../src";
import {web3Enable, web3FromSource} from "@reef-defi/extension-dapp";
import {InjectedExtension} from "@reef-defi/extension-inject/types";
import {setCurrentAddress} from "../src/appState/account/setAccounts";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";
import {signersFromJson$} from "../src/appState/account/signersFromJson";
import {initReefState} from "../src/appState/initReefState";
import {selectedSignerTokenPrices$} from "../src/appState/token/tokenState";

async function initTest () {

    const extensions: InjectedExtension[] = await web3Enable('Test lib');
    const reefExt = await web3FromSource(REEF_EXTENSION_IDENT);
    const accounts = await reefExt.accounts.get();
    const accountsWMeta = toInjectedAccountsWithMeta(accounts, REEF_EXTENSION_IDENT);
    console.log("AA=",accountsWMeta[0].address);
    await initReefState({
        network: availableNetworks.testnet,
        jsonAccounts: {accounts: accountsWMeta, injectedSigner: reefExt.signer}
    });
    setCurrentAddress(accounts[1].address);

    signersFromJson$.subscribe((res)=>console.log('curr',res))

    selectedSignerTokenBalances$.subscribe((res)=>console.log('BALANCES',res))
    selectedSignerTokenPrices$.subscribe((res)=>console.log('PRICESSS',res))

}


window.addEventListener('load',initTest);
