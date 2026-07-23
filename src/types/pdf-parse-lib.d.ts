// @types/pdf-parse only declares the "pdf-parse" module — src/lib/actions/sources.ts
// imports the deeper "pdf-parse/lib/pdf-parse.js" path instead (see the comment there
// for why), so re-export the same types under that path.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
