
try {
  chrome.runtime.sendMessage({type: 'whoAmI'}, tabId => {
    try {
      const payload = '{'.concat(document.documentElement.innerHTML.split('Object.assign(window.patreon.bootstrap, {')[1].split('\n});\n      Object.assign(window.patreon')[0], '}');
      let name = $('#renderPageContentWrapper > div.sc-dkPtRN.cfFmxI > div > div > div.sc-dkPtRN.gPXHyW > div.sc-hGPBjI.kaKmIp > div > div:nth-child(1) > a > div > div > div > div.sc-1hcc7xl-0.eWKrry > div.sc-dkPtRN.bQSLgS > div').text()
      console.log('name', name)
      const data = {name};
      data[tabId.tab.toString()] = JSON.parse(payload);
      chrome.storage.local.set(data, function () {
        if (chrome.runtime.lastError) {
          console.error('STLBundles Preview Downloader | Failed to set data for tab.', tabId.tab, data, chrome.runtime.lastError.message);
        } else {
          console.log('Patreon Downloader | Set page data.', tabId.tab, data);
        }
      });
    } catch (e) {
      console.error('Patreon Downloader |', e);
    }
  });
} catch (e) {
  console.error('Patreon Downloader |', e);
}