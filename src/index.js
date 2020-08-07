// TODO - set up automatic image resizing?
// import browserImageSize from 'browser-image-size' // TODO - set this up
import * as FilePond from 'filepond';
import FilePondPluginImageExifOrientation from 'filepond-plugin-image-exif-orientation';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import { ethers } from "ethers";

const main = async () => {
  const getEthAddress = () => {
    if (typeof web3 === 'undefined') {
      return
    }
    oya.provider = new ethers.providers.Web3Provider(web3.currentProvider);
    return oya.provider.provider.selectedAddress
  };

  /**
   * getBuckets will create a new Buckets client with the UserAuth
   */
  const getBuckets = async () => {
    // TODO - pull this from somewhere else - this is the regular hub key
    const buckets = await textile.Buckets.withKeyInfo({key:'brqbnrvpihcdrdjh2japbkgd6mm'})

    // When hub.next is working, use the API endpoint below w/ the hub.next key below
    // const buckets = await textile.Buckets.withKeyInfo({key:'brnyrzoniaaxmk27bgqe5synqq4'}, 'https://grpcweb.hub.next.textile.io')
    // Authorize the user and your insecure keys with getToken
    const identity = await threads.Libp2pCryptoIdentity.fromString('bbaareyccr6d67bras2r423xi3dkv4zj7ojijhxql7k3ljsxprrfiwcigs5xjbfwytt7vipbkiycztkl2shjs2xcbzy4jxyhdfciioq532b3ai3uqs3mjz72uhqvembmzvf5jduznlra44oe34drsreehio55a5qe')
    await buckets.getToken(identity)

    return buckets
  }

  const upLoadMetaData = async (productDetails) => {
    const details = {
      author: oya.eth_address,
      date: (new Date()).getTime(),
      paths: oya.json.paths,
      productDetails: productDetails
    }
    var results = await oya.buckets.pushPath(oya.bucketKey, 'index.json', JSON.stringify(details,null,2))
    // TODO - if the CID changed, wipe out the success class on pinata & filecoin buttons
    oya.json_cid = results.path.cid.string
    oya.json = details
  }
  const formToJSON = elements => [].reduce.call(elements, (data, element) => {
    if (element.name.length && element.value.length && element.name != 'filepond') {
      data[element.name] = element.type == "checkbox" ? (element.checked ? 'Yes' : 'No') : element.value;
    }
    return data;
  }, {});
  /**
   * Pushes files to the bucket
   * @param file
   * @param path
   */
  const insertFile = async (file, path) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onabort = () => reject('file reading was aborted')
      reader.onerror = () => reject('file reading has failed')
      reader.onload = () => {
      // Do whatever you want with the file contents
        const binaryStr = reader.result

        if (!oya.buckets || !oya.bucketKey) {
          reject('No bucket client or root key')
          return
        }
        oya.buckets.pushPath(oya.bucketKey, path, binaryStr).then((raw) => {
          resolve(raw)
        })
      }
      reader.readAsArrayBuffer(file.file)
    })
  }
  const loadFormInterface = async () => {
    oya.buckets.open(oya.eth_address)
    hide('.loading')
    var files = []
    if (oya.json && oya.json.paths && oya.json.paths.length) {
      files = oya.json.paths.map(function (path) {
        return {options:{type:'local', source:path.cid, file:{name:path.name}}}
      })
    }
    const inputElement = document.querySelector('input[type="file"]');
    FilePond.registerPlugin(FilePondPluginImageExifOrientation, FilePondPluginImagePreview);
    const pond = FilePond.create( inputElement, {
      maxFiles:1, files:files
    })
    pond.on('addfile', async (error, file) => {
      const fileName = file.file.name;
      if (!file.source.options) { // not already uploaded
        const results = await insertFile(file, `photos/${fileName}`)
        oya.json.paths.push({cid:results.path.cid.string, name:fileName})
      }
    })
    pond.on('removefile', async (error, file) => {
      const fileName = file.file.name;
      oya.json.paths = oya.json.paths.filter(path => path.name !== fileName)
      oya.buckets.removePath(oya.bucketKey, `photos/${fileName}`)
    });
    document.getElementById('cancel-button').addEventListener('click', function (e) {
      e.preventDefault();
      hide("#js-edit-details")
      loadProduct()
      show("#js-product-details")
    })
    document.getElementById('product-form').addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('submit-form-button').value = 'Loading...'
      const data = formToJSON(this.elements);
      upLoadMetaData(data).then(function () {
        window.location.hash = `#${oya.bucketKey}`
        hide("#js-edit-details")
        var elements = document.getElementsByClassName('edit-button')
        for (var i = 0; i < elements.length; i++) {
          elements[i].classList.remove('error')
          elements[i].classList.remove('loaded')
        }
        loadProduct()
        show("#js-product-details")
        hide('.addProduct')
        document.getElementById('submit-form-button').value = 'Submit'
      })
    })
  }
  const loadProduct = () => {
    var details = oya.json.productDetails
    if (!details) {
      console.error('productDetails not found')
      return
    }
    // Update image
    var imageHTML = ''
    if (oya.json.paths) {
      for (var i = 0; i < oya.json.paths.length; i++) {
        imageHTML += `<img src="https://${oya.json.paths[i].cid}.ipfs.hub.textile.io/">`
      }
    }
    document.getElementById('js-images').innerHTML = imageHTML;
    document.getElementById('seller-address').innerHTML = oya.json.author;

    // Update product details & js-extra-details
    document.getElementById("js-extra-details").innerHTML = ''
    const total = parseFloat(details.Price) + parseFloat(details['shipping-price'])
    var elements = document.getElementsByClassName(`js-details-total-price`)
    for (var i = 0; i < elements.length; i++) {
      elements[i].innerHTML = total
    }
    for (let [name, value] of Object.entries(details)) {
      var elements = document.getElementsByClassName(`js-details-${name}`)
      if (elements.length) {
        for (var i = 0; i < elements.length; i++) {
          elements[i].innerHTML = value // TODO - ONLY DO TEXT!!
        }
      } else {
        var listItem = document.createElement("LI");
        // TODO - is this safe from script injection?
        listItem.appendChild(document.createTextNode(`${name}: ${value}`));
        document.getElementById("js-extra-details").appendChild(listItem)
      }
    }
    var elements = document.getElementsByClassName('js-last-updated')
    for (var i = 0; i < elements.length; i++) {
      elements[i].innerHTML = new Date(oya.json.date).toUTCString();
    }
    var elements = document.getElementsByClassName('js-product-cid')
    for (var i = 0; i < elements.length; i++) {
      elements[i].innerHTML = oya.json_cid;
    }
  }
  const loadButtons = () => {
    // TODO - add permalink to this product listing on order confirmation page
    if (oya.eth_address == oya.json.author) {
      document.getElementById("powergate-button").addEventListener('click', async function (e) {
        var thisButton = this
        thisButton.querySelector('.loading-image').classList.remove('hidden')
        thisButton.classList.remove('error')
        oya.buckets.archive(oya.bucketKey).then(function () {
          thisButton.classList.add('loaded')
          thisButton.querySelector('.loading-image').classList.add('hidden')
        }).catch(function (e) {
          console.error(e)
          thisButton.querySelector('.loading-image').classList.add('hidden')
          thisButton.classList.add('error')
          alert('Oops, something went wrong, please try again later.')
        })
      })
      document.getElementById('pinata-button').addEventListener('click', async function (e) {
        var thisButton = this
        thisButton.querySelector('.loading-image').classList.remove('hidden')
        const hash = 'bafkreibplgu6qfsnckpltauoj35dj7fpzp7betqv3dnz43hniptqughkf4'
        const response = await fetch("https://api.pinata.cloud/pinning/pinByHash", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "pinata_api_key": "e2415f29dee020d283b0",
            "pinata_secret_api_key": "c9370a318e8f3d4ee240f464cd49beb6f0ca8fc4ca3584e1ebb78a852c41d334"
          },
          body: JSON.stringify({hashToPin:oya.json_cid})
        }).then(function (response) {
          if (response.status == 200) {
            thisButton.classList.add('loaded')
            thisButton.querySelector('.loading-image').classList.add('hidden')
          } else {
            thisButton.classList.add('error')
            thisButton.querySelector('.loading-image').classList.add('hidden')
            alert('Oops, something went wrong, please try again later.')
          }
        }).catch(function (e) {
          console.error(e)
          thisButton.classList.add('error')
          thisButton.querySelector('.loading-image').classList.add('hidden')
          alert('Oops, something went wrong, please try again later.')
        });
      })
      show('.can-edit')
    } else {
      document.getElementById("buy-now-button").addEventListener('click', async function (e) {
        e.preventDefault();
        if (typeof web3 === 'undefined') {
          alert('Metamask must be installed to buy a product')
          show("#js-install-metamask")
          window.scroll(0,0)
          return
        }
        if (!oya.eth_address) {
          const result = await oya.provider.provider.request({ method: 'eth_requestAccounts' });
          if (result) {
            oya.eth_address = result[0]
          }
        }
        var elements = document.getElementsByClassName('js-buyer-eth-address')
        for (var i = 0; i < elements.length; i++) {
          elements[i].innerHTML = oya.eth_address;
        }
        hide("#js-product-details")
        show("#js-order-confirmation")
      })
      show('.can-buy')
      var elements = document.getElementsByClassName('js-seller-eth-address')
      for (var i = 0; i < elements.length; i++) {
        elements[i].innerHTML = oya.json.author;
      }
    }
  }
  const loadJSON = async (success, error) => {
    fetch(`https://${oya.json_cid}.ipfs.hub.textile.io`).then(
      response => {
        hide('.loading')
        if (response.ok) {
          response.json().then(success)
        } else {
          error()
        }
      }
    )
  }
  const show = (identifier) => {
    var elements = getElements(identifier);
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.remove('hidden')
    }
  }
  const hide = (identifier) => {
    var elements = getElements(identifier);
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.add('hidden')
    }
  }
  const getElements = (identifier) => {
    const idOrClass = identifier[0];
    identifier = identifier.slice(1); // trim off first char
    if (idOrClass == '.') {
      return document.getElementsByClassName(identifier);
    } else if (idOrClass == '#') {
      var element = document.getElementById(identifier);
      if (element) {
        return [element]
      } else {
        return []
      }
    } else {
      throw('Unexpected start of identifier.  Should be "." or "#"')
    }
  }

  var oya = {json:{paths:[]}};
  oya.buckets = await getBuckets()
  oya.eth_address = getEthAddress()
  var url_hash = new URL(document.URL).hash
  const queryString = window.location.search;
  var elements = document.getElementsByClassName('enable-metamask')
  for (var i = 0; i < elements.length; i++) {
    elements[i].addEventListener('click', async function (e) {
      await oya.provider.provider.request({ method: 'eth_requestAccounts' });
      location.reload()
    })
  }
  if (url_hash.length > 1) {
    [oya.bucketKey, oya.json_cid] = url_hash.slice(1).split('/')
    // TODO - check to see if CIDs match and show a warning
    if (!oya.json_cid) {
      const ipfs_path = await oya.buckets.listIpfsPath(`/ipns/${oya.bucketKey}/index.json`)
      console.log('blarf')
      oya.json_cid = ipfs_path.cid
    }
    await loadJSON(function (json) {
      if (!json) {
        console.error('json not found')
        return
      }
      oya.json = json
      oya.json.paths = oya.json.paths || []
      loadButtons()
      loadProduct()
      loadFormInterface()
    }, function () {
      console.error('Oops something went wrong w/ loadJSON :(')
    })

  } else { // Adding new product listing
    hide("#js-product-details")
    if (oya.eth_address) {
      if (!oya.bucketKey) {
        const root = await oya.buckets.open(oya.eth_address)
        if (!root) {
          throw new Error('Failed to open bucket')
        }
        oya.bucketKey = root.key
        oya.buckets.listIpfsPath(`/ipns/${oya.bucketKey}/index.json`).then(function () {
          // bucket already exists, load it
          window.location.hash = `#${oya.bucketKey}`
          location.reload() // TODO - display info w/o redirect
        }).catch(function (e) {
          console.log('info', e.message) // no JSON file found, create a new product
          loadFormInterface()
          document.getElementById('submit-form-button').value = 'Preview'
          show("#js-edit-details")
          show(".addProduct")
          loadButtons()
        })
      }
    } else {
      if (typeof web3 === 'undefined') {
        hide('.loading')
        show("#js-install-metamask")
      } else {
        hide('.loading')
        show("#js-enable-metamask")
      }
    }
  }
  document.getElementById("edit-product").addEventListener('click', function (e) {
    hide("#js-product-details")
    show('.editProduct')
    for (let [name, value] of Object.entries(oya.json.productDetails)) {
      var inputs = document.getElementsByName(name);
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].type == "checkbox") {
          inputs[i].checked = value == 'Yes';
        } else {
          inputs[i].value = value
        }
      }
    }
    show("#js-edit-details")
  })
  var elements = document.getElementsByClassName('show-after-loaded')
  for (var i = elements.length; i > 0 ; i--) {
    elements[0].classList.remove('show-after-loaded')
  }
  if (typeof web3 !== 'undefined') {
    if (oya.eth_address) {
      show('#logged-in')
      var elements = document.getElementsByClassName('js-buyer-eth-address')
      for (var i = 0; i < elements.length; i++) {
        elements[i].innerHTML = `...${oya.eth_address.slice(-7)}`;
      }
    } else {
      show('#logged-out')
    }
    show('#login-nav')
  }
};
main();
