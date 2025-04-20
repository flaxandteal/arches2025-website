import { marked } from 'marked';
import dompurify from 'dompurify';
import markedPlaintify from 'marked-plaintify'
import { client, RDM, graphManager, staticStore, staticTypes, utils, viewModels, renderers } from 'alizarin';
import { fetchTemplate } from './template.ts';

const archesUrl = window.archesUrl;

class SearchParams {
  slug: string
  publicView: boolean | undefined

  constructor(slug: string, publicView: boolean | undefined) {
    this.slug = slug;
    this.publicView = publicView;
  }
};

class Asset {
  asset: any
  meta: any

  constructor(asset: any, meta: any) {
    this.asset = asset;
    this.meta = meta;
  }
}

class Dialog {
  title: string
  body: string

  constructor(title: string, body: string) {
    this.title = title;
    this.body = body;
  }
}

class Starches {
  assetFunctions;

  constructor(assetFunctions) {
    this.assetFunctions = assetFunctions;
  }

  async initializeAlizarin() {
    const modelFiles = this.assetFunctions.getModelFiles();
    const archesClient = new client.ArchesClientRemoteStatic('', {
      allGraphFile: (() => "definitions/resource_models/_all.json"),
      graphIdToGraphFile: ((graphId) => `definitions/resource_models/${modelFiles[graphId].graph}`),
      resourceIdToFile: ((resourceId) => `definitions/business_data/${resourceId}.json`),
      collectionIdToFile: ((collectionId) => `definitions/collections/${collectionId}.json`)
    });
    graphManager.archesClient = archesClient;
    staticStore.archesClient = archesClient;
    RDM.archesClient = archesClient;

    await graphManager.initialize();
    return graphManager;
  }

  getSearchParams() {
    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has("slug") || !searchParams.get("slug").match(/^[a-z0-9_]+$/i)) {
      console.error("Bad slug");
    }
    const slug = searchParams.get("slug");
    let publicView = true;
    if (searchParams.get("full") === "true") {
      publicView = false;
    }
    return new SearchParams(slug, publicView);
  }

  async getAssetMetadata(asset) {
    let location = null;
    let geometry = null;
    return {
      resourceinstanceid: `${await asset.id}`,
      title: await (await asset.title).forJson()
    };
  }


  async renderAsset(asset: Asset, template) {
    const alizarinRenderer = new renderers.MarkdownRenderer({
      conceptValueToUrl: async (conceptValue: viewModels.ConceptValueViewModel) => {
        const value = await conceptValue.getValue()
        const text = await value.toString();
        return null;
      },
      domainValueToUrl: async (domainValue: viewModels.DomainValueViewModel) => {
        const value = await domainValue.getValue();
      },
      resourceReferenceToUrl: async (value: viewModels.ResourceInstanceViewModel) => null
    });
    const nonstaticAsset = await alizarinRenderer.render(asset.asset);
    const staticAsset = JSON.stringify(nonstaticAsset, null, 2);
    const images = [];
    const files = [];

    const markdown = template({ title: await asset.meta.title, ha: nonstaticAsset, js: staticAsset }, {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    });

    // <pre>{{ js }}</pre>
    const renderer = {
      hr(token) {
        return '<hr class="govuk-section-break govuk-section-break--visible">';
      },
      table(token) {
        const headers = token.header.map(
          header => `
            <th scope="col" class="govuk-table__header">${this.parser.parseInline(header.tokens)}</th>
          `
        ).join('\n');
        const rows = token.rows.map(
          row => {
            const rowText = row.map(col => {
              return `<td class="govuk-table__cell">${this.parser.parseInline(col.tokens)}</td>`;
            }).join('\n');
            return `
              <tr class="govuk-table__row">
                ${rowText}
              </tr>
            `;
          }).join('\n');
        return `
          <table class="govuk-table">
            <thead class="govuk-table__head">
              <tr class="govuk-table__row">
                ${headers}
              </tr>
            </thead>
            <tbody class="govuk-table__body">
              ${rows}
            </tbody>
          </table>
        `;
      }
    };
    marked.use({ renderer });
    const parsed = await marked.parse(markdown);
    document.getElementById('asset').innerHTML = dompurify.sanitize(parsed);
  }

  async loadAsset(slug: string, graphManager): Promise<Asset> {
    const asset = await graphManager.getResource(slug, false);
    const meta = await this.getAssetMetadata(asset);
    return new Asset(asset, meta);
  }

  async initialize() {
    const gm = await this.initializeAlizarin();
    const searchParams = this.getSearchParams();
    const publicView = searchParams.publicView || false;
    const slug = searchParams.slug;

    console.log("Displaying for public view (NB: full data loaded regardless!):", publicView);

    const asset: Asset = await this.loadAsset(slug, gm);
    const md = await fetch("/templates/talk.md");
    const template = await fetchTemplate(await md.text());
    await this.renderAsset(asset, template);

    const urlSearchParams = new URLSearchParams(window.location.search);
    window.alizarinAsset = asset;
  }
}

export { Starches };
