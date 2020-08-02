// import confetti from 'canvas-confetti';
import browserImageSize from 'browser-image-size'
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

    // TODO - pull this from somewhere else
    const buckets = await textile.Buckets.withKeyInfo({key:'brqbnrvpihcdrdjh2japbkgd6mm'})
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
      paths: oya.paths,
      productDetails: productDetails
    }
    await oya.buckets.pushPath(oya.bucketKey, 'index.json', JSON.stringify(details,null,2))
  }
  const formToJSON = elements => [].reduce.call(elements, (data, element) => {
    if (element.name.length && element.value.length) {
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

  var oya = {paths:[]};
  const inputElement = document.querySelector('input[type="file"]');
  FilePond.registerPlugin(FilePondPluginImageExifOrientation, FilePondPluginImagePreview);
  const pond = FilePond.create( inputElement, {
    allowMultiple: true
  })
  pond.on('addfile', async (error, file) => {
    const fileName = `photos/${file.file.name}`
    await insertFile(file, fileName);
    oya.paths.push(fileName)
  })
  pond.on('removefile', async (error, file) => {
    const fileName = `photos/${file.file.name}`
    await oya.buckets.removePath(oya.bucketKey, fileName)
    oya.paths = oya.paths.filter(path => path !== fileName)
  });
  oya.identity = await getIdentity();
  const {bucketKey, buckets} = await getBucketKey()
  oya.buckets = buckets
  oya.bucketKey = bucketKey
  document.getElementById('product-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const data = formToJSON(this.elements);
    upLoadMetaData(data)
  })
  oya.links = await buckets.links(bucketKey).catch(error => {
    console.error('Error Caught - set up retry logic:', error);
  })
  fetch(oya.links.ipns+'/index.json').then(
    response => {
      var elements = document.getElementsByClassName('loading')
      for (var i = 0; i < elements.length; i++) {
        elements[i].classList.add('hidden')
      }
      if (response.ok) {
        response.json().then(json => {
          var elements = document.getElementsByClassName('editProduct')
          for (var i = 0; i < elements.length; i++) {
            elements[i].classList.remove('hidden')
          }
          for (let [name, value] of Object.entries(json.productDetails)) {
            var inputs = document.getElementsByName(name);
            for (var i = 0; i < inputs.length; i++) {
              if (inputs[i].type == "checkbox") {
                inputs[i].checked = value;
              } else {
                inputs[i].value = value
              }
            }
          }
        })
      } else {
        var elements = document.getElementsByClassName('addProduct')
        for (var i = 0; i < elements.length; i++) {
          elements[i].classList.remove('hidden')
        }
      }
    }
  )
};
main();
