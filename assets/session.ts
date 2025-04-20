import { assetFunctions } from './prebuild/functions.ts';
import { Starches } from './utils/asset.ts';

window.addEventListener('DOMContentLoaded', async (event) => {
  window.starches = new Starches(assetFunctions);
  window.starches.initialize();
});
