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

  const initIndex = async () => {
    const index = {
      author: oya.identity.public.toString(),
      date: (new Date()).getTime(),
      paths: []
    }
    await storeJSON('index.json', index)
    return index
  }

  const storeJSON = async (path, index) => {
    await oya.buckets.pushPath(oya.bucketKey, path, JSON.stringify(index, null, 2))
  }
  const upLoadMetaData = async (metaData) => {
    const now = new Date().getTime()
    metaData['timestamp'] = now
    storeJSON('product_info.json', metaData)
  }
  const formToJSON = elements => [].reduce.call(elements, (data, element) => {
    data[element.name] = element.value;
    return data;
  }, {});

  var oya = {};
  const inputElement = document.querySelector('input[type="file"]');
  FilePond.registerPlugin(FilePondPluginImageExifOrientation, FilePondPluginImagePreview);
  const pond = FilePond.create( inputElement, {
    allowMultiple: true
  })
  pond.on('addfile', (error, file) => {
      console.log('File added', file);
  })
  pond.on('removefile', (error, file) => {
      console.log('File removed', file);
  });
  oya.identity = await getIdentity();
  const {bucketKey, buckets} = await getBucketKey()
  oya.buckets = buckets
  oya.bucketKey = bucketKey
  document.getElementById('product-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const data = formToJSON(this.elements);
    console.log(data)
  })
  try {
    const links = await buckets.links(bucketKey)
    console.log(links)
  } catch (e) {
    console.log(e)
  }
  console.log(initIndex())
  upLoadMetaData({fun:'times'})
};
main();
