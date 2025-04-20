import { Marked } from 'marked'
import markedPlaintify from 'marked-plaintify'
import { Asset, ModelEntry, type IAssetFunctions } from '../utils/types.ts';
import { GraphManager, viewModels } from 'alizarin';
import { fetchTemplate } from '../utils/template.ts';

class AssetFunctions implements IAssetFunctions {
  slugCounter: {[key: string]: number};
  template: HandlebarsTemplateDelegate<any> | undefined = undefined;

  constructor() {
    this.slugCounter = {};
  }

  async getAll(graphManager: GraphManager) {
    const Session = graphManager.get("Session");
    const Talk = graphManager.get("Talk");
    const Institution = graphManager.get("Institution");
    const Person = graphManager.get("Person");
    // const MaritimeVessel = graphManager.get("MaritimeVessel");
    return [
      await Session.all({lazy: true}),
      await Institution.all({lazy: true}),
      await Talk.all({lazy: true}),
      await Person.all({lazy: true}),
      // await MaritimeVessel.all({lazy: true}),
    ].flat();
  }

  async initialize(getFile: ((filename: string) => Promise<string>)): Promise<boolean> {
    const md = await getFile('templates/index.md');
    this.template = await fetchTemplate(md);
    return true;
  }

  getModelFiles():{[key: string]: ModelEntry} {
    return {
      "7d7d1c77-e660-48cc-b90d-292c81ea01cf": new ModelEntry(
          "Session.json",
          {
            "Session": "7d7d1c77-e660-48cc-b90d-292c81ea01cf.json",
          }
      ),
      "0271fdde-e6c7-457c-b25a-e65a11aba499": new ModelEntry(
          "Institution.json",
          {
            "Institution": "0271fdde-e6c7-457c-b25a-e65a11aba499.json",
          }
      ),
      "a6c412db-72e0-4099-a690-ccc75ba841a9": new ModelEntry(
          "Talk.json",
          {
            "Talk": "a6c412db-72e0-4099-a690-ccc75ba841a9.json",
          }
      ),
      "47f5403a-2785-4613-a8e9-bda0cdd85254": new ModelEntry(
          "Person.json",
          {
            "Person": "47f5403a-2785-4613-a8e9-bda0cdd85254.json",
          }
      ),
    }
  }

  async toSlug(asset: any): Promise<string> {
    let title;
    let isStatic = !(asset instanceof viewModels.ResourceInstanceViewModel);
    switch (isStatic ? asset.type : asset.__.wkrm.modelClassName) {
      case 'Institution':
        title = (isStatic ? asset.root.name : (await asset.name).toString()) || "(Institution)";
        break;
      case 'Person':
        title = (isStatic ? asset.root.name : (await asset.name).toString()) || "(Person)";
        break;
      case 'Session':
        title = `session-${isStatic ? asset.root.number : (await asset.number).toString()}`;
        break;
      case 'Talk':
        title = (isStatic ? asset.root.title : (await asset.title).toString()) || "(Talk)";
        break;
      default:
        throw Error(`Unrecognized ${isStatic ? 'static' : 'dynamic'} type: ${isStatic ? asset.type : asset.__.wkrm.modelClassName}`);
    }
    let slug = title.replaceAll(/[^A-Za-z0-9_]/g, "").slice(0, 20);
    slug = `${slug}_${asset.id.slice(0, 6)}`;
    this.slugCounter[slug] = slug;
    return slug;
  }

  async getMeta(asset: any): Promise<Asset> {
    let title;
    let isStatic = !(asset instanceof viewModels.ResourceInstanceViewModel);
    switch (isStatic ? asset.type : asset.__.wkrm.modelClassName) {
      case 'Institution':
        title = isStatic ? asset.root.name : (await asset.name).forJson();
        break;
      case 'Person':
        title = isStatic ? asset.root.name : (await asset.name).forJson();
        if (!isStatic) {
          let institutions = await Promise.all([...await asset.institution].map(async institution => (await institution).name));
          if (institutions.length) {
            title = `${title} (${institutions.join('; ')})`;
          }
        }
        break;
      case 'Session':
        title = `Session ${isStatic ? asset.root.number : (await asset.number).forJson()}`;
        break;
      case 'Talk':
        title = isStatic ? asset.root.title : (await asset.title).forJson();
    }
    let slug = await this.toSlug(asset);
    const meta = new Asset(
      isStatic ? asset.graphId : asset.__.wkrm.graphId,
      asset.id,
      {},
      {},
      title,
      slug,
      ""
    );
    if (!this.template) {
      throw Error("Template not loaded");
    }
    if (isStatic) {
      const md = await this.template({ title: meta.meta.title, ha: asset.root }, {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
      });
      const plaintext = await new Marked({ gfm: true })
        .use(markedPlaintify())
        .parse(md);
      meta.content = plaintext.substring(0, 300);
    }
    return meta;
  }
};

const assetFunctions = new AssetFunctions();

export { assetFunctions };
