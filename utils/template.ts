import Handlebars from 'handlebars';
import { renderers } from 'alizarin';

Handlebars.registerHelper("replace", (base, fm, to) => base ? base.replaceAll(fm, to) : base);
Handlebars.registerHelper("plus", (a, b) => a + b);
Handlebars.registerHelper("toHtml", (a) => decodeURI(a));
Handlebars.registerHelper("default", function (a, b) {return a === undefined || a === null ? b : a;});
Handlebars.registerHelper("defaulty", function (a, b) {return a != undefined && a != null && a != false ? a : b;});
Handlebars.registerHelper("equal", function (a, b) {return a == b;});
Handlebars.registerHelper("not", function (a, b) { return a != b;});
Handlebars.registerHelper("join", function (infix, vars) { return vars ? vars.join(infix) : "";});
Handlebars.registerHelper("nospace", function (a) { return a.replaceAll(" ", "%20")});
Handlebars.registerHelper("clean", function (a) {
  if (a instanceof renderers.Cleanable) {
    return a.__clean;
  }

  return a;
});
Handlebars.registerHelper("concat", function (...args) { return args.slice(0, args.length-1).join(""); });
Handlebars.registerHelper("dialogLink", function (options) { return new Handlebars.SafeString(`<button class="govuk-button dialog-link" data-dialog-id="${options.hash.id}">Show</button>`); });

async function fetchTemplate(templateFile: string) {
  return Handlebars.compile(templateFile);
}

export { fetchTemplate };
