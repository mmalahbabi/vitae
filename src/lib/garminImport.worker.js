import { parseGarminFiles } from './garminImport.js';

self.onmessage = async ({ data }) => {
  try { self.postMessage({ result: await parseGarminFiles(data.files, data.timeZone) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
