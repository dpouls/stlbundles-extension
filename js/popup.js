const downloadLink = $('#download-link');
const includeAvatar = $('#include_avatar');
const includeDescription = $('#include_description');
let files = [];
let postData = {}

includeAvatar.change(updateDownloadCount);
includeDescription.change(updateDownloadCount);

const port = chrome.extension.connect({
  name: 'Patreon Downloader',
});
port.postMessage({type: 'whoAmI'});
port.onMessage.addListener(function (msg) {
  if (typeof msg !== 'object' || !msg?.type) {
    return;
  }

  switch (msg.type) {
    case 'complete':
      downloadLink.text('Completed.');
      break;
    case 'downloadUpdate':
      if (typeof msg.count === 'number' && typeof msg.total === 'number' && msg.total) {
        downloadLink.prop('disabled', true);
        downloadLink.text(`Downloading ${msg.count}/${msg.total} items...`);
      }
      break;
  }
});

function isPatreonPostSite() {
  return chrome.tabs.query(
    {active: true, lastFocusedWindow: true},
    (tabs) => {
      const tabId = tabs[0]?.id.toString();
      if (!tabId) {
        return;
      }
      const url = tabs[0].url;
      if (url && url.indexOf('https://www.patreon.com/posts/') > -1) {
        $('#not-patreon-site').hide();
        $('#patreon-site').show();
      } else {
        $('#not-patreon-site').show();
        $('#patreon-site').hide();
      }
      parsePatreonData(tabId);
      console.log(postData)
      
    },
    );
  }
  $("loading").hide()
isPatreonPostSite()
function updateDownloadCount() {
  let count = files.length;
  if (includeAvatar.is(':checked')) {
    count += 1;
  }
  if (includeDescription.is(':checked')) {
    count += 1;
  }
  if (count) {
    downloadLink.prop('disabled', false);
    downloadLink.text(`Download ${count} ${count === 1 ? 'file' : 'files'}`);
  }
}

function parsePatreonData(tabId) {
  chrome.storage.local.get(tabId, function (contentData) {
    if (!contentData || !contentData[tabId]) {
      console.error('Patreon Downloader | No post data found.');
      return;
    }
    window.setInterval(function () {
      port.postMessage({type: 'status'});
    }, 2500);

    contentData = contentData[tabId];
    console.log('STLBundle Preview maker | Raw post data', contentData);
    if (!contentData?.post?.data) {
      console.error('Patreon Downloader | Invalid post data found.');
      return;
    }
    postData = contentData.post
    let name = contentData.name
    console.log('name', name)
    $("#creator-name").val(name)
    return contentData.post

    let text = contentData.post.data.attributes.title;

    const campaignData = contentData.post.included.filter(o => o.type === 'campaign').map(o => {
      return o.attributes;
    });
    let postUser = {};
    if (campaignData.length) {
      postUser.name = campaignData[0].name;
      postUser.url = campaignData[0].url;
      postUser.avatarUrl = campaignData[0].avatar_photo_url;
      if (postUser.name) {
        text = `${postUser.name}-${text}`;
      }
    }
    $('#folder-name').prop('value', slugify(text));

    files = contentData.post.included.filter(o => o.type === 'media' || o.type === 'attachment').map(o => {
        let out = {
          filename: null,
          url: null,
        };
        switch (o.type) {
          case 'media':
            out.filename = o.attributes.file_name;
            out.url = o.attributes.download_url;
            break;
          case 'attachment':
            out.filename = o.attributes.name;
            out.url = o.attributes.url;
            break;
        }
        return out;
      },
    );
    if (contentData.post.data.attributes?.post_type === 'video_external_file' && contentData.post.data.attributes?.post_file?.url) {
      let filename = new URL(contentData.post.data.attributes.post_file.url).pathname.split('/').pop() || 'video';
      files.push({
        filename,
        url: contentData.post.data.attributes.post_file.url,
      });
    }

    updateDownloadCount();

    files.sort((a, b) => {
      return a.filename.localeCompare(b.filename);
    });
    console.log('Patreon Downloader | Files', files);
    // Check for existing downloads.
    port.postMessage({type: 'status'});

    $('#download').submit(e => {
      e.preventDefault();

      const prefix = $('#folder-name').val();

      if (!files.length) {
        console.info('Patreon Downloader | No files to download.');
        return;
      }

      downloadLink.prop('disabled', true);

      const requests = [];

      if (includeDescription.prop('checked')) {
        let content = [
          `<h1>${contentData.post.data.attributes.title}</h1>`,
        ];
        if (postUser.name && postUser.url) {
          content.push(
            `<p>by <a href="${postUser.url}">${postUser.name}</a></p>`,
          );
        }
        content.push(
          contentData.post.data.attributes.content,
          `<p><a href="${contentData.post.data.attributes.url}">${contentData.post.data.attributes.url}</a>`,
        );
        let blob = new Blob(content, {type: 'text/html'});
        let url = URL.createObjectURL(blob);
        let filename = 'description.html';
        if (prefix) {
          filename = `${prefix}/${filename}`;
        }
        requests.push({url: url, filename: filename});
      }

      if (postUser.avatarUrl && includeAvatar.prop('checked')) {
        let filename = new URL(postUser.avatarUrl).pathname.split('/').pop();
        let extension = filename.split('.').pop();
        if (!extension) {
          extension = 'png';
        }
        let file = `avatar.${extension}`
        if (prefix) {
          file = `${prefix}/${file}`;
        }
        requests.push({
          filename: file,
          url: postUser.avatarUrl,
        });
      }

      for (let i = 0; i < files.length; i++) {
        let filename = files[i].filename;
        if (filename.startsWith('http')) {
          try {
            // Handle full urls as the filename, pull the final segment out
            const url = new URL(filename);
            filename = url.pathname.split(/[\\/]/).pop();
          } catch (e) {
            // Try parsing the url as the filename
            try {
              const url = new URL(files[i].url);
              filename = url.pathname.split(/[\\/]/).pop();
            } catch (e) {
              // Carry on with the standard filename
            }
          }
        }
        const req = {
          filename: filename,
          url: files[i].url,
        };
        if (prefix) {
          req.filename = `${prefix}/${req.filename}`;
        }
        requests.push(req);
      }

      port.postMessage({type: 'download', requests: requests});
    });
  });
}

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .normalize('NFD')         // separate accent from letter
    .replace(/[\u0300-\u036f]/g, '') // remove all separated accents
    .replace(/\s+/g, '-')            // replace spaces with -
    .replace(/&/g, '-and-')          // replace & with 'and'
    .replace(/[^\w\-]+/g, '')        // remove all non-word chars
    .replace(/\-\-+/g, '-')          // replace multiple '-' with single '-'
    .replace(/^-+/, '')              // Trim - from start of text
    .replace(/-+$/, '');             // Trim - from end of text
}
const sendPostData = async () => {
  console.log('Sending post')
  $("#loading").show()
 //todo make month dynamic
  let reqBody = {post: postData, creatorName: $("#creator-name").val(), month: 6}
  console.log('reqbody',reqBody)
  let url = 'http://localhost:6543/scraper/patreon/post/data'
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(reqBody) // body data type must match "Content-Type" header
  });
  console.log('response',response.json)
  $("#loading").hide()
  return response.json(); // parses JSON response into native JavaScript objects
}
$('#download').submit(e => {
  e.preventDefault()
console.log('submit pressed')
 sendPostData()
})
(function () {
  try {

    isPatreonPostSite();
  } catch (e) {
    console.error('Patreon Downloader |', e);
  }
})();
