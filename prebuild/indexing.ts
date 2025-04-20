import { Asset, ModelEntry, type IAssetFunctions } from '../utils/types.ts';
import { GraphManager, viewModels } from 'alizarin';
import { assetFunctions } from './functions.ts';

class AssetIndexing {
  async postHook(graphManager: GraphManager) {
    // Parse the CSV content
    const Session = graphManager.get("Session");
    const sessions = Object.fromEntries(
      await Promise.all(
        [...await Promise.all(await Session.all())].map(
          async session => [`${await session.number}`, session]
        )
      )
    );
    const timetable = await import('./timetable.ts');
    const times = await timetable.parseTimetable(
      sessions,
      async (talk: Asset) => `/sessions/?slug=${await assetFunctions.toSlug(talk)}`
    );

    // TODO: Splitting this out between FE/BE would be better.

    const fs = await import('fs');
    fs.promises.writeFile('assets/times.json', JSON.stringify(times, null, 2))
  }
};

const assetIndexing = new AssetIndexing();

export { assetIndexing };
