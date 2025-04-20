import * as fs from "fs";
import { type Feature, type FeatureCollection } from 'geojson';

import { client, RDM, graphManager, staticStore, viewModels, interfaces } from 'alizarin';

import { Asset } from './types.ts';
import { assetFunctions } from '../prebuild/functions.ts';
import { assetIndexing } from '../prebuild/indexing.ts';

const PUBLIC_FOLDER = 'public';

const getFile = (filename: string) => fs.promises.readFile(`static/${filename}`, { encoding: "utf8" });
await assetFunctions.initialize(getFile);
const MODEL_FILES = assetFunctions.getModelFiles();


function initAlizarin() {
    const archesClient = new client.ArchesClientLocal({
        allGraphFile: (() => "prebuild/graphs.json"),
        graphIdToGraphFile: ((graphId: string) => MODEL_FILES[graphId] && `prebuild/resource_models/${MODEL_FILES[graphId].graph}`),
        graphIdToResourcesFiles: ((graphId: string) => {
          return Object.values(MODEL_FILES[graphId].resources).map((resourceFile: string) => `prebuild/business_data/${resourceFile}`);
        }),
        // resourceIdToFile: ((resourceId: string) => `public/resources/${resourceId}.json`),
        // TODO: move collections and graphs to static
        collectionIdToFile: ((collectionId: string) => `prebuild/reference_data/${collectionId}.json`)
    });
    archesClient.fs = fs.promises;
    graphManager.archesClient = archesClient;
    staticStore.archesClient = archesClient;
    // Load everything so we can do lookups
    staticStore.cacheMetadataOnly = false;
    RDM.archesClient = archesClient;
    return graphManager;
}

async function processAsset(assetPromise: Promise<viewModels.ResourceInstanceViewModel>): Promise<Asset> {
  const asset = await assetPromise;
  const staticAsset = await asset.forJson(true)
  const meta = await assetFunctions.getMeta(staticAsset);
  const replacer = function (_: string, value: any) {
    if(value instanceof Map) {
      const result = Object.fromEntries(value);
        return result
    }
    return value;
  }

  if (!asset._) {
    throw Error("This asset was not properly loaded");
  }
  const resource = asset._.resource;
  const cache = await asset._.getValueCache(true, async (value: interfaces.IViewModel) => {
    if (value instanceof viewModels.ResourceInstanceViewModel) {
      const meta = await assetFunctions.getMeta(await value);
      return {
        title: meta.meta.title,
        slug: meta.meta.slug,
        location: meta.meta.location,
      };
    }
  });
  if (cache && Object.values(cache).length > 0) {
    resource.__cache = cache;
  }
  const serial = JSON.stringify(resource, replacer, 2)
  await fs.promises.mkdir(`${PUBLIC_FOLDER}/definitions/business_data`, {recursive: true});
  await fs.promises.writeFile(
      `${PUBLIC_FOLDER}/definitions/business_data/${meta.slug}.json`,
      serial
  );

  return meta;
}

function extractFeatures(geoJsonString: string): Feature[] {
  const geoJson = JSON.parse(geoJsonString);
  if (geoJson["type"] === "FeatureCollection") {
    return geoJson["features"];
  }
  const feature: Feature = {
    type: geoJson["type"],
    geometry: geoJson["geometry"],
    properties: geoJson["properties"],
  };
  if (!feature.geometry) {
    return [];
  }
  return [feature];
}

async function buildPreindex(graphManager: any) {
    await graphManager.initialize();
    console.log("loading for preindex");
    const assets = await assetFunctions.getAll(graphManager);
    console.log("loaded");
    let n = 25;
    const batches = assets.length / n;
    const geoJson: FeatureCollection = {
      "type": "FeatureCollection",
      "features": []
    };
    const assetMetadata = [];
    const graphs = new Set();
    for (let b = 0 ; b < batches ; b++) {
      if (b % 5 == 0) {
        console.log(b, ": completed", b * n, "records,", Math.floor(b * n * 100 / assets.length), "%");
      }

      let assetBatch = (await Promise.all(assets.slice(b * n, (b + 1) * n).map(processAsset))).filter(asset => asset);
      assetBatch.map(asset => asset.meta && asset.meta.geometry ? geoJson.features.push(...extractFeatures(asset.meta.geometry)) : null);
      assetBatch.forEach(asset => graphs.add(asset.meta.graphId));
      assetMetadata.push(...assetBatch);
    }

    let preindexFile: string;
    preindexFile = `prebuild/preindex/ix.pi`;
    await fs.promises.mkdir('prebuild/preindex', {recursive: true});
    await fs.promises.mkdir(`${PUBLIC_FOLDER}/definitions/resource_models`, {recursive: true});

    await fs.promises.writeFile(`${PUBLIC_FOLDER}/definitions/resource_models/_all.json`, JSON.stringify({
        "models": Object.fromEntries([...graphs.values()].map((v) => [v, {}]))
    }));
    await fs.promises.rm(`${PUBLIC_FOLDER}/definitions/resource_models`, {recursive: true, force: true});
    await fs.promises.cp(`prebuild/resource_models`, `${PUBLIC_FOLDER}/definitions/resource_models`, {recursive: true});
    await fs.promises.rm(`${PUBLIC_FOLDER}/definitions/collections`, {recursive: true, force: true});
    await fs.promises.cp(`prebuild/reference_data`, `${PUBLIC_FOLDER}/definitions/collections`, {recursive: true});
    await fs.promises.writeFile(`${PUBLIC_FOLDER}/definitions/resource_models/_all.json`, JSON.stringify({
        "models": Object.fromEntries([...graphs.values()].map((v) => [v, {}]))
    }));

    await Promise.all([
      fs.promises.writeFile(preindexFile, JSON.stringify(assetMetadata, null, 2)),
    ]);
}

const gm = await initAlizarin();
await buildPreindex(gm);
if (assetIndexing.postHook) {
  await assetIndexing.postHook(graphManager);
}
