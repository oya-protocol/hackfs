// import confetti from 'canvas-confetti';
import browserImageSize from 'browser-image-size'

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
    await storeIndex(index)
    return index
  }

  const storeIndex = async (index) => {
    await oya.buckets.pushPath(oya.bucketKey, 'index.json', JSON.stringify(index, null, 2))
  }
  const upLoadMetaData = async (metaData) => {
    const now = new Date().getTime()
    metaData['timestamp'] = now
    const metaDataAsJSON = JSON.stringify(metaData, null, 2)
    oya.buckets.pushPath(oya.bucketKey, 'product_info.json', metaDataAsJSON)
  }

  var oya = {};
  oya.identity = await getIdentity();
  const {bucketKey, buckets} = await getBucketKey()
  oya.buckets = buckets
  oya.bucketKey = bucketKey
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

