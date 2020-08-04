// TODO - set up dyamic import?
// import browserImageSize from 'browser-image-size' // TODO - set this up
import * as FilePond from 'filepond';
import FilePondPluginImageExifOrientation from 'filepond-plugin-image-exif-orientation';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';

const main = async () => {
  const getIdentity = async () => {
    try {
      var storedIdent = localStorage.getItem("identity");
      if (storedIdent === null) {
        throw new Error("No identity");
      }
      const restored = threads.Libp2pCryptoIdentity.fromString(storedIdent);
      return restored;
    }
    catch (e) {
      /**
       * If any error, create a new identity.
       */
      try {
        const identity = await threads.Libp2pCryptoIdentity.fromRandom();
        const identityString = identity.toString();
        localStorage.setItem("identity", identityString);
        return identity;
      } catch (err) {
        return err.message;
      }
    }
  };

  /**
   * getBucketKey will create a new Buckets client with the UserAuth
   * and then open our custom bucket named, 'io.textile.dropzone'
   */
  const getBucketKey = async () => {
    if (!oya.identity) {
      throw new Error('Identity not set')
    }

    // TODO - pull this from somewhere else - this is the regular hub key
    const buckets = await textile.Buckets.withKeyInfo({key:'brqbnrvpihcdrdjh2japbkgd6mm'})

    // When hub.next is working, use the API endpoint below w/ the hub.next key below
    // const buckets = await textile.Buckets.withKeyInfo({key:'brnyrzoniaaxmk27bgqe5synqq4'}, 'https://grpcweb.hub.next.textile.io')
    // Authorize the user and your insecure keys with getToken
    await buckets.getToken(oya.identity)

    const root = await buckets.open('oya.product')
    if (!root) {
      throw new Error('Failed to open bucket')
    }
    return {buckets: buckets, bucketKey: root.key};
  }

  const upLoadMetaData = async (productDetails) => {
    const details = {
      author: oya.identity.public.toString(),
      date: (new Date()).getTime(),
      paths: oya.json.paths,
      productDetails: productDetails
    }
    await oya.buckets.pushPath(oya.bucketKey, 'index.json', JSON.stringify(details,null,2))
    oya.json = details
  }
  const formToJSON = elements => [].reduce.call(elements, (data, element) => {
    if (element.name.length && element.value.length && element.name != 'filepond') {
      data[element.name] = element.type == "checkbox" ? element.checked : element.value;
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
    var files = []
    if (oya.json && oya.json.paths && oya.json.paths.length) {
      files = oya.json.paths.map(function (pathName) {
        pathName = pathName.split('/').pop()
        return {options:{type:'local',file:{name:pathName}}}
      })
    }
    const inputElement = document.querySelector('input[type="file"]');
    FilePond.registerPlugin(FilePondPluginImageExifOrientation, FilePondPluginImagePreview);
    const pond = FilePond.create( inputElement, {
      maxFiles:1, files:files
    })
    pond.on('addfile', async (error, file) => {
      const fileName = `photos/${file.file.name}`
      if (!oya.json.paths.includes(fileName)) {
        await insertFile(file, fileName);
        oya.json.paths.push(fileName)
      }
    })
    pond.on('removefile', async (error, file) => {
      const fileName = `photos/${file.file.name}`
      oya.json.paths = oya.json.paths.filter(path => path !== fileName)
      oya.buckets.removePath(oya.bucketKey, fileName)
    });
    document.getElementById('product-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const data = formToJSON(this.elements);
      upLoadMetaData(data).then(function () {
        window.location.hash = '#'+oya.bucketKey;
        document.getElementById("js-edit-details").classList.add('hidden')
        loadProduct()
        // TODO - set this up when textile gets things working
        // console.log( oya.buckets.archive(oya.bucketKey))
        document.getElementById("js-product-details").classList.remove('hidden')
      })
    })
  }
  const loadIdentity = async () => {
    oya.identity = await getIdentity();
    const {bucketKey, buckets} = await getBucketKey()
    oya.buckets = buckets
    oya.bucketKey = bucketKey
    oya.links = await buckets.links(bucketKey).catch(error => {
      console.error('Error Caught - set up retry logic:', error);
    })
    console.log(oya.links)
  }
  const loadProduct = () => {
    var details = oya.json.productDetails
    if (!details) {
      console.error('productDetails not found')
      return
    }
    document.getElementById("js-extra-details").innerHTML = ''
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
    var imageHTML = ''
    if (oya.json.paths) {
      for (var i = 0; i < oya.json.paths.length; i++) {
        imageHTML += `<img src="${rootPath()}/${oya.json.paths[i]}">`
      }
    }
    document.getElementById('js-images').innerHTML = imageHTML
  }
  const rootPath = () => {
    return `https://${oya.bucketKey}.ipns.hub.textile.io`
  }
  const loadJSON = async (success, error) => {
    fetch(rootPath()+'/index.json').then(
      response => {
        var elements = document.getElementsByClassName('loading')
        for (var i = 0; i < elements.length; i++) {
          elements[i].classList.add('hidden')
        }
        if (response.ok) {
          response.json().then(success)
        } else {
          error()
        }
      }
    )
  }

  var oya = {json:{paths:[]}};
  var url_hash = new URL(document.URL).hash
  if (url_hash.length > 1) {
    oya.bucketKey = url_hash.slice(1)
    await loadJSON(function (json) {
      if (!json) {
        console.error('json not found')
        return
      }
      oya.json = json
      oya.json.paths = oya.json.paths || []
      loadProduct()
    }, function () {
      console.error('Oops something went wrong w/ loadJSON :(')
    })
  } else {
    document.getElementById("js-product-details").classList.add('hidden')
    loadFormInterface()
    document.getElementById("js-edit-details").classList.remove('hidden')
    loadIdentity()
    var elements = document.getElementsByClassName('addProduct')
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.remove('hidden')
    }
  }
  document.getElementById("edit-product").addEventListener('click', function (e) {
    document.getElementById("js-product-details").classList.add('hidden')
    loadFormInterface()
    var elements = document.getElementsByClassName('editProduct')
    for (var i = 0; i < elements.length; i++) {
      elements[i].classList.remove('hidden')
    }
    for (let [name, value] of Object.entries(oya.json.productDetails)) {
      var inputs = document.getElementsByName(name);
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].type == "checkbox") {
          inputs[i].checked = value;
        } else {
          inputs[i].value = value
        }
      }
    }
    document.getElementById("js-edit-details").classList.remove('hidden')
    loadIdentity()
  })
  var elements = document.getElementsByClassName('loading')
  for (var i = 0; i < elements.length; i++) {
    elements[i].classList.add('hidden')
  }
  var elements = document.getElementsByClassName('show-after-loaded')
  for (var i = elements.length; i > 0 ; i--) {
    elements[0].classList.remove('show-after-loaded')
  }
};
main();
